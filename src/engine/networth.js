/**
 * Net worth projection engine
 * Pure functions — takes a full scenario config, returns year-by-year projections.
 */

import { monthlyPayment, remainingBalance } from './mortgage.js';

/**
 * Grow an investment portfolio month by month, with optional monthly contributions.
 * Applies capital gains tax on realized gains at the end (simplified: tax at terminal value).
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
 * Applies capital gains tax on the gain portion only.
 * Canada: 50% inclusion rate × marginal rate for taxable accounts.
 * TFSA: no tax. RRSP: modelled as income tax on full withdrawal at retirement rate.
 */
function afterTaxPortfolio(currentValue, costBasis, marginalRate, accountType) {
  const gain = Math.max(0, currentValue - costBasis);
  if (accountType === 'tfsa') return currentValue;
  if (accountType === 'rrsp') {
    // Assume withdrawal at same marginal rate (conservative)
    return currentValue * (1 - marginalRate);
  }
  // Taxable: 50% inclusion
  const taxOwed = gain * 0.5 * marginalRate;
  return currentValue - taxOwed;
}

/**
 * Project the BUY scenario year by year over horizonYears.
 *
 * @param {Object} params
 * @param {Object} cityConfig - City-specific tax/cost config
 * @returns {Array} Array of annual snapshots
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
    monthlyRent,          // not used in buy, but passed for cash flow delta calc
    monthlyIncome,
    monthlyExpenses,      // non-housing expenses
    condoFeesMonthly,
    utilityBuyMonthly,
    renovationBudget,
    renovationValueAddPct,
    renovationSplit,
    horizonYears,
  } = params;

  // Build per-year renovation spend from split array
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

  // Upfront closing costs (not recoverable)
  const closingCosts =
    cityConfig.landTransferTax(purchasePrice) +
    cityConfig.legalFeesBuy +
    cityConfig.titleInsurance +
    cityConfig.homeInspection +
    cityConfig.buyerAgentCommission * purchasePrice;

  const mortgagePayment = monthlyPayment(loanAmount, mortgageRate, amortizationYears);

  // Remaining liquid capital after down payment + closing costs
  const remainingCapital = Math.max(0, params.liquidAssets - downPayment - closingCosts);
  const capitalCostBasis = remainingCapital;

  const snapshots = [];

  for (let year = 1; year <= horizonYears; year++) {
    const months = year * 12;

    // Home value with appreciation
    let homeValue = purchasePrice * Math.pow(1 + appreciationRate, year);

    // Renovation value-add: cumulative across all years spent so far
    let cumulativeRenovSpend = 0;
    for (let y = 1; y <= year; y++) cumulativeRenovSpend += (renovByYear[y] || 0);
    const renovationEquity = cumulativeRenovSpend * (renovationValueAddPct / 100);
    if (renovationBudget > 0) homeValue += renovationEquity;

    // Mortgage balance
    const mortgageBalance = remainingBalance(loanAmount, mortgageRate, amortizationYears, months);

    // Selling costs at exit (only in final year for net proceeds calc, but we show gross equity too)
    const sellingCosts =
      cityConfig.listingAgentCommission * homeValue +
      cityConfig.buyerAgentCommission * homeValue +
      cityConfig.sellerLegalFees;

    const grossEquity = homeValue - mortgageBalance;
    const netEquity = grossEquity - sellingCosts; // what you'd actually pocket

    // Ongoing annual costs (property tax, maintenance, insurance, condo, utilities)
    const annualPropertyTax = homeValue * cityConfig.propertyTaxRate;
    const annualMaintenance = purchasePrice * cityConfig.maintenanceRate;
    const annualInsurance = cityConfig.homeInsuranceAnnual;
    const annualCondo = (condoFeesMonthly || 0) * 12;
    const annualUtilities = utilityBuyMonthly * 12;

    const totalAnnualOngoing =
      annualPropertyTax + annualMaintenance + annualInsurance + annualCondo + annualUtilities;

    // Monthly housing cost (mortgage + 1/12 of annual ongoing costs)
    const monthlyHousingCost = mortgagePayment + totalAnnualOngoing / 12;

    // Monthly surplus/deficit vs. income (invested if positive)
    const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyHousingCost;
    const monthlyInvestment = Math.max(0, monthlySurplus);

    // Investment portfolio: remaining capital + monthly surplus invested
    const portfolioValue = growPortfolio(remainingCapital, portfolioReturn, months, monthlyInvestment);
    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);

    // Total net worth: after-tax home equity (tax-free in Canada) + after-tax portfolio
    const totalNetWorth = netEquity + portfolioAfterTax;

    // Total cash spent on housing over this period
    const totalMortgagePaid = mortgagePayment * months;
    const totalOngoingPaid = totalAnnualOngoing * year;
    const totalHousingCash = closingCosts + downPayment + totalMortgagePaid + totalOngoingPaid + cumulativeRenovSpend;

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
    // For fair comparison: same liquid assets as buy scenario
    liquidAssets,
    // Reference: what the buy scenario would have spent on down payment + closing
    // (these stay invested in rent scenario)
    purchasePrice,
    downPaymentPct,
    mortgageRate,
    amortizationYears,
    condoFeesMonthly,
  } = params;

  const cityConfig_ = cityConfig;
  const downPayment = purchasePrice * downPaymentPct;
  const cmhc = cityConfig_.cmhcInsurance(purchasePrice, downPaymentPct);
  const closingCosts =
    cityConfig_.landTransferTax(purchasePrice) +
    cityConfig_.legalFeesBuy +
    cityConfig_.titleInsurance +
    cityConfig_.homeInspection +
    cityConfig_.buyerAgentCommission * purchasePrice;

  // In rent scenario, ALL liquid assets stay invested
  const investedCapital = liquidAssets;
  const capitalCostBasis = investedCapital;

  const snapshots = [];

  for (let year = 1; year <= horizonYears; year++) {
    const months = year * 12;

    // Rent grows each year
    let cumulativeRentPaid = 0;
    let currentMonthlyRent = monthlyRent;
    for (let y = 1; y <= year; y++) {
      cumulativeRentPaid += currentMonthlyRent * 12;
      currentMonthlyRent *= (1 + rentIncreaseRate);
    }
    const currentYearMonthlyRent = monthlyRent * Math.pow(1 + rentIncreaseRate, year - 1);
    const monthlyUtilities = utilityRentMonthly;
    const monthlyHousingCost = currentYearMonthlyRent + monthlyUtilities;

    // Monthly surplus invested
    const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyHousingCost;
    const monthlyInvestment = Math.max(0, monthlySurplus);

    // Portfolio grows with full capital + monthly contributions
    const portfolioValue = growPortfolio(investedCapital, portfolioReturn, months, monthlyInvestment);
    const portfolioAfterTax = afterTaxPortfolio(portfolioValue, capitalCostBasis, marginalRate, accountType);

    // Total net worth = just the portfolio (no real estate)
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
    });
  }

  return snapshots;
}

/**
 * Find the break-even year (first year buy NW > rent NW)
 */
export function findBreakEven(buySnapshots, rentSnapshots) {
  for (let i = 0; i < buySnapshots.length; i++) {
    if (buySnapshots[i].totalNetWorth > rentSnapshots[i].totalNetWorth) {
      return buySnapshots[i].year;
    }
  }
  return null; // never breaks even in horizon
}

/**
 * Merge buy + rent snapshots into a unified chart dataset
 */
export function buildChartData(buySnapshots, rentSnapshots) {
  return buySnapshots.map((b, i) => ({
    year: `Yr ${b.year}`,
    yearNum: b.year,
    buyNetWorth: b.totalNetWorth,
    rentNetWorth: rentSnapshots[i].totalNetWorth,
    buyMonthlyHousing: b.monthlyHousingCost,
    rentMonthlyHousing: rentSnapshots[i].monthlyHousingCost,
    buyEquity: b.netEquity,
    buyPortfolio: b.portfolioAfterTax,
    rentPortfolio: rentSnapshots[i].portfolioAfterTax,
  }));
}
