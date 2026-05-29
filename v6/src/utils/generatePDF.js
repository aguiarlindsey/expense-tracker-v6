import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// A4: 210 × 297mm — 20mm margins → 170mm usable
const M     = 20          // margin
const TW    = 170         // table width (210 - 2×20)

const PRIMARY    = [79,  70,  229]
const DARK       = [30,  27,  75]
const INC_CLR    = [5,   150, 105]
const EXP_CLR    = [239, 68,  68]
const STRIPE     = [248, 248, 255]
const INC_STRIPE = [240, 253, 244]
const MUTED_RGB  = [130, 130, 150]
const BODY_TXT   = [40,  40,  60]

// jsPDF's built-in Helvetica only covers Latin-1.
// Non-Latin-1 currency glyphs (₹ ₽ ₩ ₱ ₿ etc.) render as blanks.
// Map them to safe ASCII alternatives so numbers remain legible.
const SYMBOL_MAP = {
  '₹': 'Rs.', '₽': 'RUB ', '₩': 'KRW ', '₱': 'PHP ', '₿': 'BTC ',
  '₺': 'TRY ', '₴': 'UAH ', '₸': 'KZT ', '₫': 'VND ', '₦': 'NGN ',
  '฿': 'THB ', '₵': 'GHS ', '₾': 'GEL ', '₼': 'AZN ', '₲': 'PYG ',
  '₡': 'CRC ', '₭': 'LAK ',
}
function pdfSafe(str) {
  if (typeof str !== 'string') str = String(str)
  return str.replace(/[₹₽₩₱₿₺₴₸₫₦฿₵₾₼₲₡₭]/g, s => SYMBOL_MAP[s] || s)
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return null
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

// Shared autoTable config
function tbl(headColor, altStripe = STRIPE) {
  return {
    theme: 'striped',
    tableWidth: TW,
    margin: { left: M, right: M },
    headStyles: {
      fillColor: headColor, textColor: [255,255,255],
      fontStyle: 'bold', fontSize: 8.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8, textColor: BODY_TXT,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      overflow: 'linebreak',
      lineColor: [215, 215, 230], lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: altStripe },
  }
}

// Page header band helper
function pageHeader(doc, W, title, subtitle, bandColor, accentColor) {
  doc.setFillColor(...bandColor)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFillColor(...accentColor)
  doc.rect(0, 22, W, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(title, M, 14.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 195, 220)
  doc.text(subtitle, W - M, 14.5, { align: 'right' })
}

export function generateMonthlyPDF({ monthStr, expenses, income, fmtAmount, toBase, CATS, userEmail }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()   // 210
  const H = doc.internal.pageSize.getHeight()  // 297

  // ── Month label ─────────────────────────────────────
  let monthLabel = 'All Time'
  if (monthStr) {
    const [y, m] = monthStr.split('-')
    monthLabel = new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const filtExp = monthStr ? expenses.filter(e => (e.date || '').startsWith(monthStr)) : expenses
  const filtInc = monthStr ? income.filter(i  => (i.date  || '').startsWith(monthStr)) : income

  const totalExp = filtExp.reduce((s, e) => s + toBase(e), 0)
  const totalInc = filtInc.reduce((s, i) => s + toBase(i), 0)
  const net      = totalInc - totalExp

  // ══════════════════════════════════════════════════════
  // PAGE 1 — Cover
  // ══════════════════════════════════════════════════════

  // Header band
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 55, 'F')
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 55, W, 3, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Expense Tracker', M, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(160, 160, 200)
  doc.text('Monthly Report', M, 34)

  // Month pill
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const pillW = doc.getTextWidth(monthLabel) + 14
  const pillX = W - M - pillW
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(pillX, 18, pillW, 12, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(monthLabel, pillX + pillW / 2, 26, { align: 'center' })

  // Generated / email line
  const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(140, 140, 170)
  doc.text(`Generated: ${now}`, M, 48)
  if (userEmail) doc.text(userEmail, W - M, 48, { align: 'right' })

  // ── Summary metrics — use autoTable for reliable centering ──
  const netLabel = net >= 0 ? `+${pdfSafe(fmtAmount(net))}` : pdfSafe(fmtAmount(net))
  const summaryData = [
    [pdfSafe(fmtAmount(totalExp)), pdfSafe(fmtAmount(totalInc)), netLabel, String(filtExp.length)],
  ]
  const summaryHeaders = [['SPENT', 'INCOME', 'NET SAVINGS', 'TRANSACTIONS']]

  autoTable(doc, {
    startY: 63,
    head: summaryHeaders,
    body: summaryData,
    tableWidth: TW,
    margin: { left: M, right: M },
    theme: 'plain',
    headStyles: {
      fillColor: [235, 235, 248],
      textColor: MUTED_RGB,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      cellPadding: { top: 3, bottom: 2, left: 4, right: 4 },
    },
    bodyStyles: {
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center',
      cellPadding: { top: 4, bottom: 5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: TW / 4, textColor: EXP_CLR },
      1: { cellWidth: TW / 4, textColor: INC_CLR },
      2: { cellWidth: TW / 4, textColor: net >= 0 ? INC_CLR : EXP_CLR },
      3: { cellWidth: TW / 4, textColor: PRIMARY },
    },
    didDrawPage(data) {
      // Draw coloured top bar on each summary column header
    },
  })

  const afterSummary = doc.lastAutoTable.finalY + 8

  // ── Category breakdown ───────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('Spending by Category', M, afterSummary)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(M, afterSummary + 2, M + 62, afterSummary + 2)

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
      pdfSafe(fmtAmount(d.amount)),
      totalExp > 0 ? (d.amount / totalExp * 100).toFixed(1) + '%' : '—',
      String(d.count),
    ])

  // Category cols: 86 + 44 + 26 + 14 = 170 ✓
  autoTable(doc, {
    ...tbl(PRIMARY),
    startY: afterSummary + 6,
    head: [['Category', 'Amount', '% of Total', 'Txns']],
    body: catRows.length ? catRows : [['No expenses this month', '—', '—', '0']],
    columnStyles: {
      0: { cellWidth: 86 },
      1: { cellWidth: 44, halign: 'right' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 14, halign: 'center' },
    },
    didDrawCell(data) {
      // Coloured left bar on category column body rows
      if (data.section === 'body' && data.column.index === 0 && catRows[data.row.index]) {
        const rgb = hexToRgb(CATS[catRows[data.row.index][0]]?.color)
        if (rgb) {
          doc.setFillColor(...rgb)
          doc.rect(data.cell.x, data.cell.y, 3, data.cell.height, 'F')
        }
      }
    },
  })

  // ══════════════════════════════════════════════════════
  // PAGE 2 — All Expenses
  // ══════════════════════════════════════════════════════
  doc.addPage()

  pageHeader(
    doc, W,
    `Expenses — ${monthLabel}`,
    `${filtExp.length} transaction${filtExp.length !== 1 ? 's' : ''} · ${pdfSafe(fmtAmount(totalExp))}`,
    DARK, EXP_CLR
  )

  const expRows = [...filtExp]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(e => [
      e.date || '—',
      e.desc || '—',
      e.category || '—',
      e.paymentMethod || '—',
      pdfSafe(fmtAmount(toBase(e))),
    ])

  // Expense cols: 24 + 63 + 35 + 24 + 24 = 170 ✓
  autoTable(doc, {
    ...tbl(EXP_CLR),
    startY: 30,
    head: [['Date', 'Description', 'Category', 'Payment', 'Amount']],
    body: expRows.length ? expRows : [['—', 'No expenses this month', '—', '—', '—']],
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 63 },
      2: { cellWidth: 35 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24, halign: 'right' },
    },
  })

  // ══════════════════════════════════════════════════════
  // PAGE 3 — Income (only if present)
  // ══════════════════════════════════════════════════════
  if (filtInc.length > 0) {
    doc.addPage()

    pageHeader(
      doc, W,
      `Income — ${monthLabel}`,
      `${filtInc.length} entr${filtInc.length !== 1 ? 'ies' : 'y'} · ${pdfSafe(fmtAmount(totalInc))}`,
      [5, 80, 60], INC_CLR
    )

    const incRows = [...filtInc]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(i => [
        i.date   || '—',
        i.desc   || '—',
        i.source || '—',
        pdfSafe(fmtAmount(toBase(i))),
      ])

    // Income cols: 24 + 84 + 38 + 24 = 170 ✓
    autoTable(doc, {
      ...tbl(INC_CLR, INC_STRIPE),
      startY: 30,
      head: [['Date', 'Description', 'Source', 'Amount']],
      body: incRows,
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 84 },
        2: { cellWidth: 38 },
        3: { cellWidth: 24, halign: 'right' },
      },
    })
  }

  // ── Footer on every page ─────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(200, 200, 220)
    doc.setLineWidth(0.2)
    doc.line(M, H - 12, W - M, H - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED_RGB)
    doc.text(`Expense Tracker · ${monthLabel}`, M, H - 7)
    doc.text(`Page ${p} of ${totalPages}`, W - M, H - 7, { align: 'right' })
  }

  doc.save(`expense-report-${monthStr || 'all-time'}.pdf`)
}
