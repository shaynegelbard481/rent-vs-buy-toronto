/**
 * Net worth projection engine
 * Pure functions — takes a full scenario config, returns year-by-year projections.
 */

import { monthlyPayment, remainingBalance } from './mortgage.js';

/**
 * Grow a portfolio for exactly 12 months with a constant monthly cash flow.
 */
function growOneYear(value, annualReturn, monthlyContribution = 0) {
  const r = annualReturn / 12;
  for (let m = 0; m < 12; m++) {
    value = value * (1 + r) + monthlyContribution;
  }
  return value;
}

/**
 * After-tax portfolio value.
 * Only applies tax on gains — negative portfolios (debt) are returned as-is.
 */
function afterTaxPortfolio(currentValue, costBasis, marginalRate, accountType) {
  if (currentValue <= 0) return currentValue;
  const gain = Math.max(0, currentValue - costBasis);
  if (accountType === 'tfsa') return currentValue;
  if (accountType === 'rrsp') return currentValue * (1 - marginalRate);
  const taxOwed = gain * 0.5 * marginalRate;
  return currentValue - taxOwed;
}

/**
 * Project the BUY scenario year by year.
 */
export function projectBuyScenario(params, cityConfig) {
  const {
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    amortizationYears,
    appreciationRate,
    portfolioReturn,
    marginalRate,
    accountType,
    monthlyIncome,
    monthlyExpenses,
    condoFeesMonthly,
    utilityBuyMonthly,
    renovationBudget,
    renovationValueAddPct,
    renovationSplit,
    horizonYears,
    incomeGrowthRate  = 0,
    expenseGrowthRate = 0,
    withdrawalRate    = 0.04,
  } = params;

  // Overridable closing/selling costs — fall back to cityConfig values
  const legalFeesBuy          = params.legalFeesBuy              ?? cityConfig.legalFeesBuy;
  const titleInsurance         = params.titleInsurance             ?? cityConfig.titleInsurance;
  const homeInspection         = params.homeInspection             ?? cityConfig.homeInspection;
  const buyerAgentPct          = params.buyerAgentCommissionPct    ?? cityConfig.buyerAgentCommission;
  const listingAgentPct        = params.listingAgentCommissionPct  ?? cityConfig.listingAgentCommission;
  const buyerAgentAtSalePct    = params.buyerAgentCommissionAtSalePct ?? cityConfig.buyerAgentCommission;
  const sellerLegalFees        = params.sellerLegalFees            ?? cityConfig.sellerLegalFees;

  const renovSplit = (renovationSplit && renovationSplit.length > 0)
    ? renovationSplit
    : [{ year: 1, pct: 100 }];
  const renovByYear = {};
  if (renovationBudget > 0) {
    renovSplit.forEach(({ year, pct }) => {
      renovByYear[year] = (renovByYear[year] || 0) + renovationBudget * (pct / 100);
    });
  }

  const downPayment = purchasePrice * downPaymentPct;
  const cmhc        = cityConfig.cmhcInsurance(purchasePrice, downPaymentPct);
  const loanAmount  = purchasePrice - downPayment + cmhc;

  const closingCosts =
    cityConfig.landTransferTax(purchasePrice) +
    legalFeesBuy +
    titleInsurance +
    homeInspection +
    buyerAgentPct * purchasePrice;

  const mortgagePayment = monthlyPayment(loanAmount, mortgageRate, amortizationYears);

  let portfolioValue   = params.liquidAssets - downPayment - closingCosts;
  const capitalCostBasis = Math.max(0, portfolioValue);

  const snapshots = [];
  let cumulativeRenovSpend = 0;
  let totalOngoingPaid = 0;

  for (let year = 1; year <= horizonYears; year++) {
    // Income and expense grow from the base value (year 1 = no growth yet)
    const currentMonthlyIncome   = monthlyIncome   * Math.pow(1 + incomeGrowthRate,   year - 1);
    const currentMonthlyExpenses = monthlyExpenses * Math.pow(1 + expenseGrowthRate,  year - 1);

    const homeValue      = purchasePrice * Math.pow(1 + appreciationRate, year);
    const renovThisYear  = renovByYear[year] || 0;
    cumulativeRenovSpend += renovThisYear;

    const renovationEquity   = renovationBudget > 0
      ? cumulativeRenovSpend * (renovationValueAddPct / 100)
      : 0;
    const homeValueWithRenov = homeValue + renovationEquity;

    const mortgageBalance = remainingBalance(loanAmount, mortgageRate, amortizationYears, year * 12);

    const sellingCosts =
      listingAgentPct       * homeValueWithRenov +
      buyerAgentAtSalePct   * homeValueWithRenov +
      sellerLegalFees;

    const grossEquity = homeValueWithRenov - mortgageBalance;
    const netEquity   = grossEquity - sellingCosts;

    const annualPropertyTax  = homeValueWithRenov * cityConfig.propertyTaxRate;
    const annualMaintenance  = purchasePrice * cityConfig.maintenanceRate;
    const annualInsurance    = cityConfig.homeInsuranceAnnual;
    const annualCondo        = (condoFeesMonthly || 0) * 12;
    const annualUtilities    = utilityBuyMonthly * 12;
    const totalAnnualOngoing = annualPropertyTax + annualMaintenance + annualInsurance + annualCondo + annualUtilities;
    totalOngoingPaid += totalAnnualOngoing;

    const monthlyHousingCost = mortgagePayment + totalAnnualOngoing / 12;
    const monthlySurplus     = currentMonthlyIncome - currentMonthlyExpenses - monthlyHousingCost;

    portfolioValue = growOneYear(portfolioValue, portfolioReturn, monthlySurplus);
    portfolioValue -= renovThisYear;

    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);
    const totalNetWorth     = netEquity + portfolioAfterTax;

    // FIRE: can safe withdrawal from liquid portfolio cover all annual spending?
    const annualTotalSpend     = (currentMonthlyExpenses + monthlyHousingCost) * 12;
    const annualSafeWithdrawal = Math.max(0, portfolioAfterTax) * withdrawalRate;
    const fireAchieved         = portfolioAfterTax > 0 && annualSafeWithdrawal >= annualTotalSpend;
    const firePct              = annualTotalSpend > 0
      ? Math.min(1, annualSafeWithdrawal / annualTotalSpend)
      : 0;

    const totalHousingCash = closingCosts + downPayment + mortgagePayment * year * 12 + totalOngoingPaid + cumulativeRenovSpend;

    snapshots.push({
      year,
      homeValue:              Math.round(homeValueWithRenov),
      mortgageBalance:        Math.round(mortgageBalance),
      grossEquity:            Math.round(grossEquity),
      netEquity:              Math.round(netEquity),
      portfolioValue:         Math.round(portfolioValue),
      portfolioAfterTax:      Math.round(portfolioAfterTax),
      totalNetWorth:          Math.round(totalNetWorth),
      monthlyHousingCost:     Math.round(monthlyHousingCost),
      monthlySurplus:         Math.round(monthlySurplus),
      totalHousingCash:       Math.round(totalHousingCash),
      mortgagePaymentMonthly: Math.round(mortgagePayment),
      propertyTaxMonthly:     Math.round(annualPropertyTax / 12),
      maintenanceMonthly:     Math.round(annualMaintenance / 12),
      insuranceMonthly:       Math.round(annualInsurance / 12),
      condoFeesMonthly:       Math.round(annualCondo / 12),
      utilityMonthly:         Math.round(annualUtilities / 12),
      annualPropertyTax:      Math.round(annualPropertyTax),
      annualMaintenance:      Math.round(annualMaintenance),
      sellingCosts:           Math.round(sellingCosts),
      portfolioInsolvent:     portfolioValue < 0,
      fullyInsolvent:         totalNetWorth < 0,
      currentMonthlyIncome:   Math.round(currentMonthlyIncome),
      currentMonthlyExpenses: Math.round(currentMonthlyExpenses),
      annualTotalSpend:       Math.round(annualTotalSpend),
      annualSafeWithdrawal:   Math.round(annualSafeWithdrawal),
      fireAchieved,
      firePct,
    });
  }

  return snapshots;
}

/**
 * Project the RENT scenario year by year.
 */
export function projectRentScenario(params, cityConfig) {
  const {
    monthlyRent,
    rentIncreaseRate,
    portfolioReturn,
    marginalRate,
    accountType,
    monthlyIncome,
    monthlyExpenses,
    utilityRentMonthly,
    horizonYears,
    liquidAssets,
    incomeGrowthRate  = 0,
    expenseGrowthRate = 0,
    withdrawalRate    = 0.04,
  } = params;

  let portfolioValue   = liquidAssets;
  const capitalCostBasis = Math.max(0, portfolioValue);

  const snapshots = [];
  let cumulativeRentPaid = 0;

  for (let year = 1; year <= horizonYears; year++) {
    const currentMonthlyIncome   = monthlyIncome   * Math.pow(1 + incomeGrowthRate,  year - 1);
    const currentMonthlyExpenses = monthlyExpenses * Math.pow(1 + expenseGrowthRate, year - 1);

    const currentYearMonthlyRent = monthlyRent * Math.pow(1 + rentIncreaseRate, year - 1);
    const monthlyHousingCost     = currentYearMonthlyRent + utilityRentMonthly;
    const monthlySurplus         = currentMonthlyIncome - currentMonthlyExpenses - monthlyHousingCost;

    portfolioValue = growOneYear(portfolioValue, portfolioReturn, monthlySurplus);
    cumulativeRentPaid += currentYearMonthlyRent * 12;

    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);
    const totalNetWorth     = portfolioAfterTax;

    const annualTotalSpend     = (currentMonthlyExpenses + monthlyHousingCost) * 12;
    const annualSafeWithdrawal = Math.max(0, portfolioAfterTax) * withdrawalRate;
    const fireAchieved         = portfolioAfterTax > 0 && annualSafeWithdrawal >= annualTotalSpend;
    const firePct              = annualTotalSpend > 0
      ? Math.min(1, annualSafeWithdrawal / annualTotalSpend)
      : 0;

    snapshots.push({
      year,
      portfolioValue:          Math.round(portfolioValue),
      portfolioAfterTax:       Math.round(portfolioAfterTax),
      totalNetWorth:           Math.round(totalNetWorth),
      monthlyHousingCost:      Math.round(monthlyHousingCost),
      monthlySurplus:          Math.round(monthlySurplus),
      currentYearMonthlyRent:  Math.round(currentYearMonthlyRent),
      cumulativeRentPaid:      Math.round(cumulativeRentPaid),
      portfolioInsolvent:      portfolioValue < 0,
      fullyInsolvent:          totalNetWorth < 0,
      currentMonthlyIncome:    Math.round(currentMonthlyIncome),
      currentMonthlyExpenses:  Math.round(currentMonthlyExpenses),
      annualTotalSpend:        Math.round(annualTotalSpend),
      annualSafeWithdrawal:    Math.round(annualSafeWithdrawal),
      fireAchieved,
      firePct,
    });
  }

  return snapshots;
}

/**
 * Find the break-even year (first year buy NW > rent NW).
 */
export function findBreakEven(buySnapshots, rentSnapshots) {
  for (let i = 0; i < buySnapshots.length; i++) {
    if (buySnapshots[i].totalNetWorth > rentSnapshots[i].totalNetWorth) {
      return buySnapshots[i].year;
    }
  }
  return null;
}

/**
 * Merge buy + rent snapshots into a unified chart dataset.
 */
export function buildChartData(buySnapshots, rentSnapshots) {
  return buySnapshots.map((b, i) => ({
    year:              `Yr ${b.year}`,
    yearNum:            b.year,
    buyNetWorth:        b.totalNetWorth,
    rentNetWorth:       rentSnapshots[i].totalNetWorth,
    buyMonthlyHousing:  b.monthlyHousingCost,
    rentMonthlyHousing: rentSnapshots[i].monthlyHousingCost,
    buyEquity:          Math.max(0, b.netEquity),
    buyPortfolio:       b.portfolioAfterTax,
    rentPortfolio:      rentSnapshots[i].portfolioAfterTax,
    buyInsolvent:       b.portfolioInsolvent,
    rentInsolvent:      rentSnapshots[i].portfolioInsolvent,
    buyFirePct:         b.firePct,
    rentFirePct:        rentSnapshots[i].firePct,
    buyFireAchieved:    b.fireAchieved,
    rentFireAchieved:   rentSnapshots[i].fireAchieved,
  }));
}
