/**
 * Net worth projection engine
 * Pure functions — takes a full scenario config, returns year-by-year projections.
 */

import { monthlyPayment, remainingBalance } from './mortgage.js';

/**
 * Grow a portfolio month by month with a constant monthly cash flow.
 * monthlyContribution can be negative (drawdown).
 * Returns the raw value — can go negative, representing debt.
 */
function growPortfolio(initialValue, annualReturn, months, monthlyContribution = 0) {
  const r = annualReturn / 12;
  let value = initialValue;
  for (let m = 0; m < months; m++) {
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

  // Remaining liquid capital after down payment + closing costs
  // Can be zero — if closing costs exceed liquid assets, they're funded by debt (negative start)
  const remainingCapital = params.liquidAssets - downPayment - closingCosts;
  const capitalCostBasis = Math.max(0, remainingCapital);

  const snapshots = [];

  for (let year = 1; year <= horizonYears; year++) {
    const months = year * 12;

    let homeValue = purchasePrice * Math.pow(1 + appreciationRate, year);

    let cumulativeRenovSpend = 0;
    for (let y = 1; y <= year; y++) cumulativeRenovSpend += (renovByYear[y] || 0);
    const renovationEquity = cumulativeRenovSpend * (renovationValueAddPct / 100);
    if (renovationBudget > 0) homeValue += renovationEquity;

    const mortgageBalance = remainingBalance(loanAmount, mortgageRate, amortizationYears, months);

    const sellingCosts =
      cityConfig.listingAgentCommission * homeValue +
      cityConfig.buyerAgentCommission * homeValue +
      cityConfig.sellerLegalFees;

    const grossEquity = homeValue - mortgageBalance;
    const netEquity = grossEquity - sellingCosts;

    const annualPropertyTax = homeValue * cityConfig.propertyTaxRate;
    const annualMaintenance = purchasePrice * cityConfig.maintenanceRate;
    const annualInsurance = cityConfig.homeInsuranceAnnual;
    const annualCondo = (condoFeesMonthly || 0) * 12;
    const annualUtilities = utilityBuyMonthly * 12;
    const totalAnnualOngoing = annualPropertyTax + annualMaintenance + annualInsurance + annualCondo + annualUtilities;

    const monthlyHousingCost = mortgagePayment + totalAnnualOngoing / 12;

    // Net monthly cash flow — negative means drawing from portfolio (or taking on debt)
    const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyHousingCost;

    // Portfolio: surplus invested, shortfall drawn down. Can go negative (debt).
    const portfolioValue = growPortfolio(remainingCapital, portfolioReturn, months, monthlySurplus);
    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);

    // Total net worth: home equity + portfolio (portfolio may be negative)
    const totalNetWorth = netEquity + portfolioAfterTax;

    const totalMortgagePaid = mortgagePayment * months;
    const totalOngoingPaid = totalAnnualOngoing * year;
    const totalHousingCash = closingCosts + downPayment + totalMortgagePaid + totalOngoingPaid + cumulativeRenovSpend;

    // Flag when portfolio has been fully depleted (unsustainable without selling assets)
    const portfolioInsolvent = portfolioValue < 0;
    const fullyInsolvent = totalNetWorth < 0;

    snapshots.push({
      year,
      homeValue: Math.round(homeValue),
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
      portfolioInsolvent,
      fullyInsolvent,
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

  const investedCapital = liquidAssets;
  const capitalCostBasis = Math.max(0, investedCapital);

  const snapshots = [];

  for (let year = 1; year <= horizonYears; year++) {
    const months = year * 12;

    const currentYearMonthlyRent = monthlyRent * Math.pow(1 + rentIncreaseRate, year - 1);
    const monthlyHousingCost = currentYearMonthlyRent + utilityRentMonthly;

    // Net monthly cash flow — negative means drawing from portfolio
    const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyHousingCost;

    // Portfolio: can go negative if rent + expenses exceed income + savings
    const portfolioValue = growPortfolio(investedCapital, portfolioReturn, months, monthlySurplus);
    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);

    const totalNetWorth = portfolioAfterTax;

    // Cumulative rent paid (for reference)
    let cumulativeRentPaid = 0;
    for (let y = 0; y < year; y++) {
      cumulativeRentPaid += monthlyRent * Math.pow(1 + rentIncreaseRate, y) * 12;
    }

    const portfolioInsolvent = portfolioValue < 0;
    const fullyInsolvent = totalNetWorth < 0;

    snapshots.push({
      year,
      portfolioValue: Math.round(portfolioValue),
      portfolioAfterTax: Math.round(portfolioAfterTax),
      totalNetWorth: Math.round(totalNetWorth),
      monthlyHousingCost: Math.round(monthlyHousingCost),
      monthlySurplus: Math.round(monthlySurplus),
      currentYearMonthlyRent: Math.round(currentYearMonthlyRent),
      cumulativeRentPaid: Math.round(cumulativeRentPaid),
      portfolioInsolvent,
      fullyInsolvent,
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
    buyPortfolio: b.portfolioAfterTax,
    rentPortfolio: rentSnapshots[i].portfolioAfterTax,
    buyInsolvent: b.portfolioInsolvent,
    rentInsolvent: rentSnapshots[i].portfolioInsolvent,
  }));
}
