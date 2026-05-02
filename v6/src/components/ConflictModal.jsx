import { useState } from 'react'

// Fields to compare per table, with labels and formatters
const FIELD_META = {
  expenses: [
    { key: 'description',    label: 'Description' },
    { key: 'amount',         label: 'Amount',       fmt: v => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { key: 'date',           label: 'Date' },
    { key: 'category',       label: 'Category' },
    { key: 'subcategory',    label: 'Subcategory' },
    { key: 'currency',       label: 'Currency' },
    { key: 'expenseType',    label: 'Expense Type' },
    { key: 'paymentMethod',  label: 'Payment Method' },
    { key: 'notes',          label: 'Notes' },
    { key: 'tags',           label: 'Tags',         fmt: v => (v || []).join(', ') || '—' },
    { key: 'isRecurring',    label: 'Recurring',    fmt: v => v ? 'Yes' : 'No' },
    { key: 'recurringPeriod',label: 'Period' },
    { key: 'budgetCategory', label: 'Budget Cat.' },
  ],
  income: [
    { key: 'description',    label: 'Description' },
    { key: 'amount',         label: 'Amount',       fmt: v => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { key: 'date',           label: 'Date' },
    { key: 'source',         label: 'Source' },
    { key: 'currency',       label: 'Currency' },
    { key: 'paymentMethod',  label: 'Payment Method' },
    { key: 'notes',          label: 'Notes' },
    { key: 'isRecurring',    label: 'Recurring',    fmt: v => v ? 'Yes' : 'No' },
  ],
  trips: [
    { key: 'name',           label: 'Trip Name' },
    { key: 'startDate',      label: 'Start Date' },
    { key: 'endDate',        label: 'End Date' },
    { key: 'currency',       label: 'Currency' },
    { key: 'notes',          label: 'Notes' },
  ],
}

function fmtVal(meta, val) {
  if (val === null || val === undefined || val === '') return '—'
  if (meta.fmt) return meta.fmt(val)
  return String(val)
}

function diffFields(table, local, remote) {
  const fields = FIELD_META[table] || []
  return fields.filter(m => {
    const lv = local[m.key]
    const rv = remote[m.key]
    if (Array.isArray(lv) && Array.isArray(rv)) return JSON.stringify(lv) !== JSON.stringify(rv)
    return lv !== rv
  })
}

function RecordTitle(conflict) {
  const label = conflict.local.description || conflict.local.name || conflict.local.id
  const tableLabel = { expenses: 'expense', income: 'income entry', trips: 'trip' }[conflict.table] || conflict.table
  return `"${label}" (${tableLabel})`
}

export default function ConflictModal({ conflicts, onResolve, onDismiss }) {
  const [idx, setIdx]               = useState(0)
  const [mode, setMode]             = useState('choose') // 'choose' | 'merge'
  const [mergeChoices, setMergeChoices] = useState({})

  if (!conflicts || conflicts.length === 0) return null

  const clampedIdx = Math.min(idx, conflicts.length - 1)
  const conflict = conflicts[clampedIdx]
  const changedFields = diffFields(conflict.table, conflict.local, conflict.remote)
  const title = RecordTitle(conflict)

  function goTo(newIdx) {
    setIdx(newIdx)
    setMode('choose')
    setMergeChoices({})
  }

  function handleChoose(resolution) {
    onResolve(conflict.id, resolution)
    const remaining = conflicts.length - 1
    if (remaining === 0) return
    goTo(Math.min(clampedIdx, remaining - 1))
  }

  function handleMergeApply() {
    const merged = { ...conflict.remote }
    changedFields.forEach(m => {
      const choice = mergeChoices[m.key] || 'local'
      merged[m.key] = choice === 'local' ? conflict.local[m.key] : conflict.remote[m.key]
    })
    onResolve(conflict.id, 'merge', merged)
    const remaining = conflicts.length - 1
    if (remaining === 0) return
    goTo(Math.min(clampedIdx, remaining - 1))
  }

  function pick(key, side) {
    setMergeChoices(prev => ({ ...prev, [key]: side }))
  }

  return (
    <div className="modal-overlay conflict-overlay" role="dialog" aria-modal="true" aria-label="Sync conflict">
      <div className="modal-box conflict-modal">

        {/* Header */}
        <div className="conflict-header">
          <span className="conflict-icon">⚠️</span>
          <div>
            <div className="conflict-title">Sync Conflict</div>
            <div className="conflict-subtitle">{title} was edited on another device</div>
          </div>
          {conflicts.length > 1 && (
            <div className="conflict-pager">
              <button className="btn-ghost btn-xs" onClick={() => goTo(clampedIdx - 1)} disabled={clampedIdx === 0}>‹</button>
              <span>{clampedIdx + 1} / {conflicts.length}</span>
              <button className="btn-ghost btn-xs" onClick={() => goTo(clampedIdx + 1)} disabled={clampedIdx === conflicts.length - 1}>›</button>
            </div>
          )}
        </div>

        {/* Choose mode */}
        {mode === 'choose' && (
          <>
            {changedFields.length === 0 ? (
              <p className="conflict-no-diff">No visible field differences — the record was likely re-saved without changes.</p>
            ) : (
              <table className="conflict-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th className="col-local">Your Version</th>
                    <th className="col-remote">Other Device</th>
                  </tr>
                </thead>
                <tbody>
                  {changedFields.map(m => (
                    <tr key={m.key}>
                      <td className="conflict-field-label">{m.label}</td>
                      <td className="col-local conflict-val">{fmtVal(m, conflict.local[m.key])}</td>
                      <td className="col-remote conflict-val">{fmtVal(m, conflict.remote[m.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="conflict-detail-row">
              <span className="conflict-ts">Detected {new Date(conflict.detectedAt).toLocaleTimeString()}</span>
            </div>

            <div className="conflict-actions">
              <button className="btn-ghost btn-sm" onClick={() => onDismiss(conflict.id)}>Dismiss</button>
              <div className="conflict-main-actions">
                <button className="btn-ghost btn-sm" onClick={() => handleChoose('theirs')}>Keep Theirs</button>
                {changedFields.length > 1 && (
                  <button className="btn-ghost btn-sm" onClick={() => setMode('merge')}>Merge…</button>
                )}
                <button className="btn-primary btn-sm" onClick={() => handleChoose('mine')}>Keep Mine</button>
              </div>
            </div>
          </>
        )}

        {/* Merge mode */}
        {mode === 'merge' && (
          <>
            <p className="conflict-merge-hint">Choose which value to keep for each field:</p>
            <div className="conflict-merge-list">
              {changedFields.map(m => {
                const choice = mergeChoices[m.key] || 'local'
                return (
                  <div key={m.key} className="merge-field">
                    <div className="merge-field-label">{m.label}</div>
                    <label className={`merge-option${choice === 'local' ? ' selected' : ''}`}>
                      <input type="radio" name={`merge-${conflict.id}-${m.key}`}
                        checked={choice === 'local'} onChange={() => pick(m.key, 'local')} />
                      <span className="merge-side-tag mine">Mine</span>
                      <span className="merge-val">{fmtVal(m, conflict.local[m.key])}</span>
                    </label>
                    <label className={`merge-option${choice === 'remote' ? ' selected' : ''}`}>
                      <input type="radio" name={`merge-${conflict.id}-${m.key}`}
                        checked={choice === 'remote'} onChange={() => pick(m.key, 'remote')} />
                      <span className="merge-side-tag theirs">Theirs</span>
                      <span className="merge-val">{fmtVal(m, conflict.remote[m.key])}</span>
                    </label>
                  </div>
                )
              })}
            </div>
            <div className="conflict-actions">
              <button className="btn-ghost btn-sm" onClick={() => setMode('choose')}>← Back</button>
              <button className="btn-primary btn-sm" onClick={handleMergeApply}>Apply Merge</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
