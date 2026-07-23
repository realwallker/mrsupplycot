import type { Quote } from "../types";
import { quoteTotals } from "../types";

const GOLD: [number, number, number] = [198, 157, 55];
const INK: [number, number, number] = [20, 20, 18];
const MUTED: [number, number, number] = [108, 108, 103];
const LINE: [number, number, number] = [226, 223, 214];

const usd = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safeFile = (value: string) => value.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "_");

async function imageDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function exportQuotePdf(quote: Quote) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const totals = quoteTotals(quote);

  const drawFooter = () => {
    const page = doc.getNumberOfPages();
    doc.setDrawColor(...LINE); doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...INK);
    doc.text("MR SUPPLY", margin, pageHeight - 8);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text("Performance · Wellness · Lifestyle", pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text(`${page}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  };

  doc.setFillColor(...INK); doc.rect(0, 0, pageWidth, 49, "F");
  try {
    const logo = await imageDataUrl("/mrsupply-logo.png");
    doc.addImage(logo, "PNG", margin, 8, 31, 31, undefined, "FAST");
  } catch { /* The wordmark still keeps the PDF branded if an image request fails. */ }
  doc.setTextColor(238, 211, 123); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("MR SUPPLY", 51, 21);
  doc.setTextColor(158, 155, 145); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text("PERFORMANCE · WELLNESS · LIFESTYLE", 51, 27);
  doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("COTIZACIÓN", pageWidth - margin, 15, { align: "right" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(13);
  doc.text(quote.number, pageWidth - margin, 23, { align: "right" });
  doc.setTextColor(160, 158, 151); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text(`Emitida ${quote.issuedAt}  ·  Válida hasta ${quote.validUntil}`, pageWidth - margin, 30, { align: "right" });

  const metaY = 58;
  doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("PREPARADO PARA", margin, metaY);
  doc.setTextColor(...INK); doc.setFontSize(12);
  doc.text(quote.clientName || "Cliente", margin, metaY + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  const contact = [quote.clientId, quote.clientPhone, quote.clientEmail].filter(Boolean).join("   ·   ");
  if (contact) doc.text(contact, margin, metaY + 13, { maxWidth: 115 });
  doc.setFillColor(247, 245, 239); doc.roundedRect(pageWidth - 53, 54, 37, 18, 2, 2, "F");
  doc.setTextColor(...MUTED); doc.setFontSize(6); doc.text("ESTADO", pageWidth - 49, 60);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(quote.status.toUpperCase(), pageWidth - 49, 67);

  autoTable(doc, {
    startY: 79,
    margin: { left: margin, right: margin, bottom: 22 },
    head: [["PRODUCTO", "CANT.", "PVP", "DESC.", "TOTAL"]],
    body: quote.items.map((item) => [
      `${item.name}\n${[item.sku && `SKU ${item.sku}`, item.presentation].filter(Boolean).join("  ·  ")}`,
      String(item.quantity), usd(item.unitPrice), `${item.discount}%`,
      usd(item.quantity * item.unitPrice * (1 - item.discount / 100)),
    ]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, textColor: INK, cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }, lineColor: LINE, lineWidth: { bottom: 0.25 }, valign: "middle" },
    headStyles: { fillColor: INK, textColor: [232, 202, 111], fontStyle: "bold", fontSize: 7, minCellHeight: 10, lineWidth: 0 },
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 16, halign: "center" }, 2: { cellWidth: 23, halign: "right" }, 3: { cellWidth: 18, halign: "center" }, 4: { cellWidth: 28, halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const raw = String(data.cell.raw ?? "").split("\n");
        data.cell.text = raw;
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(...INK); doc.rect(0, 0, pageWidth, 15, "F");
        doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        doc.text(`MR SUPPLY  ·  ${quote.number}`, margin, 9.5);
      }
      drawFooter();
    },
  });

  const finalTableY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 85;
  let sectionY = finalTableY + 10;
  if (sectionY > pageHeight - 75) { doc.addPage(); sectionY = 27; drawFooter(); }

  doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text("NOTAS Y CONDICIONES", margin, sectionY);
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const notes = quote.notes || "Precios expresados en dólares estadounidenses. Disponibilidad sujeta a confirmación.";
  doc.text(doc.splitTextToSize(notes, 98), margin, sectionY + 7);

  const totalsX = pageWidth - 73;
  const valueX = pageWidth - margin;
  const rows: Array<[string, string]> = [["Subtotal", usd(totals.subtotal)]];
  if (totals.discount > 0) rows.push(["Descuento", `-${usd(totals.discount)}`]);
  rows.push([`Impuesto (${quote.taxRate}%)`, usd(totals.tax)]);
  rows.forEach(([label, value], index) => {
    const y = sectionY + index * 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(label, totalsX, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); doc.text(value, valueX, y, { align: "right" });
  });
  const totalY = sectionY + rows.length * 7 + 3;
  doc.setDrawColor(...GOLD); doc.setLineWidth(.7); doc.line(totalsX, totalY - 4, valueX, totalY - 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK); doc.text("TOTAL", totalsX, totalY + 3);
  doc.setFontSize(17); doc.setTextColor(...GOLD); doc.text(usd(totals.total), valueX, totalY + 3, { align: "right" });

  doc.save(`${safeFile(quote.number)}_${safeFile(quote.clientName || "Cliente")}.pdf`);
}
