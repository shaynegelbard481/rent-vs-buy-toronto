/**
 * Net worth projection engine
 * Pure functions — takes a full scenario config, returns year-by-year projections.
 */

import { monthlyPayment, remainingBalance } from './mortgage.js';

/**
 * Grow a portfolio for exactly 12 months with a constant monthly cash flow.
 * Used for incremental year-by-year simulation so lump-sum events can be
 * injected between years. monthlyContribution can be negative (drawdown).
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
  if (currentValue <= 0) return currentValue; // debt — no tax benefit modelled
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
  } = params;

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
  const cmhc = cityConfig.cmhcInsurance(purchasePrice, downPaymentPct);
  const loanAmount = purchasePrice - downPayment + cmhc;

  const closingCosts =
    cityConfig.landTransferTax(purchasePrice) +
    cityConfig.legalFeesBuy +
    cityConfig.titleInsurance +
    cityConfig.homeInspection +
    cityConfig.buyerAgentCommission * purchasePrice;

  const mortgagePayment = monthlyPayment(loanAmount, mortgageRate, amortizationYears);

  // Starting portfolio: liquid assets minus down payment and closing costs
  let portfolioValue = params.liquidAssets - downPayment - closingCosts;
  const capitalCostBasis = Math.max(0, portfolioValue);

  const snapshots = [];
  let cumulativeRenovSpend = 0;
  let totalOngoingPaid = 0;

  for (let year = 1; year <= horizonYears; year++) {
    const homeValue = purchasePrice * Math.pow(1 + appreciationRate, year);

    // Renovation spend this year — deducted from portfolio as a lump sum
    const renovThisYear = renovByYear[year] || 0;
    cumulativeRenovSpend += renovThisYear;

    const renovationEquity = renovationBudget > 0
      ? cumulativeRenovSpend * (renovationValueAddPct / 100)
      : 0;
    const homeValueWithRenov = homeValue + renovationEquity;

    const mortgageBalance = remainingBalance(loanAmount, mortgageRate, amortizationYears, year * 12);

    const sellingCosts =
      cityConfig.listingAgentCommission * homeValueWithRenov +
      cityConfig.buyerAgentCommission * homeValueWithRenov +
      cityConfig.sellerLegalFees;

    const grossEquity = homeValueWithRenov - mortgageBalance;
    const netEquity = grossEquity - sellingCosts;

    const annualPropertyTax = homeValueWithRenov * cityConfig.propertyTaxRate;
    const annualMaintenance = purchasePrice * cityConfig.maintenanceRate;
    const annualInsurance = cityConfig.homeInsuranceAnnual;
    const annualCondo = (condoFeesMonthly || 0) * 12;
    const annualUtilities = utilityBuyMonthly * 12;
    const totalAnnualOngoing = annualPropertyTax + annualMaintenance + annualInsurance + annualCondo + annualUtilities;
    totalOngoingPaid += totalAnnualOngoing;

    const monthlyHousingCost = mortgagePayment + totalAnnualOngoing / 12;
    const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyHousingCost;

    // Grow portfolio for this year's monthly cash flow, then deduct renovation lump sum
    portfolioValue = growOneYear(portfolioValue, portfolioReturn, monthlySurplus);
    portfolioValue -= renovThisYear;

    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);
    const totalNetWorth = netEquity + portfolioAfterTax;

    const totalHousingCash = closingCosts + downPayment + mortgagePayment * year * 12 + totalOngoingPaid + cumulativeRenovSpend;

    snapshots.push({
      year,
      homeValue: Math.round(homeValueWithRenov),
      mortgageBalance: Math.round(mortgageBalance),
      grossEquity: Math.round(grossEquity),
      netEquity: Math.round(netEquity),
      portfolioValue: Math.round(portfolioValue),
      portfolioAfterTax: Math.round(portfolioAfterTax),
      totalNetWorth: Math.round(totalNetWorth),
      monthlyHousingCost: Math.round(monthlyHousingCost),
      monthlySurplus: Math.round(monthlySurplus),
      totalHousingCash: Math.round(totalHousingCash),
      annualPropertyTax: Math.round(annualPropertyTax),
      annualMaintenance: Math.round(annualMaintenance),
      sellingCosts: Math.round(sellingCosts),
      portfolioInsolvent: portfolioValue < 0,
      fullyInsolvent: totalNetWorth < 0,
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
  } = params;

  let portfolioValue = liquidAssets;
  const capitalCostBasis = Math.max(0, portfolioValue);

  const snapshots = [];
  let cumulativeRentPaid = 0;

  for (let year = 1; year <= horizonYears; year++) {
    const currentYearMonthlyRent = monthlyRent * Math.pow(1 + rentIncreaseRate, year - 1);
    const monthlyHousingCost = currentYearMonthlyRent + utilityRentMonthly;
    const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyHousingCost;

    portfolioValue = growOneYear(portfolioValue, portfolioReturn, monthlySurplus);
    cumulativeRentPaid += currentYearMonthlyRent * 12;

    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);
    const totalNetWorth = portfolioAfterTax;

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
    });
  }

  return snapshots;
}

/**
 * Find the break-even year (first year buy NW > rent NW).
 * Only meaningful if neither scenario is insolvent at that year.
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
    year: `Yr ${b.year}`,
    yearNum: b.year,
    buyNetWorth: b.totalNetWorth,
    rentNetWorth: rentSnapshots[i].totalNetWorth,
    buyMonthlyHousing: b.monthlyHousingCost,
    rentMonthlyHousing: rentSnapshots[i].monthlyHousingCost,
    buyEquity: Math.max(0, b.netEquity),
    buyPortfolio: b.portfolioAfterTax,      // can be negative
    rentPortfolio: rentSnapshots[i].portfolioAfterTax,
    buyInsolvent: b.portfolioInsolvent,
    rentInsolvent: rentSnapshots[i].portfolioInsolvent,
  }));
}
