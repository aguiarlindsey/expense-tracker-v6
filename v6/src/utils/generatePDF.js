import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// A4: 210mm × 297mm — margins 20mm each side → usable width = 170mm
const PAGE_W   = 210
const MARGIN   = 20
const COL_W    = PAGE_W - MARGIN * 2  // 170mm

const PRIMARY    = [79,  70,  229]
const DARK       = [30,  27,  75]
const INC_CLR    = [5,   150, 105]
const EXP_CLR    = [239, 68,  68]
const STRIPE     = [248, 248, 255]
const INC_STRIPE = [240, 253, 244]
const MUTED      = [120, 120, 140]
const BODY_TXT   = [40,  40,  60]

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return [150, 150, 150]
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

// Shared table defaults
function tableDefaults(headFill) {
  return {
    theme: 'striped',
    headStyles: { fillColor: headFill, textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: { top:3, bottom:3, left:3, right:3 } },
    bodyStyles: { fontSize: 8, textColor: BODY_TXT, cellPadding: { top:2.5, bottom:2.5, left:3, right:3 }, overflow: 'linebreak', lineColor: [220,220,235], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: STRIPE },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
  }
}

export function generateMonthlyPDF({ monthStr, expenses, income, fmtAmount, toBase, CATS, userEmail }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── Month label ─────────────────────────────────────
  let monthLabel = 'All Time'
  if (monthStr) {
    const [y, m] = monthStr.split('-')
    monthLabel = new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // ── Filter data ─────────────────────────────────────
  const filtExp = monthStr ? expenses.filter(e => (e.date || '').startsWith(monthStr)) : expenses
  const filtInc = monthStr ? income.filter(i  => (i.date  || '').startsWith(monthStr)) : income

  const totalExp = filtExp.reduce((s, e) => s + toBase(e), 0)
  const totalInc = filtInc.reduce((s, i) => s + toBase(i), 0)
  const net      = totalInc - totalExp

  // ══════════════════════════════════════════════════════
  // PAGE 1 — Cover + Category breakdown
  // ══════════════════════════════════════════════════════

  // Dark header band (0–58)
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 58, 'F')
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 58, W, 2.5, 'F')

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Expense Tracker', MARGIN, 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(180, 180, 210)
  doc.text('Monthly Report', MARGIN, 36)

  // Month pill — positioned relative to pill width
  const pillLabel = monthLabel
  doc.setFontSize(9)
  const pillW = Math.max(doc.getTextWidth(pillLabel) + 12, 38)
  const pillX = W - MARGIN - pillW
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(pillX, 17, pillW, 12, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(pillLabel, pillX + pillW / 2, 25, { align: 'center' })

  // Meta
  const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(150, 150, 180)
  doc.text(`Generated ${now}`, MARGIN, 51)
  if (userEmail) doc.text(userEmail, W - MARGIN, 51, { align: 'right' })

  // ── Summary cards (y 68–100) ─────────────────────────
  const cards = [
    { label: 'SPENT',        value: fmtAmount(totalExp),     color: EXP_CLR },
    { label: 'INCOME',       value: fmtAmount(totalInc),     color: INC_CLR },
    { label: 'NET SAVINGS',  value: fmtAmount(net),           color: net >= 0 ? INC_CLR : EXP_CLR },
    { label: 'TRANSACTIONS', value: String(filtExp.length),   color: PRIMARY },
  ]
  const gap   = 4
  const cardW = (COL_W - gap * 3) / 4   // ≈ 39.5mm each
  const cardH = 28
  const cardY = 68

  cards.forEach((card, i) => {
    const cx = MARGIN + i * (cardW + gap)

    // Card bg + border
    doc.setFillColor(251, 251, 255)
    doc.roundedRect(cx, cardY, cardW, cardH, 2, 2, 'F')
    doc.setDrawColor(210, 210, 232)
    doc.setLineWidth(0.2)
    doc.roundedRect(cx, cardY, cardW, cardH, 2, 2, 'S')

    // Colour top stripe
    doc.setFillColor(...card.color)
    doc.roundedRect(cx, cardY, cardW, 2.5, 1, 1, 'F')

    // Value — scale font so it fits the card
    const maxValueW = cardW - 6
    let fs = 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fs)
    while (doc.getTextWidth(card.value) > maxValueW && fs > 6) {
      fs -= 0.5
      doc.setFontSize(fs)
    }
    doc.setTextColor(...card.color)
    doc.text(card.value, cx + cardW / 2, cardY + 16, { align: 'center' })

    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...MUTED)
    doc.text(card.label, cx + cardW / 2, cardY + 23, { align: 'center' })
  })

  // ── Category table ───────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('Spending by Category', MARGIN, 108)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, 110, MARGIN + 60, 110)

  const catMap = {}
  filtExp.forEach(e => {
    const cat = e.category || 'Other'
    if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 }
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

  // Category cols: 88 + 42 + 26 + 14 = 170 ✓
  autoTable(doc, {
    ...tableDefaults(PRIMARY),
    startY: 114,
    head: [['Category', 'Amount', '% of Total', 'Txns']],
    body: catRows.length ? catRows : [['No expenses this month', '—', '—', '0']],
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 42, halign: 'right' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 14, halign: 'center' },
    },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index === 0 && catRows[data.row.index]) {
        const cat = catRows[data.row.index][0]
        const hex = CATS[cat]?.color
        if (hex) {
          const [r,g,b] = hexToRgb(hex)
          doc.setFillColor(r, g, b)
          doc.roundedRect(data.cell.x + 2, data.cell.y + data.cell.height / 2 - 1.5, 3, 3, 0.5, 0.5, 'F')
        }
      }
    },
  })

  // ══════════════════════════════════════════════════════
  // PAGE 2 — Expenses
  // ══════════════════════════════════════════════════════
  doc.addPage()

  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 20, 'F')
  doc.setFillColor(...EXP_CLR)
  doc.rect(0, 20, W, 2.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(`Expenses — ${monthLabel}`, MARGIN, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 180, 200)
  doc.text(
    `${filtExp.length} transaction${filtExp.length !== 1 ? 's' : ''} · ${fmtAmount(totalExp)}`,
    W - MARGIN, 14, { align: 'right' }
  )

  const expRows = [...filtExp]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(e => [
      e.date || '—',
      e.desc  || '—',
      e.category || '—',
      e.paymentMethod || '—',
      fmtAmount(toBase(e)),
    ])

  // Expense cols: 24 + 64 + 36 + 24 + 22 = 170 ✓
  autoTable(doc, {
    ...tableDefaults(EXP_CLR),
    startY: 28,
    head: [['Date', 'Description', 'Category', 'Payment', 'Amount']],
    body: expRows.length ? expRows : [['—', 'No expenses this month', '—', '—', '—']],
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 64 },
      2: { cellWidth: 36 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22, halign: 'right' },
    },
  })

  // ══════════════════════════════════════════════════════
  // PAGE 3 — Income (only if present)
  // ══════════════════════════════════════════════════════
  if (filtInc.length > 0) {
    doc.addPage()

    doc.setFillColor(5, 80, 60)
    doc.rect(0, 0, W, 20, 'F')
    doc.setFillColor(...INC_CLR)
    doc.rect(0, 20, W, 2.5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text(`Income — ${monthLabel}`, MARGIN, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(180, 230, 210)
    doc.text(
      `${filtInc.length} entr${filtInc.length !== 1 ? 'ies' : 'y'} · ${fmtAmount(totalInc)}`,
      W - MARGIN, 14, { align: 'right' }
    )

    const incRows = [...filtInc]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(i => [
        i.date   || '—',
        i.desc   || '—',
        i.source || '—',
        fmtAmount(toBase(i)),
      ])

    // Income cols: 24 + 86 + 38 + 22 = 170 ✓
    autoTable(doc, {
      ...tableDefaults(INC_CLR),
      alternateRowStyles: { fillColor: INC_STRIPE },
      startY: 28,
      head: [['Date', 'Description', 'Source', 'Amount']],
      body: incRows,
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 86 },
        2: { cellWidth: 38 },
        3: { cellWidth: 22, halign: 'right' },
      },
    })
  }

  // ── Footer on every page ─────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(200, 200, 220)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, H - 12, W - MARGIN, H - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`Expense Tracker · ${monthLabel}`, MARGIN, H - 7)
    doc.text(`Page ${p} of ${totalPages}`, W - MARGIN, H - 7, { align: 'right' })
  }

  doc.save(`expense-report-${monthStr || 'all-time'}.pdf`)
}
