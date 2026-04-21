/**
 * Mortgage calculation utilities
 * All functions are pure — no side effects, fully testable.
 */

/**
 * Monthly mortgage payment (standard amortization formula)
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate (e.g. 0.0549)
 * @param {number} amortizationYears - Total amortization in years
 * @returns {number} Monthly payment
 */
export function monthlyPayment(principal, annualRate, amortizationYears) {
  if (annualRate === 0) return principal / (amortizationYears * 12);
  // Canada uses semi-annual compounding by convention
  const effectiveMonthlyRate = Math.pow(1 + annualRate / 2, 1 / 6) - 1;
  const n = amortizationYears * 12;
  return (
    (principal * effectiveMonthlyRate * Math.pow(1 + effectiveMonthlyRate, n)) /
    (Math.pow(1 + effectiveMonthlyRate, n) - 1)
  );
}

/**
 * Remaining mortgage balance at a given month
 */
export function remainingBalance(principal, annualRate, amortizationYears, monthsElapsed) {
  if (annualRate === 0) {
    return Math.max(0, principal - (principal / (amortizationYears * 12)) * monthsElapsed);
  }
  const r = Math.pow(1 + annualRate / 2, 1 / 6) - 1;
  const n = amortizationYears * 12;
  const payment = monthlyPayment(principal, annualRate, amortizationYears);
  return (
    principal * Math.pow(1 + r, monthsElapsed) -
    payment * ((Math.pow(1 + r, monthsElapsed) - 1) / r)
  );
}

/**
 * Total interest paid over a period
 */
export function totalInterestPaid(principal, annualRate, amortizationYears, months) {
  const payment = monthlyPayment(principal, annualRate, amortizationYears);
  const totalPaid = payment * months;
  const principalPaid = principal - remainingBalance(principal, annualRate, amortizationYears, months);
  return totalPaid - principalPaid;
}

/**
 * Build a full amortization schedule (monthly)
 */
export function amortizationSchedule(principal, annualRate, amortizationYears) {
  const r = Math.pow(1 + annualRate / 2, 1 / 6) - 1;
  const payment = monthlyPayment(principal, annualRate, amortizationYears);
  const months = amortizationYears * 12;
  let balance = principal;
  const schedule = [];

  for (let m = 1; m <= months; m++) {
    const interestPortion = balance * r;
    const principalPortion = payment - interestPortion;
    balance = Math.max(0, balance - principalPortion);
    schedule.push({
      month: m,
      payment,
      principal: principalPortion,
      interest: interestPortion,
      balance,
    });
  }
  return schedule;
}
