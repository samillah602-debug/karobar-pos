import {
  due,
  money,
  refundDue,
  balanceDue,
  paid,
  paymentStatus,
  type StoreState,
  type Order,
  type Lang,
  type Purchase,
} from "./model";
import { translator, productName } from "./i18n";
export const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function download(name: string, type: string, body: string) {
  const u = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function csvExport(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    let x = String(v);
    if (/^[\s]*[=+@-]/.test(x) && typeof v !== "number") x = "'" + x;
    return '"' + x.replaceAll('"', '""') + '"';
  };
  download(
    name + ".csv",
    "text/csv;charset=utf-8",
    "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n"),
  );
}
export function excelExport(name: string, rows: (string | number)[][]) {
  const data =
    '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table>' +
    rows
      .map(
        (r) =>
          "<Row>" +
          r
            .map(
              (v) =>
                '<Cell><Data ss:Type="' +
                (typeof v === "number" ? "Number" : "String") +
                '">' +
                escape(v) +
                "</Data></Cell>",
            )
            .join("") +
          "</Row>",
      )
      .join("") +
    "</Table></Worksheet></Workbook>";
  download(name + ".xml", "application/vnd.ms-excel;charset=utf-8", data);
}
export function printDocument(title: string, body: string, lang: Lang) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", title);
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:900px;height:1000px;border:0";
  document.body.appendChild(frame);
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.onafterprint = () => setTimeout(() => frame.remove(), 500);
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
    setTimeout(() => frame.remove(), 180000);
  };
  frame.srcdoc = `<!doctype html><html lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}"><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4;margin:16mm}body{font:14px/1.6 'Segoe UI',Tahoma,Arial,sans-serif;color:#172c27;margin:0}h1{font-size:26px;margin:0 0 5px}h2{font-size:18px}header{border-bottom:3px solid #17634c;padding-bottom:15px;margin-bottom:20px}p{margin:3px 0}.muted{color:#65756e;font-size:12px}table{border-collapse:collapse;width:100%;margin:20px 0;font-size:12px}th,td{padding:9px;text-align:start;border-bottom:1px solid #dbe5df}th{background:#ecf5ef}tr{break-inside:avoid}.totals{margin-inline-start:auto;width:300px}.totals div{display:flex;justify-content:space-between;padding:6px 0}.total{border-top:2px solid #17634c;font-weight:700;font-size:18px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px}footer{margin-top:28px;border-top:1px solid #dbe5df;padding-top:12px;font-size:12px}bdi{direction:ltr}</style></head><body>${body}</body></html>`;
}
export function orderRows(
  s: StoreState,
  orders: Order[],
  lang: Lang,
): (string | number)[][] {
  const t = translator(lang);
  return [
    [
      "Order ID",
      "Invoice",
      "Date",
      "Customer",
      "Phone",
      "City",
      "Order type",
      "Amount",
      "Payment status",
      "Delivery status",
      "Courier",
      "Tracking number",
    ].map(t),
    ...orders.map((o) => [
      o.id,
      o.invoice,
      o.date.slice(0, 10),
      o.customer.name,
      o.customer.phone,
      o.customer.city,
      t(o.type === "city" ? "City order" : "Out-of-city order"),
      o.total,
      t(paymentStatus(o)),
      t(o.type === "outside" ? o.trackingStatus : o.status),
      s.couriers.find((c) => c.id === o.courierId)?.name || "",
      o.trackingNumber,
    ]),
  ];
}
export function reportHTML(
  title: string,
  rows: (string | number)[][],
  s: StoreState,
  range: string,
) {
  return `<header><h1>${escape(s.settings.storeName)}</h1><p>${escape(title)}</p><p class="muted">${escape(range)} · PKR</p>${s.demo ? '<p class="muted">' + escape(translator("en")("Sample data")) + "</p>" : ""}</header><table><thead><tr>${rows[0].map((x) => `<th>${escape(x)}</th>`).join("")}</tr></thead><tbody>${rows
    .slice(1)
    .map((r) => `<tr>${r.map((x) => `<td>${escape(x)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}
export function receiptHTML(s: StoreState, o: Order, lang: Lang) {
  const t = translator(lang);
  const row = (label: string, value: string) =>
    `<div><span>${escape(t(label))}</span><bdi>${escape(value)}</bdi></div>`;
  return `<header><h1>${escape(s.settings.storeName)}</h1><p>${escape(s.settings.address)} ${escape(s.settings.phone)}</p><p>${escape(t("Invoice"))} · ${escape(o.invoice)}</p>${s.demo ? `<p class="muted">${escape(t("Sample data"))}</p>` : ""}</header><div class="meta"><div><h2>${escape(o.customer.name)}</h2><p>${escape(o.customer.phone)}</p><p>${escape(o.customer.address)}</p><p>${escape(o.customer.area)} ${escape(o.customer.city)} ${escape(o.customer.province)} ${escape(o.customer.postal)}</p></div><div><p><b>${escape(o.id)}</b></p><p>${escape(new Date(o.date).toLocaleDateString("en-GB"))}</p><p>${escape(t(o.type === "city" ? "City order" : "Out-of-city order"))}</p><p>${escape(t(o.type === "outside" ? o.trackingStatus : o.status))} · ${escape(t(paymentStatus(o)))}</p></div></div><table><thead><tr>${["Product", "Quantity", "Price", "Total"].map((x) => `<th>${escape(t(x))}</th>`).join("")}</tr></thead><tbody>${o.items
    .map((i) => {
      const p = s.products.find((p) => p.id === i.productId);
      return `<tr><td>${escape(p && lang !== "en" && i.name === p.name ? productName(p, lang) : i.name)}</td><td>${i.qty}</td><td><bdi>${money(i.price)}</bdi></td><td><bdi>${money(i.qty * i.price)}</bdi></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table><div class="totals">${row("Subtotal", money(o.items.reduce((a, i) => a + i.price * i.qty, 0)))}${row("Discount", money(o.discount))}${row("Delivery charges", money(o.shipping))}${o.charge ? row(o.chargeName, money(o.charge)) : ""}<div class="total"><span>${escape(t("Total amount"))}</span><bdi>${money(o.total)}</bdi></div>${row("Amount received", money(paid(o)))}${row("Balance due", money(due(o)))}${paymentStatus(o) === "Refund due" ? row("Refund due", money(refundDue(o))) : ""}${row("Payment method", t(o.method))}</div>${o.type === "outside" ? `<h2>${escape(t("Shipment details"))}</h2><p>${escape(s.couriers.find((c) => c.id === o.courierId)?.name || "")} · ${escape(o.trackingNumber)}</p><p>${escape(t("Expected delivery"))}: ${escape(o.expectedDate || "—")}</p>` : ""}${o.instructions ? `<p>${escape(o.instructions)}</p>` : ""}<footer>${escape(s.settings.receiptNote)}<br/>${escape(t("All amounts in PKR"))}</footer>`;
}
export function purchaseHTML(s: StoreState, p: Purchase, lang: Lang) {
  const t = translator(lang),
    supplier = s.suppliers.find((x) => x.id === p.supplierId);
  return `<header><h1>${escape(s.settings.storeName)}</h1><p>${escape(t("Purchase details"))} · ${escape(p.id)}</p></header><h2>${escape(supplier?.name)}</h2><p>${escape(supplier?.phone)} · ${escape(p.date.slice(0, 10))}</p><table><thead><tr>${["Product", "Quantity", "Price", "Total"].map((x) => `<th>${escape(t(x))}</th>`).join("")}</tr></thead><tbody>${p.items.map((i) => `<tr><td>${escape(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.qty * i.price)}</td></tr>`).join("")}</tbody></table><p>${t("Discount")}: ${money(p.discount)}</p><p>${t("Shipping charges")}: ${money(p.shipping)}</p><h2>${t("Total")}: ${money(p.total)}</h2><p>${t("Amount paid")}: ${money(paid(p))}</p><p>${t("Balance due")}: ${money(balanceDue(p))}</p>${refundDue(p) > 0 ? `<p>${escape(t("Supplier credit"))}: ${money(refundDue(p))}</p>` : ""}<footer>${escape(t("All amounts in PKR"))}</footer>`;
}
