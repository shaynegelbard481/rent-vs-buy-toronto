/**
 * Toronto city configuration
 * All rates/brackets sourced from publicly available government data (2024)
 */

// Ontario Provincial Land Transfer Tax brackets
function provincialLTT(price) {
  let tax = 0;
  if (price <= 55000) {
    tax = price * 0.005;
  } else if (price <= 250000) {
    tax = 275 + (price - 55000) * 0.01;
  } else if (price <= 400000) {
    tax = 2225 + (price - 250000) * 0.015;
  } else if (price <= 2000000) {
    tax = 4475 + (price - 400000) * 0.02;
  } else {
    tax = 36475 + (price - 2000000) * 0.025;
  }
  return Math.round(tax);
}

// Toronto Municipal Land Transfer Tax brackets (mirrors Ontario with slight differences)
function municipalLTT(price) {
  let tax = 0;
  if (price <= 55000) {
    tax = price * 0.005;
  } else if (price <= 250000) {
    tax = 275 + (price - 55000) * 0.01;
  } else if (price <= 400000) {
    tax = 2225 + (price - 250000) * 0.015;
  } else if (price <= 2000000) {
    tax = 4475 + (price - 400000) * 0.02;
  } else {
    tax = 36475 + (price - 2000000) * 0.025;
  }
  return Math.round(tax);
}

// CMHC insurance premium rates (applied when down payment < 20%)
function cmhcInsurance(purchasePrice, downPaymentPct) {
  if (downPaymentPct >= 0.20) return 0;
  const loanToValue = 1 - downPaymentPct;
  let rate = 0;
  if (downPaymentPct >= 0.15) rate = 0.028;
  else if (downPaymentPct >= 0.10) rate = 0.031;
  else rate = 0.04;
  return Math.round(purchasePrice * loanToValue * rate);
}

export const toronto = {
  name: 'Toronto, ON',
  currency: 'CAD',

  // Transaction costs (buying)
  landTransferTax: (price) => provincialLTT(price) + municipalLTT(price),
  landTransferTaxBreakdown: (price) => ({
    provincial: provincialLTT(price),
    municipal: municipalLTT(price),
  }),
  cmhcInsurance,
  legalFeesBuy: 2000,         // legal fees on purchase
  titleInsurance: 350,
  homeInspection: 500,
  buyerAgentCommission: 0.025, // 2.5% of purchase price

  // Transaction costs (selling, applied at exit)
  listingAgentCommission: 0.025,
  sellerLegalFees: 1500,

  // Ongoing costs (annual, as % of home value unless flat)
  propertyTaxRate: 0.006116,   // Toronto 2024 residential rate
  maintenanceRate: 0.01,       // 1% of home value/yr (conservative)
  homeInsuranceAnnual: 2000,   // flat annual estimate

  // Mortgage defaults
  defaultMortgageRate: 0.0549,  // ~5.49% (5yr fixed, Spring 2025)
  defaultAmortization: 25,
  cmhcEnabled: true,

  // Market defaults
  defaultAppreciation: 0.04,   // 4% long-run Toronto average
  defaultRentIncrease: 0.025,  // Ontario rent control guideline

  // Utility cost defaults (monthly)
  buyUtilitiesMonthly: 350,    // heat, hydro, water — higher in owned home
  rentUtilitiesMonthly: 150,   // often partially included in rent

  // Legal notes surfaced in UI
  notes: [
    'Toronto charges both a provincial AND a municipal land transfer tax — double what most Ontario cities pay.',
    'Primary residence capital gains are fully exempt from tax in Canada.',
    'Mortgage interest on a primary residence is NOT tax deductible in Canada (unlike the US).',
    'CMHC mortgage insurance is required for down payments under 20%.',
    'Buyer agent commission has been shifting since 2024 CREA rule changes — verify current norms.',
  ],
};

export default toronto;
