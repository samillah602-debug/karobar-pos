"use client";

import { useState } from "react";
import { Building2, Truck, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useStore } from "./store-context";
import { Choose, Field, Modal, Picker, dateLabel } from "./controls";
import {
  METHODS,
  blankPerson,
  money,
  paid,
  round,
  stock,
  type Line,
  type Order,
  type Payment,
  type Product,
  type Purchase,
} from "@/lib/pos/model";
import { productName } from "@/lib/pos/i18n";

function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function EditorActions({
  onClose,
  disabled,
}: {
  onClose: () => void;
  disabled: boolean;
}) {
  const { t, busy } = useStore();
  return (
    <div className="modal-actions">
      <button type="button" className="btn" onClick={onClose}>
        {t("Cancel")}
      </button>
      <button type="submit" className="btn primary" disabled={busy || disabled}>
        {t(busy ? "Saving…" : "Save changes")}
      </button>
    </div>
  );
}

function LinesEditor({
  items,
  onChange,
  purchase = false,
}: {
  items: Line[];
  onChange: (items: Line[]) => void;
  purchase?: boolean;
}) {
  const { state, t, lang } = useStore();
  const update = (index: number, value: Partial<Line>) =>
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...value } : item)),
    );
  return (
    <section className="editor-section">
      <h3>{t("Items")}</h3>
      <Picker
        label="Add product"
        value=""
        options={state!.products
          .filter((product) => product.active)
          .map((product) => ({
            id: product.id,
            name: productName(product, lang),
          }))}
        onChange={(id) => {
          const product = state!.products.find((product) => product.id === id);
          if (!product) return;
          const index = items.findIndex((item) => item.productId === id);
          if (index >= 0) update(index, { qty: items[index].qty + 1 });
          else
            onChange([
              ...items,
              {
                productId: id,
                name: product.name,
                qty: 1,
                price: purchase ? product.cost : product.price,
              },
            ]);
        }}
      />
      <div className="editable-lines">
        {items.map((item, index) => (
          <div className="editable-line" key={item.productId}>
            <Field
              label="Item description"
              value={item.name}
              onChange={(name) => update(index, { name })}
              required
            />
            <Field
              label="Quantity"
              type="number"
              step="1"
              min={1}
              value={item.qty}
              onChange={(qty) => update(index, { qty })}
              required
            />
            <Field
              label={purchase ? "Cost price" : "Price"}
              type="number"
              value={item.price}
              onChange={(price) => update(index, { price })}
              required
            />
            <bdi className="line-total">{money(item.qty * item.price)}</bdi>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("Remove item") + " " + item.name}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OrderEditor({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { state, t, busy, act } = useStore();
  const [original] = useState(order);
  const [form, setForm] = useState(() => structuredClone(order));
  const [date, setDate] = useState(localDate(order.date));
  const [reason, setReason] = useState("");
  const set = <K extends keyof Order>(key: K, value: Order[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const subtotal = round(
    form.items.reduce((sum, item) => sum + item.qty * item.price, 0),
  );
  const total = round(subtotal - form.discount + form.shipping + form.charge);
  const refund = Math.max(0, paid(original) - total);
  const dispatched =
    !!original.shipmentDate ||
    ["Delivered", "Returned"].includes(original.status);
  const customerFields = [
    ["name", "Customer name"],
    ["phone", "Phone"],
    ["whatsapp", "WhatsApp number"],
    ["address", "Complete delivery address"],
    ["area", "Area / locality"],
    ["city", "City"],
    ["province", "Province"],
    ["postal", "Postal code"],
  ] as const;
  return (
    <Modal
      title="Edit order"
      description={order.id}
      open
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await act("editOrder", {
              ...form,
              date: new Date(date).toISOString(),
              expectedVersion: original.version || 0,
              reason,
            })
          )
            onClose();
        }}
      >
        <div className="editor-type-buttons">
          {(["city", "outside"] as const).map((type) => (
            <button
              type="button"
              key={type}
              className={"btn " + (form.type === type ? "primary" : "")}
              disabled={dispatched || busy}
              aria-pressed={form.type === type}
              onClick={() => set("type", type)}
            >
              {type === "city" ? <Building2 size={20} /> : <Truck size={20} />}
              {t(type === "city" ? "City order" : "Out-of-city order")}
            </button>
          ))}
        </div>
        {dispatched && (
          <p className="help-text">
            {t("Order type can only change before dispatch.")}
          </p>
        )}
        <Field
          label="Order date"
          type="datetime-local"
          value={date}
          onChange={setDate}
          required
        />
        <section className="editor-section">
          <h3>{t("Customer details")}</h3>
          <div className="editor-customer-picker">
            <Picker
              label="Select customer"
              options={state!.customers}
              value={form.customer.id}
              onChange={(id) => {
                const customer = state!.customers.find(
                  (customer) => customer.id === id,
                );
                if (customer) set("customer", { ...customer });
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={() =>
                set("customer", {
                  ...blankPerson(),
                  city: state!.settings.city,
                })
              }
            >
              {t("New customer")}
            </button>
          </div>
          <div className="form-grid">
            {customerFields.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={form.customer[key]}
                onChange={(value) =>
                  set("customer", { ...form.customer, [key]: value })
                }
                type={["phone", "whatsapp"].includes(key) ? "tel" : "text"}
                className={key === "address" ? "span-2" : ""}
                required={
                  ["name", "phone", "address"].includes(key) ||
                  (form.type === "outside" &&
                    ["whatsapp", "city", "province", "postal"].includes(key))
                }
              />
            ))}
          </div>
          <p className="help-text">
            {t("These delivery details apply to this order only.")}
          </p>
        </section>
        <LinesEditor
          items={form.items}
          onChange={(items) => set("items", items)}
        />
        <section className="editor-section">
          <h3>{t("Payment")}</h3>
          <div className="form-grid">
            <Field
              label="Discount"
              type="number"
              value={form.discount}
              max={subtotal}
              onChange={(value) => set("discount", value)}
              required
            />
            <Field
              label={
                form.type === "city" ? "Delivery charges" : "Shipping charges"
              }
              type="number"
              value={form.shipping}
              onChange={(value) => set("shipping", value)}
              required
            />
            <Field
              label="Business charge name"
              value={form.chargeName}
              onChange={(value) => set("chargeName", value)}
            />
            <Field
              label="Business charge amount"
              type="number"
              value={form.charge}
              onChange={(value) => set("charge", value)}
              required
            />
            <Choose
              label="Payment method"
              value={form.method}
              onChange={(value) => set("method", value)}
              options={METHODS}
            />
          </div>
          <p className="modal-balance">
            {t("Total amount")}
            <strong dir="ltr">{money(total)}</strong>
          </p>
          {refund > 0 &&
            !["Cancelled", "Returned"].includes(original.status) && (
              <p className="editor-notice">
                {t("Refund due")}: <bdi>{money(refund)}</bdi>.{" "}
                {t("Record the refund after saving when money is returned.")}
              </p>
            )}
        </section>
        <div className="form-grid">
          <Field
            label="Special instructions"
            type="textarea"
            value={form.instructions}
            onChange={(value) => set("instructions", value)}
          />
          <Field
            label="Internal notes"
            type="textarea"
            value={form.notes}
            onChange={(value) => set("notes", value)}
          />
          <Field
            label="Reason for change"
            type="textarea"
            value={reason}
            onChange={setReason}
            required
            className="span-2"
          />
        </div>
        <EditorActions
          onClose={onClose}
          disabled={!reason.trim() || !form.items.length || total < 0}
        />
      </form>
    </Modal>
  );
}

export function PurchaseEditor({
  purchase,
  onClose,
}: {
  purchase: Purchase;
  onClose: () => void;
}) {
  const { state, t, act } = useStore();
  const [original] = useState(purchase);
  const [form, setForm] = useState(() => structuredClone(purchase));
  const [date, setDate] = useState(localDate(purchase.date));
  const [reason, setReason] = useState("");
  const set = <K extends keyof Purchase>(key: K, value: Purchase[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const subtotal = round(
    form.items.reduce((sum, item) => sum + item.qty * item.price, 0),
  );
  const total = round(subtotal - form.discount + form.shipping);
  return (
    <Modal
      title="Edit purchase"
      description={purchase.id}
      open
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await act("editPurchase", {
              ...form,
              date: new Date(date).toISOString(),
              expectedVersion: original.version || 0,
              reason,
            })
          )
            onClose();
        }}
      >
        <div className="form-grid">
          <Picker
            label="Select supplier"
            options={state!.suppliers}
            value={form.supplierId}
            onChange={(value) => set("supplierId", value)}
          />
          <Field
            label="Purchase date"
            type="datetime-local"
            value={date}
            onChange={setDate}
            required
          />
        </div>
        <LinesEditor
          items={form.items}
          onChange={(items) => set("items", items)}
          purchase
        />
        <div className="form-grid">
          <Field
            label="Discount"
            type="number"
            value={form.discount}
            max={subtotal}
            onChange={(value) => set("discount", value)}
            required
          />
          <Field
            label="Shipping charges"
            type="number"
            value={form.shipping}
            onChange={(value) => set("shipping", value)}
            required
          />
          <Field
            label="Notes"
            type="textarea"
            value={form.notes}
            onChange={(value) => set("notes", value)}
            className="span-2"
          />
          <Field
            label="Reason for change"
            type="textarea"
            value={reason}
            onChange={setReason}
            required
            className="span-2"
          />
        </div>
        <p className="modal-balance">
          {t("Total amount")}
          <strong dir="ltr">{money(total)}</strong>
        </p>
        {paid(original) > total && (
          <p className="editor-notice">
            {t("Supplier credit")}: <bdi>{money(paid(original) - total)}</bdi>
          </p>
        )}
        <EditorActions
          onClose={onClose}
          disabled={
            !reason.trim() ||
            !form.items.length ||
            !form.supplierId ||
            total < 0
          }
        />
      </form>
    </Modal>
  );
}

export function PaymentEditor({
  entry,
  payment,
  kind,
  onClose,
}: {
  entry: Order | Purchase;
  payment: Payment;
  kind: "order" | "purchase";
  onClose: () => void;
}) {
  const { t, act } = useStore();
  const [original] = useState(entry);
  const [amount, setAmount] = useState(Math.abs(payment.amount));
  const [method, setMethod] = useState(payment.method);
  const [date, setDate] = useState(localDate(payment.date));
  const [note, setNote] = useState(payment.note);
  const [reason, setReason] = useState("");
  const [voided, setVoided] = useState(false);
  return (
    <Modal
      title={payment.amount < 0 ? "Edit refund" : "Edit payment"}
      description={entry.id}
      open
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await act("editPayment", {
              id: entry.id,
              kind,
              paymentId: payment.id,
              expectedVersion: original.version || 0,
              amount,
              method,
              date: new Date(date).toISOString(),
              note,
              reason,
              void: voided,
            })
          )
            onClose();
        }}
      >
        <p className="help-text">
          {t("Corrections update the record only. They do not move money.")}
        </p>
        <div className="form-grid">
          <Field
            label="Amount"
            type="number"
            min={0.01}
            value={amount}
            onChange={setAmount}
            required
            disabled={voided}
          />
          <Choose
            label="Payment method"
            value={method}
            onChange={setMethod}
            options={METHODS}
          />
          <Field
            label="Payment date"
            type="datetime-local"
            value={date}
            onChange={setDate}
            required
            className="span-2"
          />
          <Field
            label="Payment notes"
            value={note}
            onChange={setNote}
            type="textarea"
            className="span-2"
          />
          <Field
            label="Reason for change"
            value={reason}
            onChange={setReason}
            type="textarea"
            required
            className="span-2"
          />
        </div>
        <label className="switch-field">
          <Switch checked={voided} onCheckedChange={setVoided} />
          {t("Void this entry")}
        </label>
        {voided && (
          <p className="editor-notice">
            {t(
              "The amount becomes zero. The original entry stays in change history.",
            )}
          </p>
        )}
        <EditorActions
          onClose={onClose}
          disabled={!reason.trim() || amount <= 0}
        />
      </form>
    </Modal>
  );
}

export function StockEditor({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { state, t, act } = useStore();
  const [original] = useState(() => stock(state!, product.id));
  const [onHand, setOnHand] = useState(original.onHand);
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Adjust stock"
      description={product.name}
      open
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await act("adjustStock", {
              productId: product.id,
              expectedOnHand: original.onHand,
              onHand,
              reason,
            })
          )
            onClose();
        }}
      >
        <p className="help-text">
          {t("Reserved")}: {original.reserved} · {t("Available")}:{" "}
          {original.available}
        </p>
        <div className="stack-fields">
          <Field
            label="Counted stock on hand"
            type="number"
            step="1"
            min={original.reserved}
            value={onHand}
            onChange={setOnHand}
            required
          />
          <Field
            label="Reason for change"
            type="textarea"
            value={reason}
            onChange={setReason}
            required
          />
        </div>
        <p className="editor-notice">
          {t("Stock adjustment")}:{" "}
          <bdi>
            {onHand - original.onHand > 0 ? "+" : ""}
            {onHand - original.onHand}
          </bdi>{" "}
          {t("Units")}
        </p>
        <EditorActions
          onClose={onClose}
          disabled={!reason.trim() || onHand === original.onHand}
        />
      </form>
    </Modal>
  );
}

const fieldLabels: Record<string, string> = {
  name: "Name",
  nameUr: "Urdu name",
  namePa: "Punjabi name",
  sku: "SKU",
  barcode: "Barcode / QR value",
  category: "Category",
  price: "Price",
  cost: "Cost price",
  openingStock: "Opening stock",
  onHand: "On hand",
  reorderLevel: "Reorder level",
  active: "Active",
  phone: "Phone",
  whatsapp: "WhatsApp number",
  address: "Address",
  area: "Area / locality",
  city: "City",
  province: "Province",
  postal: "Postal code",
  notes: "Notes",
  website: "Website",
  pattern: "Tracking URL pattern",
  contact: "Contact information",
  date: "Date",
  type: "Order type",
  customerId: "Customer",
  customer: "Customer details",
  supplierId: "Supplier",
  items: "Items",
  payments: "Payment history",
  discount: "Discount",
  shipping: "Shipping charges",
  charge: "Business charge amount",
  chargeName: "Business charge name",
  total: "Total",
  method: "Payment method",
  status: "Status",
  trackingStatus: "Delivery status",
  courierId: "Courier",
  trackingNumber: "Tracking number",
  shipmentDate: "Shipment date",
  expectedDate: "Expected delivery date",
  trackingUrl: "Tracking URL",
  deliveryNotes: "Delivery notes",
  instructions: "Special instructions",
  stage: "Stock workflow",
  restocked: "Returned units",
  returnReceived: "Return received",
  storeName: "Store name",
  stockDeduction: "Stock workflow",
  deliveryCharge: "Delivery charges",
  shippingCharge: "Shipping charges",
  extraChargeName: "Business charge name",
  extraCharge: "Business charge amount",
  receiptNote: "Receipt message",
};

export function ChangeHistory({ recordId }: { recordId?: string }) {
  const { state, t } = useStore();
  const [limit, setLimit] = useState(20);
  const records = (state!.changes || []).filter(
    (change) => !recordId || change.recordId === recordId,
  );
  const recordName = (id: string) =>
    id === "settings"
      ? t("Settings")
      : [
          ...state!.products,
          ...state!.customers,
          ...state!.suppliers,
          ...state!.couriers,
        ].find((item) => item.id === id)?.name || id;
  const display = (value: unknown, field: string): string => {
    if (value == null || value === "") return "—";
    if (
      field === "customerId" ||
      field === "supplierId" ||
      field === "courierId"
    ) {
      return (
        [...state!.customers, ...state!.suppliers, ...state!.couriers].find(
          (item) => item.id === value,
        )?.name || String(value)
      );
    }
    if (typeof value === "boolean") return t(value ? "Yes" : "No");
    if (Array.isArray(value))
      return (
        value
          .map((item) => {
            if ("productId" in item)
              return `${item.name || state!.products.find((product) => product.id === item.productId)?.name || ""} × ${item.qty}${item.price !== undefined ? " · " + money(item.price) : ""}`;
            if ("amount" in item)
              return `${dateLabel(item.date)} · ${t(item.method)} · ${money(item.amount)}${item.voided ? " · " + t("Voided") : ""}`;
            return String(item);
          })
          .join("\n") || "—"
      );
    if (typeof value === "object")
      return Object.entries(value)
        .filter(([key, item]) => !["id", "version"].includes(key) && item)
        .map(([key, item]) => `${t(fieldLabels[key] || key)}: ${String(item)}`)
        .join("\n");
    return typeof value === "string" ? t(value) : String(value);
  };
  return (
    <section className="change-history">
      <h3>{t("Change history")}</h3>
      {!records.length && (
        <p className="help-text">{t("No corrections yet.")}</p>
      )}
      {records.slice(0, limit).map((change) => (
        <details key={change.id} className="change-entry">
          <summary>
            <span>
              <b>{t(change.action)}</b>
              <small>
                {dateLabel(change.date, true)}
                {!recordId ? " · " + recordName(change.recordId) : ""}
              </small>
            </span>
          </summary>
          {change.reason && <p>{change.reason}</p>}
          <dl>
            {change.changes.map((item) => (
              <div className="change-field" key={item.field}>
                <dt>{t(fieldLabels[item.field] || item.field)}</dt>
                <dd>
                  <span>{t("Before")}</span>
                  <p>{display(item.before, item.field)}</p>
                </dd>
                <dd>
                  <span>{t("After")}</span>
                  <p>{display(item.after, item.field)}</p>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
      {records.length > limit && (
        <button
          type="button"
          className="btn"
          onClick={() => setLimit((value) => value + 20)}
        >
          {t("Show more")}
        </button>
      )}
    </section>
  );
}
