/**
 * Net worth projection engine
 * Pure functions — takes a full scenario config, returns year-by-year projections.
 */

import { monthlyPayment, remainingBalance } from './mortgage.js';

function growOneYear(value, annualReturn, monthlyContribution = 0) {
  const r = annualReturn / 12;
  for (let m = 0; m < 12; m++) {
    value = value * (1 + r) + monthlyContribution;
  }
  return value;
}

function afterTaxPortfolio(currentValue, costBasis, marginalRate, accountType) {
  if (currentValue <= 0) return currentValue;
  const gain = Math.max(0, currentValue - costBasis);
  if (accountType === 'tfsa') return currentValue;
  if (accountType === 'rrsp') return currentValue * (1 - marginalRate);
  const taxOwed = gain * 0.5 * marginalRate;
  return currentValue - taxOwed;
}

export function projectBuyScenario(params, cityConfig) {
  const {
    purchasePrice, downPaymentPct, mortgageRate, amortizationYears,
    appreciationRate, portfolioReturn, marginalRate, accountType,
    monthlyIncome, monthlyExpenses, condoFeesMonthly, utilityBuyMonthly,
    renovationBudget, renovationValueAddPct, renovationSplit, horizonYears,
    incomeGrowthRate = 0, expenseGrowthRate = 0, withdrawalRate = 0.04,
  } = params;

  const legalFeesBuy       = params.legalFeesBuy              ?? cityConfig.legalFeesBuy;
  const titleInsurance      = params.titleInsurance             ?? cityConfig.titleInsurance;
  const homeInspection      = params.homeInspection             ?? cityConfig.homeInspection;
  const buyerAgentPct       = params.buyerAgentCommissionPct    ?? cityConfig.buyerAgentCommission;
  const listingAgentPct     = params.listingAgentCommissionPct  ?? cityConfig.listingAgentCommission;
  const buyerAgentAtSalePct = params.buyerAgentCommissionAtSalePct ?? cityConfig.buyerAgentCommission;
  const sellerLegalFees     = params.sellerLegalFees            ?? cityConfig.sellerLegalFees;

  const renovSplit = (renovationSplit?.length > 0) ? renovationSplit : [{ year: 1, pct: 100 }];
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
    legalFeesBuy + titleInsurance + homeInspection +
    buyerAgentPct * purchasePrice;

  const mortgagePayment = monthlyPayment(loanAmount, mortgageRate, amortizationYears);

  let portfolioValue   = params.liquidAssets - downPayment - closingCosts;
  const capitalCostBasis = Math.max(0, portfolioValue);

  const snapshots = [];
  let cumulativeRenovSpend = 0;
  let totalOngoingPaid = 0;

  for (let year = 1; year <= horizonYears; year++) {
    const isExitYear = year === horizonYears;
    const currentMonthlyIncome   = monthlyIncome   * Math.pow(1 + incomeGrowthRate,  year - 1);
    const currentMonthlyExpenses = monthlyExpenses * Math.pow(1 + expenseGrowthRate, year - 1);

    const homeValue      = purchasePrice * Math.pow(1 + appreciationRate, year);
    const renovThisYear  = renovByYear[year] || 0;
    cumulativeRenovSpend += renovThisYear;

    const renovationEquity   = renovationBudget > 0 ? cumulativeRenovSpend * (renovationValueAddPct / 100) : 0;
    const homeValueWithRenov = homeValue + renovationEquity;
    const mortgageBalance    = remainingBalance(loanAmount, mortgageRate, amortizationYears, year * 12);
    const grossEquity        = homeValueWithRenov - mortgageBalance;

    // Selling costs computed every year for FIRE "what if I sold today" — but only
    // deducted from NW at the exit year (you don't pay them until you actually sell).
    const sellingCosts = (listingAgentPct + buyerAgentAtSalePct) * homeValueWithRenov + sellerLegalFees;
    const netEquityIfSoldNow = Math.max(0, grossEquity - sellingCosts);

    // Ongoing NW: deduct selling costs only at exit; intermediate years use gross equity
    const netEquityForNW = isExitYear ? netEquityIfSoldNow : grossEquity;

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
    const totalNetWorth     = netEquityForNW + portfolioAfterTax;

    // FIRE: assume home is sold at this year and proceeds invested alongside portfolio.
    // Annual spend = living expenses only (housing cost goes away post-sale).
    const fireInvestable       = Math.max(0, portfolioAfterTax) + netEquityIfSoldNow;
    const fireAnnualSpend      = currentMonthlyExpenses * 12;
    const annualSafeWithdrawal = fireInvestable * withdrawalRate;
    const fireAchieved         = annualSafeWithdrawal >= fireAnnualSpend && fireAnnualSpend > 0;
    const firePct              = fireAnnualSpend > 0 ? Math.min(1, annualSafeWithdrawal / fireAnnualSpend) : 0;

    const totalHousingCash = closingCosts + downPayment + mortgagePayment * year * 12 + totalOngoingPaid + cumulativeRenovSpend;

    snapshots.push({
      year, homeValue: Math.round(homeValueWithRenov),
      mortgageBalance: Math.round(mortgageBalance),
      grossEquity: Math.round(grossEquity),
      netEquity: Math.round(netEquityForNW),
      netEquityIfSoldNow: Math.round(netEquityIfSoldNow),
      portfolioValue: Math.round(portfolioValue),
      portfolioAfterTax: Math.round(portfolioAfterTax),
      totalNetWorth: Math.round(totalNetWorth),
      monthlyHousingCost: Math.round(monthlyHousingCost),
      monthlySurplus: Math.round(monthlySurplus),
      totalHousingCash: Math.round(totalHousingCash),
      mortgagePaymentMonthly: Math.round(mortgagePayment),
      propertyTaxMonthly: Math.round(annualPropertyTax / 12),
      maintenanceMonthly: Math.round(annualMaintenance / 12),
      insuranceMonthly: Math.round(annualInsurance / 12),
      condoFeesMonthly: Math.round(annualCondo / 12),
      utilityMonthly: Math.round(annualUtilities / 12),
      annualPropertyTax: Math.round(annualPropertyTax),
      annualMaintenance: Math.round(annualMaintenance),
      sellingCosts: Math.round(sellingCosts),
      portfolioInsolvent: portfolioValue < 0,
      fullyInsolvent: totalNetWorth < 0,
      currentMonthlyIncome: Math.round(currentMonthlyIncome),
      currentMonthlyExpenses: Math.round(currentMonthlyExpenses),
      // FIRE (assumes home sold, proceeds invested)
      fireInvestable: Math.round(fireInvestable),
      fireAnnualSpend: Math.round(fireAnnualSpend),
      annualSafeWithdrawal: Math.round(annualSafeWithdrawal),
      fireAchieved, firePct,
    });
  }

  return snapshots;
}

export function projectRentScenario(params, cityConfig) {
  const {
    monthlyRent, rentIncreaseRate, portfolioReturn, marginalRate, accountType,
    monthlyIncome, monthlyExpenses, utilityRentMonthly, horizonYears, liquidAssets,
    incomeGrowthRate = 0, expenseGrowthRate = 0, withdrawalRate = 0.04,
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

    // FIRE: no home to sell; investable = liquid portfolio only.
    // Use same living-expenses-only spend for fair comparison with buy.
    const fireInvestable       = Math.max(0, portfolioAfterTax);
    const fireAnnualSpend      = currentMonthlyExpenses * 12;
    const annualSafeWithdrawal = fireInvestable * withdrawalRate;
    const fireAchieved         = annualSafeWithdrawal >= fireAnnualSpend && fireAnnualSpend > 0;
    const firePct              = fireAnnualSpend > 0 ? Math.min(1, annualSafeWithdrawal / fireAnnualSpend) : 0;

    snapshots.push({
      year,
      portfolioValue: Math.round(portfolioValue),
      portfolioAfterTax: Math.round(portfolioAfterTax),
      totalNetWorth: Math.round(totalNetWorth),
      monthlyHousingCost: Math.round(monthlyHousingCost),
      monthlySurplus: Math.round(monthlySurplus),
      currentYearMonthlyRent: Math.round(currentYearMonthlyRent),
      cumulativeRentPaid: Math.round(cumulativeRentPaid),
      portfolioInsolvent: portfolioValue < 0,
      fullyInsolvent: totalNetWorth < 0,
      currentMonthlyIncome: Math.round(currentMonthlyIncome),
      currentMonthlyExpenses: Math.round(currentMonthlyExpenses),
      fireInvestable: Math.round(fireInvestable),
      fireAnnualSpend: Math.round(fireAnnualSpend),
      annualSafeWithdrawal: Math.round(annualSafeWithdrawal),
      fireAchieved, firePct,
    });
  }

  return snapshots;
}

export function findBreakEven(buySnapshots, rentSnapshots) {
  for (let i = 0; i < buySnapshots.length; i++) {
    if (buySnapshots[i].totalNetWorth > rentSnapshots[i].totalNetWorth) {
      return buySnapshots[i].year;
    }
  }
  return null;
}

export function buildChartData(buySnapshots, rentSnapshots) {
  return buySnapshots.map((b, i) => ({
    year: `Yr ${b.year}`, yearNum: b.year,
    buyNetWorth:        b.totalNetWorth,
    rentNetWorth:       rentSnapshots[i].totalNetWorth,
    buyMonthlyHousing:  b.monthlyHousingCost,
    rentMonthlyHousing: rentSnapshots[i].monthlyHousingCost,
    buyEquity:          Math.max(0, b.grossEquity),  // gross equity for chart (no selling cost drag)
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
