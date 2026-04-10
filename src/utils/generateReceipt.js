import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates and downloads a professional PDF receipt for a SplitPay event.
 *
 * @param {object} opts
 * @param {object}   opts.event          - PocketBase event record
 * @param {Array}    opts.expenses        - Array of expense records (expanded pagado_por)
 * @param {Array}    opts.participants    - Array of participant records
 * @param {object}   opts.balance         - { transferencias, summary, total } from calculateBalance
 * @param {string}   opts.moneda          - Currency symbol  e.g. "$" or "S/."
 * @param {string}   opts.userName        - Display name of the current user (for highlighting)
 */
export function generateReceipt({ event, expenses, participants, balance, moneda, userName }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W       = 210;
  const H       = 297;
  const ML      = 18;   // margin left
  const MR      = 18;   // margin right
  const CW      = W - ML - MR; // content width

  // ── Colour palette ──────────────────────────────────────────────
  const EMERALD   = [16, 185, 129];
  const DARK      = [15, 23, 42];
  const SLATE600  = [71, 85, 105];
  const SLATE400  = [148, 163, 184];
  const SLATE50   = [248, 250, 252];
  const SLATE100  = [241, 245, 249];
  const WHITE     = [255, 255, 255];
  const GREEN50   = [236, 253, 245];
  const GREEN600  = [5, 150, 105];
  const RED500    = [239, 68, 68];
  const AMBER50   = [255, 251, 235];
  const AMBER600  = [217, 119, 6];

  // ── Header band ─────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 52, 'F');

  // Emerald accent bar left
  doc.setFillColor(...EMERALD);
  doc.rect(0, 0, 6, 52, 'F');

  // Brand name
  doc.setTextColor(...EMERALD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SPLITPAY', ML + 4, 16);

  // Document type
  doc.setTextColor(...SLATE400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('RECIBO DE GASTOS COMPARTIDOS', ML + 4, 23);

  // Event name
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const eventName = (event?.nombre_evento || 'EVENTO').toUpperCase();
  doc.text(eventName, ML + 4, 39, { maxWidth: CW - 10 });

  // ── Meta row ────────────────────────────────────────────────────
  let y = 62;
  const fechaRaw  = event?.fecha_evento || event?.fecha_creacion;
  const fechaStr  = fechaRaw
    ? new Date(fechaRaw).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const hoyStr    = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  doc.setTextColor(...SLATE600);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const col2x = ML + CW / 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Evento:', ML, y);
  doc.text('Participante:', col2x, y);
  doc.setFont('helvetica', 'normal');
  doc.text(event?.nombre_evento || '—', ML + 18, y);
  doc.text(userName || '—', col2x + 24, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha evento:', ML, y);
  doc.text('Generado:', col2x, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fechaStr, ML + 26, y);
  doc.text(hoyStr, col2x + 19, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Participantes:', ML, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(participants.length), ML + 27, y);

  // Divider
  y += 8;
  doc.setDrawColor(...SLATE100);
  doc.setLineWidth(0.4);
  doc.line(ML, y, W - MR, y);

  // ── 1. Detalle de Gastos ─────────────────────────────────────────
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...EMERALD);
  doc.text('DETALLE DE GASTOS', ML, y);

  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['#', 'Descripción', 'Pagado por', 'Monto']],
    body: expenses.map((exp, i) => [
      String(i + 1),
      exp.descripcion,
      exp.expand?.pagado_por?.nombre || '—',
      `${moneda}${Number(exp.monto).toFixed(2)}`,
    ]),
    foot: [['', '', 'TOTAL DEL EVENTO', `${moneda}${balance.total.toFixed(2)}`]],
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    footStyles: {
      fillColor: SLATE100,
      textColor: DARK,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: SLATE600,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      2: { cellWidth: 38 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
    },
    margin: { left: ML, right: MR },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE50 },
  });

  // ── 2. Balance por participante ───────────────────────────────────
  y = doc.lastAutoTable.finalY + 10;

  // Check if it fits on current page, if not add a new page
  if (y > H - 80) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...EMERALD);
  doc.text('BALANCE POR PARTICIPANTE', ML, y);

  const cuota = participants.length > 0 ? balance.total / participants.length : 0;

  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['Participante', 'Total Pagado', 'Cuota Justa', 'Balance']],
    body: balance.summary.map(s => {
      const isMe = s.nombre === userName;
      return [
        isMe ? `${s.nombre}  ★` : s.nombre,
        `${moneda}${s.pagado.toFixed(2)}`,
        `${moneda}${cuota.toFixed(2)}`,
        `${s.balance >= 0 ? '+' : ''}${moneda}${s.balance.toFixed(2)}`,
      ];
    }),
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: SLATE600,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: ML, right: MR },
    theme: 'striped',
    alternateRowStyles: { fillColor: SLATE50 },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const name = data.row.raw?.[0] || '';
      const isMyRow = typeof name === 'string' && name.includes('★');

      if (isMyRow) {
        data.cell.styles.fillColor = GREEN50;
        data.cell.styles.textColor = GREEN600;
        data.cell.styles.fontStyle = 'bold';
      }

      // Colour balance cell
      if (data.column.index === 3) {
        const val = String(data.cell.raw || '');
        if (val.startsWith('+')) {
          data.cell.styles.textColor = isMyRow ? GREEN600 : [22, 163, 74];
        } else if (!val.startsWith('+') && val !== `${moneda}0.00`) {
          data.cell.styles.textColor = isMyRow ? RED500 : RED500;
        }
      }
    },
  });

  // ── 3. Transferencias pendientes ─────────────────────────────────
  if (balance.transferencias.length > 0) {
    y = doc.lastAutoTable.finalY + 10;
    if (y > H - 55) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...EMERALD);
    doc.text('TRANSFERENCIAS PENDIENTES', ML, y);

    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Quién paga', '→', 'A quién', 'Monto']],
      body: balance.transferencias.map(t => [t.de, '→', t.para, `${moneda}${t.monto.toFixed(2)}`]),
      headStyles: {
        fillColor: DARK,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: SLATE600,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      columnStyles: {
        1: { halign: 'center', cellWidth: 10 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      },
      margin: { left: ML, right: MR },
      theme: 'plain',
      didParseCell(data) {
        if (data.section !== 'body') return;
        const payer = data.row.raw?.[0];
        const recv  = data.row.raw?.[2];
        const involvesMe = payer === userName || recv === userName;
        if (involvesMe) {
          if (payer === userName) {
            data.cell.styles.fillColor = AMBER50;
            data.cell.styles.textColor = AMBER600;
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.fillColor = GREEN50;
            data.cell.styles.textColor = GREEN600;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
  }

  // ── Footer ───────────────────────────────────────────────────────
  const footY = H - 14;
  doc.setFillColor(...DARK);
  doc.rect(0, footY - 6, W, 20, 'F');
  doc.setFillColor(...EMERALD);
  doc.rect(0, footY - 6, 6, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...EMERALD);
  doc.text('SPLITPAY', ML + 4, footY + 2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE400);
  doc.text('splitpay.istavnile.cloud', ML + 24, footY + 2);
  doc.text(
    new Date().toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    W - MR,
    footY + 2,
    { align: 'right' }
  );

  // ── Save ─────────────────────────────────────────────────────────
  const safeName = (event?.nombre_evento || 'evento').replace(/[^a-zA-Z0-9\s\-_áéíóúñ]/g, '');
  doc.save(`${safeName} — Recibo SplitPay.pdf`);
}
