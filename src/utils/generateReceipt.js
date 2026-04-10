import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Loads the public icon as a base64 data-URL at runtime
async function loadIconBase64() {
  try {
    const res  = await fetch('/icon.png');
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Generates and downloads a professional PDF receipt for a SplitPay event.
 *
 * @param {object} opts
 * @param {object}  opts.event          PocketBase event record
 * @param {Array}   opts.expenses       Expense records (expanded pagado_por)
 * @param {Array}   opts.participants   Participant records
 * @param {object}  opts.balance        { transferencias, summary, total }
 * @param {string}  opts.moneda         "$" | "S/."
 * @param {string}  opts.userName       Display name of the current user
 */
export async function generateReceipt({ event, expenses, participants, balance, moneda, userName }) {
  const iconB64 = await loadIconBase64();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W  = 210;
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;

  // ── Palette ─────────────────────────────────────────────────────
  const EMERALD  = [16, 185, 129];
  const DARK     = [15, 23, 42];
  const SLATE7   = [51, 65, 85];
  const SLATE5   = [100, 116, 139];
  const SLATE1   = [241, 245, 249];
  const WHITE    = [255, 255, 255];
  const GREEN_BG = [236, 253, 245];
  const GREEN_FG = [5, 150, 105];
  const RED      = [220, 38, 38];
  const AMBER_BG = [255, 251, 235];
  const AMBER_FG = [180, 83, 9];

  // ─────────────────────────────────────────────────────────────────
  // HEADER  (dark band, logo, event name)
  // ─────────────────────────────────────────────────────────────────
  const HEADER_H = 44;

  // Dark background
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, HEADER_H, 'F');

  // Left accent bar
  doc.setFillColor(...EMERALD);
  doc.rect(0, 0, 5, HEADER_H, 'F');

  // Logo icon (if loaded)
  const ICON_SIZE = 14;
  const iconX     = ML + 2;
  const iconY     = (HEADER_H - ICON_SIZE) / 2;
  if (iconB64) {
    // Draw rounded-rect clip then image
    doc.addImage(iconB64, 'PNG', iconX, iconY, ICON_SIZE, ICON_SIZE);
  }

  // Brand text
  const textX = iconB64 ? iconX + ICON_SIZE + 4 : ML + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...EMERALD);
  doc.text('SplitPay', textX, iconY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Recibo de gastos compartidos', textX, iconY + 11);

  // Event name — right side
  const eventName = (event?.nombre_evento || 'Evento').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(eventName, W - MR, HEADER_H / 2 + 3, { align: 'right', maxWidth: 90 });

  // ─────────────────────────────────────────────────────────────────
  // META ROW  (two-column info strip)
  // ─────────────────────────────────────────────────────────────────
  let y = HEADER_H + 8;

  const fecha = event?.fecha_evento || event?.fecha_creacion;
  const fechaStr = fecha
    ? new Date(fecha).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const hoy = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  const meta = [
    ['Evento',          event?.nombre_evento || '—', 'Participante',  userName || '—'],
    ['Fecha del evento', fechaStr,                   'Generado el',   hoy],
    ['Participantes',   String(participants.length), 'Total del evento', `${moneda}${balance.total.toFixed(2)}`],
  ];

  const col2 = ML + CW / 2;
  doc.setFontSize(8);
  meta.forEach(([k1, v1, k2, v2]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE5);
    doc.text(k1 + ':', ML, y);
    doc.text(k2 + ':', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE7);
    doc.text(v1, ML + 28, y);
    doc.text(v2, col2 + 26, y);
    y += 5.5;
  });

  // Thin divider
  y += 2;
  doc.setDrawColor(...SLATE1);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 6;

  // ─────────────────────────────────────────────────────────────────
  // SECTION LABEL helper
  // ─────────────────────────────────────────────────────────────────
  const sectionLabel = (label) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...EMERALD);
    doc.text(label, ML, y);
    y += 3;
  };

  // ─────────────────────────────────────────────────────────────────
  // TABLE CONFIG defaults
  // ─────────────────────────────────────────────────────────────────
  const HEAD_STYLE = {
    fillColor: DARK,
    textColor: WHITE,
    fontStyle: 'bold',
    fontSize: 8,
    valign: 'middle',
    cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
  };
  const BODY_STYLE = {
    fontSize: 8,
    textColor: SLATE7,
    valign: 'middle',
    cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
  };
  const FOOT_STYLE = {
    fillColor: DARK,
    textColor: WHITE,
    fontStyle: 'bold',
    fontSize: 8,
    valign: 'middle',
    cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
  };

  // ─────────────────────────────────────────────────────────────────
  // 1. DETALLE DE GASTOS
  // ─────────────────────────────────────────────────────────────────
  sectionLabel('DETALLE DE GASTOS');

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descripción', 'Pagado por', 'Monto']],
    body: expenses.map((exp, i) => [
      i + 1,
      exp.descripcion,
      exp.expand?.pagado_por?.nombre || '—',
      `${moneda}${Number(exp.monto).toFixed(2)}`,
    ]),
    foot: [['', '', 'TOTAL DEL EVENTO', `${moneda}${balance.total.toFixed(2)}`]],
    headStyles: HEAD_STYLE,
    footStyles: FOOT_STYLE,
    bodyStyles: BODY_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      2: { cellWidth: 36 },
      3: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: ML, right: MR },
    theme: 'striped',
    tableLineColor: SLATE1,
    tableLineWidth: 0.2,
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. BALANCE POR PARTICIPANTE
  // ─────────────────────────────────────────────────────────────────
  y = doc.lastAutoTable.finalY + 8;
  if (y > 240) { doc.addPage(); y = 16; }

  sectionLabel('BALANCE POR PARTICIPANTE');

  const cuota = participants.length > 0 ? balance.total / participants.length : 0;

  autoTable(doc, {
    startY: y,
    head: [['Participante', 'Total pagado', 'Cuota justa', 'Balance']],
    body: balance.summary.map(s => [
      s.nombre === userName ? `${s.nombre}  ★` : s.nombre,
      `${moneda}${s.pagado.toFixed(2)}`,
      `${moneda}${cuota.toFixed(2)}`,
      `${s.balance >= 0 ? '+' : ''}${moneda}${s.balance.toFixed(2)}`,
    ]),
    headStyles: HEAD_STYLE,
    bodyStyles: BODY_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: ML, right: MR },
    theme: 'striped',
    tableLineColor: SLATE1,
    tableLineWidth: 0.2,
    didParseCell(data) {
      if (data.section !== 'body') return;
      const name = String(data.row.raw?.[0] || '');
      const isMe = name.includes('★');
      if (isMe) {
        data.cell.styles.fillColor = GREEN_BG;
        data.cell.styles.textColor = GREEN_FG;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 3) {
        const val = String(data.cell.raw || '');
        if (val.startsWith('+')) {
          data.cell.styles.textColor = isMe ? GREEN_FG : [22, 163, 74];
        } else if (val !== `${moneda}0.00` && !val.startsWith('+')) {
          data.cell.styles.textColor = RED;
        }
      }
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. TRANSFERENCIAS PENDIENTES (if any)
  // ─────────────────────────────────────────────────────────────────
  if (balance.transferencias.length > 0) {
    y = doc.lastAutoTable.finalY + 8;
    if (y > 240) { doc.addPage(); y = 16; }

    sectionLabel('TRANSFERENCIAS PENDIENTES');

    autoTable(doc, {
      startY: y,
      head: [['Quién paga', '', 'A quién', 'Monto']],
      body: balance.transferencias.map(t => [t.de, '→', t.para, `${moneda}${t.monto.toFixed(2)}`]),
      headStyles: HEAD_STYLE,
      bodyStyles: BODY_STYLE,
      columnStyles: {
        1: { halign: 'center', cellWidth: 8, textColor: EMERALD },
        3: { halign: 'right',  cellWidth: 24, fontStyle: 'bold' },
      },
      margin: { left: ML, right: MR },
      theme: 'plain',
      tableLineColor: SLATE1,
      tableLineWidth: 0.2,
      didParseCell(data) {
        if (data.section !== 'body') return;
        const payer = String(data.row.raw?.[0] || '');
        const recv  = String(data.row.raw?.[2] || '');
        if (payer === userName) {
          data.cell.styles.fillColor = AMBER_BG;
          data.cell.styles.textColor = AMBER_FG;
          data.cell.styles.fontStyle = 'bold';
        } else if (recv === userName) {
          data.cell.styles.fillColor = GREEN_BG;
          data.cell.styles.textColor = GREEN_FG;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const fY = 291;
    doc.setFillColor(...DARK);
    doc.rect(0, fY - 2, W, 10, 'F');
    doc.setFillColor(...EMERALD);
    doc.rect(0, fY - 2, 5, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...EMERALD);
    doc.text('SplitPay', ML + 2, fY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('splitpay.istavnile.cloud', ML + 20, fY + 4);
    doc.text(
      new Date().toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      W - MR, fY + 4, { align: 'right' }
    );
    doc.setTextColor(51, 65, 85);
    doc.text(`Pág. ${p} / ${pageCount}`, W / 2, fY + 4, { align: 'center' });
  }

  // ─────────────────────────────────────────────────────────────────
  // SAVE
  // ─────────────────────────────────────────────────────────────────
  const safe = (event?.nombre_evento || 'evento').replace(/[^a-zA-Z0-9\s\-_áéíóúñÁÉÍÓÚÑ]/g, '');
  doc.save(`${safe} — Recibo SplitPay.pdf`);
}
