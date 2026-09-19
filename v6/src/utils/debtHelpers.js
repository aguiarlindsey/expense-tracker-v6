// Debt Payoff Planner (V8 Epic C2) — pure amortization math, no external deps.

// Standard amortization formula: M = P·r(1+r)^n / ((1+r)^n − 1)
export function calcMonthlyPayment(principal, annualRatePct, termMonths) {
  const r = (annualRatePct || 0) / 100 / 12
  if (!principal || !termMonths) return 0
  if (r === 0) return principal / termMonths
  const f = Math.pow(1 + r, termMonths)
  return principal * r * f / (f - 1)
}

// Month-by-month schedule for a fixed payment amount. Stops early if the
// payment doesn't even cover interest — flagged via the returned `stalled` flag
// so the UI can warn instead of showing a misleading payoff date.
export function generateSchedule(principal, annualRatePct, monthlyPayment, maxMonths = 600) {
  const r = (annualRatePct || 0) / 100 / 12
  let balance = principal
  const schedule = []
  let stalled = false
  for (let month = 1; month <= maxMonths && balance > 0.01; month++) {
    const interest = balance * r
    let principalPaid = monthlyPayment - interest
    if (principalPaid <= 0) { stalled = true; break }
    if (principalPaid > balance) principalPaid = balance
    balance -= principalPaid
    schedule.push({ month, payment: principalPaid + interest, interest, principalPaid, balance })
  }
  return { schedule, stalled, payoffMonths: schedule.length }
}

export function totalInterest(schedule) {
  return schedule.reduce((s, row) => s + row.interest, 0)
}

// Diffs a baseline (minimum payment) schedule against one with extra payment added.
export function simulateExtraPayment(principal, annualRatePct, minimumPayment, extraAmount) {
  const baseline = generateSchedule(principal, annualRatePct, minimumPayment)
  const faster   = generateSchedule(principal, annualRatePct, minimumPayment + (extraAmount || 0))
  const baselineInterest = totalInterest(baseline.schedule)
  const fasterInterest   = totalInterest(faster.schedule)
  return {
    baseline, faster,
    monthsSaved:   faster.stalled ? 0 : Math.max(0, baseline.payoffMonths - faster.payoffMonths),
    interestSaved: faster.stalled ? 0 : Math.max(0, baselineInterest - fasterInterest),
    baselineInterest, fasterInterest,
  }
}
