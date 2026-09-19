// Debt Payoff Planner (V8 Epic C2) — pure amortization math, no external deps.

// Standard amortization formula: M = P·r(1+r)^n / ((1+r)^n − 1)
export function calcMonthlyPayment(principal, annualRatePct, termMonths) {
  const r = (annualRatePct || 0) / 100 / 12
  if (!principal || !termMonths) return 0
  if (r === 0) return principal / termMonths
  const f = Math.pow(1 + r, termMonths)
  return principal * r * f / (f - 1)
}

// Month-by-month schedule for a fixed payment amount.
// `extraPayments` is an array of one-time lump sums: { atMonth, amount, mode }.
//   mode 'tenure' — payment stays the same, loan just finishes sooner.
//   mode 'emi'    — payment is recalculated lower over the original remaining
//                   term (`termMonths`, the loan's original total term), so the
//                   payoff date stays put but future installments shrink.
// Stops early (stalled=true) if the payment doesn't even cover interest, instead
// of looping forever.
export function generateSchedule(principal, annualRatePct, monthlyPayment, opts = {}) {
  const { maxMonths = 600, extraPayments = [], termMonths = null } = opts
  const r = (annualRatePct || 0) / 100 / 12
  let balance = principal
  let payment = monthlyPayment
  const schedule = []
  let stalled = false
  const extraByMonth = new Map((extraPayments || []).map(e => [e.atMonth, e]))

  for (let month = 1; month <= maxMonths && balance > 0.01; month++) {
    const interest = balance * r
    let principalPaid = payment - interest
    if (principalPaid <= 0) { stalled = true; break }
    if (principalPaid > balance) principalPaid = balance
    balance -= principalPaid
    let extraApplied = 0
    const extra = extraByMonth.get(month)
    if (extra && balance > 0.01) {
      extraApplied = Math.min(extra.amount || 0, balance)
      balance -= extraApplied
      if (extra.mode === 'emi' && termMonths) {
        const remainingMonths = Math.max(1, termMonths - month)
        payment = calcMonthlyPayment(balance, annualRatePct, remainingMonths)
      }
    }
    schedule.push({ month, payment: principalPaid + interest, interest, principalPaid, extraApplied, balance })
  }
  return { schedule, stalled, payoffMonths: schedule.length }
}

export function totalInterest(schedule) {
  return schedule.reduce((s, row) => s + row.interest, 0)
}

// Preview effect of adding one more one-time extra payment on top of whatever's
// already recorded, without mutating anything — used to show a live before/after
// while the user is still picking an amount and mode.
export function previewExtraPayment(principal, annualRatePct, monthlyPayment, termMonths, existingExtras, candidate) {
  const baseline  = generateSchedule(principal, annualRatePct, monthlyPayment, { extraPayments: existingExtras, termMonths })
  const withExtra = generateSchedule(principal, annualRatePct, monthlyPayment, { extraPayments: [...existingExtras, candidate], termMonths })
  return {
    monthsSaved:   Math.max(0, baseline.payoffMonths - withExtra.payoffMonths),
    interestSaved: Math.max(0, totalInterest(baseline.schedule) - totalInterest(withExtra.schedule)),
    newPayment:    withExtra.schedule[candidate.atMonth]?.payment ?? monthlyPayment,
  }
}
