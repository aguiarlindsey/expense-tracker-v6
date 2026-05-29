import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRIMARY  = [79,  70,  229]
const DARK     = [30,  27,  75]
const INC_CLR  = [5,   150, 105]
const EXP_CLR  = [239, 68,  68]
const STRIPE   = [248, 248, 255]
const INC_STRIPE = [240, 253, 244]
const MUTED    = [120, 120, 140]
const BODY_TXT = [40,  40,  60]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return [r,g,b]
}

export function generateMonthlyPDF({ monthStr, expenses, income, fmtAmount, toBase, CATS, userEmail }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── Month label ──────────────────────────────────────
  let monthLabel = 'All Time'
  if (monthStr) {
    const [y, m] = monthStr.split('-')
    monthLabel = new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // ── Filter to month ──────────────────────────────────
  const filtExp = monthStr ? expenses.filter(e => (e.date || '').startsWith(monthStr)) : expenses
  const filtInc = monthStr ? income.filter(i  => (i.date  || '').startsWith(monthStr)) : income

  const totalExp = filtExp.reduce((s, e) => s + toBase(e), 0)
  const totalInc = filtInc.reduce((s, i) => s + toBase(i), 0)
  const net = totalInc - totalExp

  // ─── PAGE 1 — Cover / Summary ─────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 58, 'F')

  // Accent bar
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 58, W, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('Expense Tracker', 20, 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(180, 180, 210)
  doc.text('Monthly Report', 20, 36)

  // Month pill (top-right)
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(W - 68, 16, 48, 13, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(monthLabel, W - 44, 24.5, { align: 'center' })

  // Meta line
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 180)
  doc.text(`Generated ${now}`, 20, 51)
  if (userEmail) doc.text(userEmail, W - 20, 51, { align: 'right' })

  // ── Summary cards ────────────────────────────────────
  const cards = [
    { label: 'SPENT',        value: fmtAmount(totalExp), color: EXP_CLR },
    { label: 'INCOME',       value: fmtAmount(totalInc), color: INC_CLR },
    { label: 'NET SAVINGS',  value: fmtAmount(net),      color: net >= 0 ? INC_CLR : EXP_CLR },
    { label: 'TRANSACTIONS', value: String(filtExp.length), color: PRIMARY },
  ]
  const cardW = (W - 40 - 9) / 4
  cards.forEach((card, i) => {
    const x = 20 + i * (cardW + 3)
    doc.setFillColor(252, 252, 255)
    doc.roundedRect(x, 68, cardW, 30, 2, 2, 'F')
    doc.setDrawColor(210, 210, 230)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, 68, cardW, 30, 2, 2, 'S')
    // Top colour strip
    doc.setFillColor(...card.color)
    doc.roundedRect(x, 68, cardW, 2.5, 1, 1, 'F')
    // Value
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...card.color)
    doc.text(card.value, x + cardW / 2, 85, { align: 'center' })
    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(card.label, x + cardW / 2, 92, { align: 'center' })
  })

  // ── Section header ───────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text('Spending by Category', 20, 114)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(20, 116, 80, 116)

  // ── Category breakdown table ─────────────────────────
  const catMap = {}
  filtExp.forEach(e => {
    const cat = e.category || 'Other'
    if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0, color: CATS[cat]?.color }
    catMap[cat].amount += toBase(e)
    catMap[cat].count++
  })
  const catRows = Object.entries(catMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([cat, d]) => [
      cat,
      fmtAmount(d.amount),
      totalExp > 0 ? (d.amount / totalExp * 100).toFixed(1) + '%' : '—',
      String(d.count),
    ])

  autoTable(doc, {
    startY: 120,
    head: [['Category', 'Amount', '% of Total', 'Txns']],
    body: catRows.length ? catRows : [['No expenses this month', '—', '—', '0']],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8.5, cellPadding: 3 },
    bodyStyles: { fontSize: 8.5, textColor: BODY_TXT, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: STRIPE },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 48, halign: 'right' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
    },
    margin: { left: 20, right: 20 },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index === 0) {
        const cat = catRows[data.row.index]?.[0]
        const hex = cat ? CATS[cat]?.color : null
        if (hex) {
          const [r, g, b] = hexToRgb(hex)
          doc.setFillColor(r, g, b)
          doc.roundedRect(data.cell.x + 2, data.cell.y + data.cell.height / 2 - 1.5, 3, 3, 0.5, 0.5, 'F')
        }
      }
    },
  })

  // ─── PAGE 2 — Expenses ────────────────────────────────
  doc.addPage()

  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 20, 'F')
  doc.setFillColor(...EXP_CLR)
  doc.rect(0, 20, W, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text(`Expenses — ${monthLabel}`, 20, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 180, 210)
  const expSummary = `${filtExp.length} transaction${filtExp.length !== 1 ? 's' : ''} · ${fmtAmount(totalExp)}`
  doc.text(expSummary, W - 20, 14, { align: 'right' })

  const expRows = [...filtExp]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => [
      e.date || '—',
      (e.desc || '—').substring(0, 40),
      e.category || '—',
      e.paymentMethod || '—',
      fmtAmount(toBase(e)),
    ])

  autoTable(doc, {
    startY: 28,
    head: [['Date', 'Description', 'Category', 'Payment', 'Amount']],
    body: expRows.length ? expRows : [['—', 'No expenses this month', '—', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: EXP_CLR, textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, textColor: BODY_TXT, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: STRIPE },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 68 },
      2: { cellWidth: 36 },
      3: { cellWidth: 30 },
      4: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  })

  // ─── PAGE 3 — Income (only if any) ───────────────────
  if (filtInc.length > 0) {
    doc.addPage()

    doc.setFillColor(5, 80, 60)
    doc.rect(0, 0, W, 20, 'F')
    doc.setFillColor(...INC_CLR)
    doc.rect(0, 20, W, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(255, 255, 255)
    doc.text(`Income — ${monthLabel}`, 20, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(180, 230, 210)
    doc.text(`${filtInc.length} entr${filtInc.length !== 1 ? 'ies' : 'y'} · ${fmtAmount(totalInc)}`, W - 20, 14, { align: 'right' })

    const incRows = [...filtInc]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(i => [
        i.date || '—',
        (i.desc || '—').substring(0, 55),
        i.source || '—',
        fmtAmount(toBase(i)),
      ])

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Description', 'Source', 'Amount']],
      body: incRows,
      theme: 'striped',
      headStyles: { fillColor: INC_CLR, textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: BODY_TXT, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: INC_STRIPE },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 85 },
        2: { cellWidth: 45 },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 20, right: 20 },
    })
  }

  // ─── Footer on every page ─────────────────────────────
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(200, 200, 215)
    doc.setLineWidth(0.25)
    doc.line(20, H - 13, W - 20, H - 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`Expense Tracker · ${monthLabel}`, 20, H - 8)
    doc.text(`Page ${p} of ${total}`, W - 20, H - 8, { align: 'right' })
  }

  doc.save(`expense-report-${monthStr || 'all-time'}.pdf`)
}
