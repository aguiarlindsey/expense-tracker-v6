import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// A4: 210 × 297mm — 20mm margins → 170mm usable
const M  = 20
const TW = 170

const PRIMARY    = [79,  70,  229]
const DARK       = [30,  27,  75]
const INC_CLR    = [5,   150, 105]
const EXP_CLR    = [239, 68,  68]
const STRIPE     = [248, 248, 255]
const INC_STRIPE = [240, 253, 244]
const MUTED_RGB  = [130, 130, 150]
const BODY_TXT   = [40,  40,  60]
const BORDER_CLR = [210, 210, 228]

// ── Currency formatting ───────────────────────────────────────────────────────
// jsPDF Helvetica uses WinAnsi (Windows-1252). ₹ ₽ ₩ ₱ ₿ etc. are outside
// that range and render blank. Map to safe ASCII prefix + locale number format.
const PDF_SYMBOLS = {
  USD:'$', AUD:'A$', CAD:'CA$', SGD:'S$', HKD:'HK$', NZD:'NZ$', MXN:'$', TWD:'NT$',
  EUR:'€', GBP:'£', JPY:'¥', CNY:'¥',
  INR:'Rs.', NPR:'Rs.', LKR:'Rs.', BDT:'Tk.', PKR:'Rs.',
  RUB:'RUB ', CHF:'Fr.', SEK:'kr ', NOK:'kr ', DKK:'kr ',
  PHP:'PHP ', IDR:'Rp.', THB:'THB ', MYR:'RM ', KRW:'KRW ',
  BRL:'R$', ZAR:'R ', AED:'AED ', SAR:'SAR ',
  BTC:'BTC ', ETH:'ETH ',
}
const SA_SET = new Set(['INR','NPR','LKR','BDT','PKR'])
function localeFor(c) { return SA_SET.has(c) ? 'en-IN' : 'en-US' }

function makeFmt(baseCurrency) {
  const prefix = PDF_SYMBOLS[baseCurrency] ?? (baseCurrency + ' ')
  const locale = localeFor(baseCurrency)
  return (amount) => {
    const n   = parseFloat(amount) || 0
    const abs = Math.abs(n)
    const num = abs.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (n < 0 ? '-' : '') + prefix + num
  }
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return null
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

// ── Shared cell padding ───────────────────────────────────────────────────────
const HP = { top:4, bottom:4, left:5, right:5 }   // head padding
const BP = { top:4, bottom:4, left:5, right:5 }   // body padding
const ROW_H = 11                                   // min cell height (mm)

function tbl(doc, headColor, altStripe = STRIPE) {
  return {
    theme: 'plain',
    tableWidth: TW,
    margin: { left: M, right: M },
    headStyles: {
      fillColor: headColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: HP,
      valign: 'middle',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: BODY_TXT,
      cellPadding: BP,
      valign: 'middle',
      overflow: 'linebreak',
      minCellHeight: ROW_H,
    },
    alternateRowStyles: { fillColor: altStripe },
    // Draw horizontal divider between every row
    didDrawCell(data) {
      if (data.section === 'body') {
        doc.setDrawColor(...BORDER_CLR)
        doc.setLineWidth(0.15)
        doc.line(
          data.cell.x, data.cell.y + data.cell.height,
          data.cell.x + data.cell.width, data.cell.y + data.cell.height
        )
      }
    },
  }
}

function pageHeader(doc, W, title, subtitle, bandColor, accentColor) {
  doc.setFillColor(...bandColor)
  doc.rect(0, 0, W, 24, 'F')
  doc.setFillColor(...accentColor)
  doc.rect(0, 24, W, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(title, M, 15.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 195, 220)
  doc.text(subtitle, W - M, 15.5, { align: 'right' })
}

// ─────────────────────────────────────────────────────────────────────────────

export function generateMonthlyPDF({ monthStr, expenses, income, baseCurrency, toBase, CATS, userEmail }) {
  const fmt = makeFmt(baseCurrency)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

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
  // PAGE 1 — Cover + Summary + Category
  // ══════════════════════════════════════════════════════
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
  doc.text('Monthly Report', M, 35)

  // Month pill
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const pillW = doc.getTextWidth(monthLabel) + 16
  const pillX = W - M - pillW
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(pillX, 18, pillW, 13, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(monthLabel, pillX + pillW / 2, 27, { align: 'center' })

  const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(140, 140, 170)
  doc.text(`Generated: ${now}`, M, 49)
  if (userEmail) doc.text(userEmail, W - M, 49, { align: 'right' })

  // ── Summary metrics ──────────────────────────────────
  // Each metric in its own column, header = label, body = value
  // TW/4 = 42.5mm per column — enough for formatted amounts
  const netStr = (net < 0 ? '-' : '+') + fmt(Math.abs(net))

  autoTable(doc, {
    startY: 63,
    tableWidth: TW,
    margin: { left: M, right: M },
    theme: 'plain',
    head: [['SPENT', 'INCOME', 'NET SAVINGS', 'TRANSACTIONS']],
    body: [[fmt(totalExp), fmt(totalInc), netStr, String(filtExp.length)]],
    headStyles: {
      fillColor: [236, 236, 250],
      textColor: MUTED_RGB,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 4, bottom: 3, left: 4, right: 4 },
    },
    bodyStyles: {
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      overflow: 'linebreak',
      minCellHeight: 14,
    },
    columnStyles: {
      0: { cellWidth: TW / 4, textColor: EXP_CLR },
      1: { cellWidth: TW / 4, textColor: INC_CLR },
      2: { cellWidth: TW / 4, textColor: net >= 0 ? INC_CLR : EXP_CLR },
      3: { cellWidth: TW / 4, textColor: PRIMARY },
    },
    didDrawCell(data) {
      // Vertical dividers between summary columns
      if (data.section === 'body' && data.column.index < 3) {
        doc.setDrawColor(...BORDER_CLR)
        doc.setLineWidth(0.3)
        doc.line(
          data.cell.x + data.cell.width, data.cell.y,
          data.cell.x + data.cell.width, data.cell.y + data.cell.height
        )
      }
    },
  })

  // ── Category breakdown ───────────────────────────────
  const afterSummary = doc.lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('Spending by Category', M, afterSummary)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(M, afterSummary + 2.5, M + 64, afterSummary + 2.5)

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
      fmt(d.amount),
      totalExp > 0 ? (d.amount / totalExp * 100).toFixed(1) + '%' : '—',
      String(d.count),
    ])

  // Category cols: 82 + 46 + 26 + 16 = 170 ✓
  // Col 0 left-padding = 9 (5 base + 4 to clear the 3mm colour bar + 1 gap)
  autoTable(doc, {
    ...tbl(doc, PRIMARY),
    startY: afterSummary + 7,
    head: [['Category', 'Amount', '% of Total', 'Txns']],
    body: catRows.length ? catRows : [['No expenses this month', '—', '—', '0']],
    columnStyles: {
      0: { cellWidth: 82, cellPadding: { ...BP, left: 9 } },
      1: { cellWidth: 46, halign: 'right' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 16, halign: 'center' },
    },
    didDrawCell(data) {
      // Row dividers (from shared tbl helper — redeclare here since we override didDrawCell)
      if (data.section === 'body') {
        doc.setDrawColor(...BORDER_CLR)
        doc.setLineWidth(0.15)
        doc.line(
          data.cell.x, data.cell.y + data.cell.height,
          data.cell.x + data.cell.width, data.cell.y + data.cell.height
        )
        // Coloured left bar on category column only
        if (data.column.index === 0 && catRows[data.row.index]) {
          const rgb = hexToRgb(CATS[catRows[data.row.index][0]]?.color)
          if (rgb) {
            doc.setFillColor(...rgb)
            doc.rect(data.cell.x, data.cell.y, 3.5, data.cell.height, 'F')
          }
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
    `${filtExp.length} transaction${filtExp.length !== 1 ? 's' : ''} · ${fmt(totalExp)}`,
    DARK, EXP_CLR
  )

  const expRows = [...filtExp]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(e => [
      e.date            || '—',
      e.description     || '—',
      e.category        || '—',
      e.paymentMethod   || '—',
      fmt(toBase(e)),
    ])

  // Expense cols: 25 + 60 + 34 + 24 + 27 = 170 ✓
  autoTable(doc, {
    ...tbl(doc, EXP_CLR),
    startY: 33,
    head: [['Date', 'Description', 'Category', 'Payment', 'Amount']],
    body: expRows.length ? expRows : [['—', 'No expenses this month', '—', '—', '—']],
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 60 },
      2: { cellWidth: 34 },
      3: { cellWidth: 24 },
      4: { cellWidth: 27, halign: 'right' },
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
      `${filtInc.length} entr${filtInc.length !== 1 ? 'ies' : 'y'} · ${fmt(totalInc)}`,
      [5, 80, 60], INC_CLR
    )

    const incRows = [...filtInc]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(i => [
        i.date        || '—',
        i.description || '—',
        i.source      || '—',
        fmt(toBase(i)),
      ])

    // Income cols: 25 + 82 + 36 + 27 = 170 ✓
    autoTable(doc, {
      ...tbl(doc, INC_CLR, INC_STRIPE),
      startY: 33,
      head: [['Date', 'Description', 'Source', 'Amount']],
      body: incRows,
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 82 },
        2: { cellWidth: 36 },
        3: { cellWidth: 27, halign: 'right' },
      },
    })
  }

  // ── Footer on every page ─────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...BORDER_CLR)
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
