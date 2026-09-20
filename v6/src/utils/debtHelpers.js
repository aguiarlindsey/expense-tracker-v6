// Debt Payoff Planner (V8 Epic C2) — pure amortization math, no external deps.
//
// `rateMethod` replicates how different countries' banks actually compute a loan,
// not just a cosmetic label:
//   'monthly'  — flat annual/12 per period. Standard for US/most conventional loans.
//   'daily'    — interest accrued on the actual outstanding balance for the actual
//                number of days in each calendar month, annual/365 (or /366 in a
//                leap year). Standard for Indian, UK, and Australian home loans.
//                Needs `startDate` to know real calendar days; falls back to
//                'monthly' if it's missing.
//   'canadian' — Canada's Interest Act mandates interest compounded semi-annually
//                even though payments are monthly, so the periodic rate used in
//                the amortization formula is the monthly-equivalent of a
//                semi-annual compounding, not a flat annual/12.

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInYearFor(dateStr) {
  return isLeapYear(new Date(dateStr + 'T12:00:00').getFullYear()) ? 366 : 365
}

function daysInCalendarMonth(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

// The periodic rate applied once per payment, for methods that use a flat
// per-month rate ('monthly', 'canadian'). 'daily' computes interest separately
// per row instead, since it depends on the actual days in that specific month.
function effectiveMonthlyRate(annualRatePct, rateMethod) {
  const i = (annualRatePct || 0) / 100
  if (rateMethod === 'canadian') return Math.pow(1 + i / 2, 1 / 6) - 1
  return i / 12
}

// Standard amortization formula: M = P·r(1+r)^n / ((1+r)^n − 1), using whichever
// periodic rate `rateMethod` implies. 'daily' uses the same nominal-monthly rate
// here — day-count precision affects interest apportionment per month, not the
// fixed installment amount, matching how Indian/UK banks actually set the EMI.
export function calcMonthlyPayment(principal, annualRatePct, termMonths, rateMethod = 'monthly') {
  const r = effectiveMonthlyRate(annualRatePct, rateMethod === 'daily' ? 'monthly' : rateMethod)
  if (!principal || !termMonths) return 0
  if (r === 0) return principal / termMonths
  const f = Math.pow(1 + r, termMonths)
  return principal * r * f / (f - 1)
}

// Month-by-month schedule for a fixed payment amount.
//
// `extraPayments` — one-time lump sums: { atMonth, amount, mode }.
//   mode 'tenure' — payment stays the same, loan just finishes sooner.
//   mode 'emi'    — payment recalculated lower over the original remaining
//                   term (`termMonths`), so the payoff date stays put.
//
// `rateChanges` — one-time rate resets (renegotiation, floating-rate reset):
//   { atMonth, newRate, mode }, same 'tenure'/'emi' choice as above, effective
//   from `atMonth` onward (inclusive — that month's interest already uses it).
//
// Stops early (stalled=true) if the payment doesn't even cover interest,
// instead of looping forever.
export function generateSchedule(principal, annualRatePct, monthlyPayment, opts = {}) {
  const { maxMonths = 600, extraPayments = [], rateChanges = [], termMonths = null, rateMethod = 'monthly', startDate = null } = opts
  let currentRate = annualRatePct
  let balance = principal
  let payment = monthlyPayment
  const schedule = []
  let stalled = false
  const extraByMonth = new Map((extraPayments || []).map(e => [e.atMonth, e]))
  const rateChangeByMonth = new Map((rateChanges || []).map(e => [e.atMonth, e]))
  const useDaily = rateMethod === 'daily' && !!startDate

  for (let month = 1; month <= maxMonths && balance > 0.01; month++) {
    const rateChange = rateChangeByMonth.get(month)
    if (rateChange) {
      currentRate = rateChange.newRate
      if (rateChange.mode === 'emi' && termMonths) {
        const remainingMonths = Math.max(1, termMonths - month + 1)
        payment = calcMonthlyPayment(balance, currentRate, remainingMonths, rateMethod)
      }
    }
    let interest
    if (useDaily) {
      const monthDate = addMonths(startDate, month - 1)
      interest = balance * (currentRate || 0) / 100 / daysInYearFor(monthDate) * daysInCalendarMonth(monthDate)
    } else {
      interest = balance * effectiveMonthlyRate(currentRate, rateMethod)
    }
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
        payment = calcMonthlyPayment(balance, currentRate, remainingMonths, rateMethod)
      }
    }
    schedule.push({ month, payment: principalPaid + interest, interest, principalPaid, extraApplied, rate: currentRate, balance })
  }
  return { schedule, stalled, payoffMonths: schedule.length }
}

export function totalInterest(schedule) {
  return schedule.reduce((s, row) => s + row.interest, 0)
}

// Preview effect of adding one more one-time extra payment on top of whatever's
// already recorded, without mutating anything — used to show a live before/after
// while the user is still picking an amount and mode.
export function previewExtraPayment(principal, annualRatePct, monthlyPayment, termMonths, existingExtras, candidate, rateMethod = 'monthly', startDate = null) {
  const baseline  = generateSchedule(principal, annualRatePct, monthlyPayment, { extraPayments: existingExtras, termMonths, rateMethod, startDate })
  const withExtra = generateSchedule(principal, annualRatePct, monthlyPayment, { extraPayments: [...existingExtras, candidate], termMonths, rateMethod, startDate })
  return {
    monthsSaved:   Math.max(0, baseline.payoffMonths - withExtra.payoffMonths),
    interestSaved: Math.max(0, totalInterest(baseline.schedule) - totalInterest(withExtra.schedule)),
    newPayment:    withExtra.schedule[candidate.atMonth]?.payment ?? monthlyPayment,
  }
}

// Same idea for a rate change — NOT clamped to zero, since a rate increase
// can legitimately cost more months/interest and the preview should show that.
export function previewRateChange(principal, annualRatePct, monthlyPayment, termMonths, existingExtras, existingRateChanges, candidate, rateMethod = 'monthly', startDate = null) {
  const baseline   = generateSchedule(principal, annualRatePct, monthlyPayment, { extraPayments: existingExtras, rateChanges: existingRateChanges, termMonths, rateMethod, startDate })
  const withChange = generateSchedule(principal, annualRatePct, monthlyPayment, { extraPayments: existingExtras, rateChanges: [...existingRateChanges, candidate], termMonths, rateMethod, startDate })
  return {
    monthsSaved:   baseline.payoffMonths - withChange.payoffMonths,
    interestSaved: totalInterest(baseline.schedule) - totalInterest(withChange.schedule),
    newPayment:    withChange.schedule[candidate.atMonth - 1]?.payment ?? monthlyPayment,
  }
}
