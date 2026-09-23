"use client";
import React, { useEffect, useState } from "react";
import {
  Plus,
  Package,
  Search,
  Truck,
  Users,
  PenLine,
  ExternalLink,
  Phone,
  MapPin,
  Trash2,
  Wallet,
  ArrowUpRight,
  Printer,
  Download,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { useStore } from "./store-context";
import {
  Badge,
  Choose,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Picker,
  SearchBox,
  TabBar,
  dateLabel,
} from "./controls";
import {
  CATEGORIES,
  METHODS,
  blankPerson,
  due,
  money,
  paid,
  stock,
  reversed,
  round,
  categories,
  refundDue,
  balanceDue,
  type Product,
  type Person,
  type Courier,
  type Settings,
  type Order,
} from "@/lib/pos/model";
import { productName } from "@/lib/pos/i18n";
import { orderColumns } from "./orders";
import { PaymentModal, PurchaseDetail } from "./order-detail";
import { StockEditor, ChangeHistory } from "./record-editors";
import { csvExport } from "@/lib/pos/exports";
const productDefaults = (): Product => ({
  id: "",
  name: "",
  nameUr: "",
  namePa: "",
  sku: "",
  barcode: "",
  category: "Kitchen",
  price: 0,
  cost: 0,
  openingStock: 0,
  reorderLevel: 10,
  active: true,
});
function ProductForm({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { t, act, busy } = useStore();
  const { watch, setValue, reset, handleSubmit } = useForm<Product>({
    defaultValues: productDefaults(),
  });
  const f = watch();
  useEffect(() => {
    if (product) reset(product);
  }, [product]);
  if (!product) return null;
  return (
    <Modal
      title={product.id ? "Edit product" : "Add product"}
      open={!!product}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={handleSubmit(async (values) => {
          if (await act("product", values)) onClose();
        })}
      >
        <div className="form-grid">
          <Field
            label="Product name"
            value={f.name}
            onChange={(v) => setValue("name", v)}
            required
            className="span-2"
          />
          <Field
            label="Urdu name"
            value={f.nameUr}
            onChange={(v) => setValue("nameUr", v)}
          />
          <Field
            label="Punjabi name"
            value={f.namePa}
            onChange={(v) => setValue("namePa", v)}
          />
          <Field
            label="SKU"
            value={f.sku}
            onChange={(v) => setValue("sku", v)}
            required
          />
          <Field
            label="Barcode / QR value"
            value={f.barcode}
            onChange={(v) => setValue("barcode", v)}
          />
          <Field
            label="Category"
            value={f.category}
            onChange={(v) => setValue("category", v)}
            required
          />
          <Field
            label="Reorder level"
            value={f.reorderLevel}
            onChange={(v) => setValue("reorderLevel", v)}
            type="number"
            step="1"
          />
          <Field
            label="Selling price"
            value={f.price}
            onChange={(v) => setValue("price", v)}
            type="number"
            required
          />
          <Field
            label="Cost price"
            value={f.cost}
            onChange={(v) => setValue("cost", v)}
            type="number"
            required
          />
          <Field
            label="Opening stock"
            value={f.openingStock}
            onChange={(v) => setValue("openingStock", v)}
            type="number"
            step="1"
            disabled={!!f.id}
          />
          <label className="switch-field">
            <Switch
              checked={f.active}
              onCheckedChange={(v) => setValue("active", v)}
            />
            {t("Active")}
          </label>
        </div>
        {f.id && (
          <p className="help-text">
            {t(
              "Use Adjust stock to correct a count, or Purchases to receive new stock.",
            )}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {t(busy ? "Saving…" : "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Products() {
  const { state: s, t, lang } = useStore();
  const [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [active, setActive] = useState(false),
    [edit, setEdit] = useState<Product | null>(null),
    [adjusting, setAdjusting] = useState<Product | null>(null);
  const products = s!.products.filter(
    (p) =>
      (active || p.active) &&
      (!category || p.category === category) &&
      [p.name, p.nameUr, p.namePa, p.sku, p.barcode]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const totals = s!.products.reduce(
    (acc, p) => {
      const x = stock(s!, p.id);
      return {
        available: acc.available + x.available,
        reserved: acc.reserved + x.reserved,
        sold: acc.sold + x.sold,
        returned: acc.returned + x.returned,
      };
    },
    { available: 0, reserved: 0, sold: 0, returned: 0 },
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Products")}</h1>
          <p>{t("Know what is available, reserved, and sold.")}</p>
        </div>
        <div className="actions">
          <button
            className="btn"
            onClick={() =>
              csvExport("karobar-inventory", [
                [
                  "Product",
                  "SKU",
                  "Barcode / QR value",
                  "Category",
                  "Price",
                  "On hand",
                  "Available",
                  "Reserved",
                  "Sold",
                  "Returned stock",
                ].map(t),
                ...products.map((p) => {
                  const a = stock(s!, p.id);
                  return [
                    productName(p, lang),
                    p.sku,
                    p.barcode,
                    t(p.category),
                    p.price,
                    a.onHand,
                    a.available,
                    a.reserved,
                    a.sold,
                    a.returned,
                  ];
                }),
              ])
            }
          >
            <Download size={16} />
            {t("CSV")}
          </button>
          <button
            className="btn primary"
            onClick={() => setEdit(productDefaults())}
          >
            <Plus size={17} />
            {t("Add product")}
          </button>
        </div>
      </div>
      <div className="stat-grid">
        {[
          ["Available", totals.available],
          ["Reserved", totals.reserved],
          ["Sold", totals.sold],
          ["Returned stock", totals.returned],
        ].map(([label, value], i) => (
          <div className="stat-card" key={label}>
            <div>
              <span>{t(String(label))}</span>
              <span className={"stat-icon tone-" + i}>
                <Package size={19} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{t("Units")}</small>
          </div>
        ))}
      </div>
      <section className="surface">
        <div className="list-toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search products or scan a barcode…"
          />
          <Choose
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "All categories" },
              ...categories(s!),
            ]}
            placeholder="Category"
          />
          <label className="switch-field">
            <Switch checked={active} onCheckedChange={setActive} />
            {t("Show inactive products")}
          </label>
        </div>
        <DataTable
          data={products}
          onRow={setEdit}
          columns={[
            {
              key: "name",
              label: "Product",
              value: (p) => p.name,
              render: (p) => (
                <div className="person-cell">
                  <span className="product-mini">
                    <Package size={20} />
                  </span>
                  <div>
                    <b>{productName(p, lang)}</b>
                    <small>{p.sku}</small>
                  </div>
                </div>
              ),
            },
            { key: "category", label: "Category", value: (p) => t(p.category) },
            {
              key: "price",
              label: "Selling price",
              value: (p) => p.price,
              render: (p) => <bdi>{money(p.price)}</bdi>,
            },
            {
              key: "available",
              label: "Available",
              value: (p) => stock(s!, p.id).available,
            },
            {
              key: "reserved",
              label: "Reserved",
              value: (p) => stock(s!, p.id).reserved,
            },
            { key: "sold", label: "Sold", value: (p) => stock(s!, p.id).sold },
            {
              key: "status",
              label: "Status",
              value: (p) => (p.active ? "Active" : "Inactive"),
              render: (p) => (
                <Badge
                  value={
                    !p.active
                      ? "Inactive"
                      : stock(s!, p.id).available <= 0
                        ? "Out of stock"
                        : stock(s!, p.id).available <= p.reorderLevel
                          ? "Low stock"
                          : "In stock"
                  }
                />
              ),
            },
            {
              key: "adjust",
              label: "Adjust stock",
              value: (p) => p.id,
              render: (p) => (
                <button
                  className="btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdjusting(p);
                  }}
                >
                  <SlidersHorizontal size={15} />
                  {t("Adjust stock")}
                </button>
              ),
            },
          ]}
        />
      </section>
      <ProductForm product={edit} onClose={() => setEdit(null)} />
      {adjusting && (
        <StockEditor product={adjusting} onClose={() => setAdjusting(null)} />
      )}
    </>
  );
}
function PersonForm({
  person,
  kind,
  onClose,
}: {
  person: Person | null;
  kind: "customers" | "suppliers";
  onClose: () => void;
}) {
  const { t, act, busy } = useStore();
  const [f, setF] = useState(blankPerson());
  useEffect(() => {
    if (person) setF(person);
  }, [person]);
  if (!person) return null;
  const fields = [
    ["name", "Name"],
    ["phone", "Phone"],
    ["whatsapp", "WhatsApp number"],
    ["city", "City"],
    ["province", "Province"],
    ["postal", "Postal code"],
    ["area", "Area / locality"],
    ["address", "Address"],
    ["notes", "Notes"],
  ] as const;
  return (
    <Modal
      title={
        kind === "customers"
          ? person.id
            ? "Edit customer"
            : "Add customer"
          : person.id
            ? "Edit supplier"
            : "Add supplier"
      }
      open={!!person}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("person", { kind, person: f })) onClose();
        }}
      >
        <div className="form-grid">
          {fields.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={f[key]}
              onChange={(v) => setF({ ...f, [key]: v })}
              required={key === "name"}
              type={
                key === "notes"
                  ? "textarea"
                  : ["phone", "whatsapp"].includes(key)
                    ? "tel"
                    : "text"
              }
              className={["address", "notes"].includes(key) ? "span-2" : ""}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {t("Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function People({
  kind,
  onOrder,
  onPurchase,
}: {
  kind: "customers" | "suppliers";
  onOrder: (id: string) => void;
  onPurchase: (id: string) => void;
}) {
  const { state: s, t } = useStore();
  const [q, setQ] = useState(""),
    [edit, setEdit] = useState<Person | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [history, setHistory] = useState("All orders");
  const people = s![kind].filter((p) =>
    [p.name, p.phone, p.city].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  const person = s![kind].find((p) => p.id === selected);
  const orders = person
    ? s!.orders.filter((o) => o.customerId === person.id)
    : [];
  const purchases = person
    ? s!.purchases.filter((o) => o.supplierId === person.id)
    : [];
  const historyOrders = orders.filter(
    (o) =>
      history === "All orders" ||
      (history === "City orders" && o.type === "city") ||
      (history === "Out-of-city orders" && o.type === "outside") ||
      (history === "Pending orders" &&
        !["Delivered", "Returned", "Cancelled"].includes(o.status)) ||
      (history === "Delivered orders" && o.status === "Delivered") ||
      (history === "Cancelled orders" && o.status === "Cancelled") ||
      (history === "Returned orders" && o.status === "Returned"),
  );
  const balance = (id: string) =>
    kind === "customers"
      ? s!.orders
          .filter((o) => o.customerId === id)
          .reduce((a, o) => a + due(o), 0)
      : s!.purchases
          .filter((p) => p.supplierId === id)
          .reduce((a, p) => a + balanceDue(p), 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t(kind === "customers" ? "Customers" : "Suppliers")}</h1>
          <p>
            {t(
              kind === "customers"
                ? "Keep customer details and order history together."
                : "Your suppliers and their purchase accounts.",
            )}
          </p>
        </div>
        <button className="btn primary" onClick={() => setEdit(blankPerson())}>
          <Plus size={17} />
          {t(kind === "customers" ? "Add customer" : "Add supplier")}
        </button>
      </div>
      <section className="surface">
        <div className="list-toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Customer / phone" />
        </div>
        <DataTable
          data={people}
          onRow={(p) => {
            setSelected(p.id);
            setHistory("All orders");
          }}
          columns={[
            {
              key: "name",
              label: "Name",
              value: (p) => p.name,
              render: (p) => (
                <div className="person-cell">
                  <span className="avatar">
                    {p.name
                      .split(" ")
                      .slice(0, 2)
                      .map((x) => x[0])
                      .join("")}
                  </span>
                  <b>{p.name}</b>
                </div>
              ),
            },
            {
              key: "phone",
              label: "Phone",
              value: (p) => p.phone,
              render: (p) => <bdi>{p.phone || "—"}</bdi>,
            },
            { key: "city", label: "City", value: (p) => p.city },
            {
              key: "orders",
              label: kind === "customers" ? "Orders" : "Purchases",
              value: (p) =>
                kind === "customers"
                  ? s!.orders.filter((o) => o.customerId === p.id).length
                  : s!.purchases.filter((o) => o.supplierId === p.id).length,
            },
            {
              key: "balance",
              label: "Balance due",
              value: (p) => balance(p.id),
              render: (p) => (
                <bdi className={balance(p.id) ? "balance-amount" : ""}>
                  {money(balance(p.id))}
                </bdi>
              ),
            },
            {
              key: "edit",
              label: "Edit",
              value: (p) => p.id,
              render: (p) => (
                <button
                  aria-label={t("Edit") + " " + p.name}
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEdit({ ...p });
                  }}
                >
                  <PenLine size={16} />
                </button>
              ),
            },
          ]}
        />
      </section>
      <PersonForm person={edit} kind={kind} onClose={() => setEdit(null)} />
      {person && (
        <Modal
          title={kind === "customers" ? "Customer details" : "Supplier"}
          open={!!selected}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="profile-head">
            <span className="avatar large">{person.name[0]}</span>
            <div>
              <h2>{person.name}</h2>
              <p>
                <bdi>{person.phone}</bdi> · {person.city}
              </p>
              <small>{person.address}</small>
              {person.whatsapp && (
                <p>
                  {t("WhatsApp number")}: <bdi>{person.whatsapp}</bdi>
                </p>
              )}
            </div>
            <div className="profile-balance">
              <small>{t("Balance due")}</small>
              <bdi>{money(balance(person.id))}</bdi>
            </div>
          </div>
          {person.notes && <p className="help-text">{person.notes}</p>}
          {kind === "customers" ? (
            <>
              <TabBar
                value={history}
                onChange={setHistory}
                items={[
                  "All orders",
                  "City orders",
                  "Out-of-city orders",
                  "Delivered orders",
                  "Pending orders",
                  "Cancelled orders",
                  "Returned orders",
                ]}
              />
              <DataTable
                data={historyOrders}
                columns={[
                  ...orderColumns(t),
                  {
                    key: "tracking",
                    label: "Tracking number",
                    value: (o) => o.trackingNumber,
                  },
                ]}
                onRow={(o) => {
                  setSelected(null);
                  onOrder(o.id);
                }}
              />
            </>
          ) : (
            <DataTable
              data={purchases}
              columns={[
                { key: "id", label: "Purchase ID", value: (p) => p.id },
                {
                  key: "date",
                  label: "Date",
                  value: (p) => p.date,
                  render: (p) => dateLabel(p.date),
                },
                {
                  key: "total",
                  label: "Amount",
                  value: (p) => p.total,
                  render: (p) => money(p.total),
                },
                {
                  key: "balance",
                  label: "Balance due",
                  value: (p) => balanceDue(p),
                  render: (p) => money(balanceDue(p)),
                },
              ]}
              onRow={(p) => {
                setSelected(null);
                onPurchase(p.id);
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
export function Purchases({
  onPurchase,
}: {
  onPurchase: (id: string) => void;
}) {
  const { state: s, t, lang, busy, act } = useStore();
  const [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    [supplier, setSupplier] = useState(""),
    [pick, setPick] = useState("");
  const [items, setItems] = useState<
    { productId: string; qty: number; price: number }[]
  >([]);
  const [discount, setDiscount] = useState(0),
    [shipping, setShipping] = useState(0),
    [payment, setPayment] = useState(0),
    [method, setMethod] = useState("Cash"),
    [notes, setNotes] = useState("");
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0),
    total = round(Math.max(0, subtotal - discount + shipping));
  const rows = s!.purchases.filter((p) =>
    [p.id, s!.suppliers.find((x) => x.id === p.supplierId)?.name]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const start = () => {
    setSupplier("");
    setItems([]);
    setDiscount(0);
    setShipping(0);
    setPayment(0);
    setMethod("Cash");
    setNotes("");
    setOpen(true);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Purchases")}</h1>
          <p>{t("Receive stock and manage supplier payments.")}</p>
        </div>
        <button className="btn primary" onClick={start}>
          <Plus size={17} />
          {t("New purchase")}
        </button>
      </div>
      <section className="surface">
        <div className="list-toolbar">
          <SearchBox value={q} onChange={setQ} />
        </div>
        <DataTable
          data={rows}
          onRow={(p) => onPurchase(p.id)}
          columns={[
            { key: "id", label: "Purchase ID", value: (p) => p.id },
            {
              key: "date",
              label: "Date",
              value: (p) => p.date,
              render: (p) => dateLabel(p.date),
            },
            {
              key: "supplier",
              label: "Supplier",
              value: (p) =>
                s!.suppliers.find((x) => x.id === p.supplierId)?.name || "",
            },
            {
              key: "total",
              label: "Total",
              value: (p) => p.total,
              render: (p) => money(p.total),
            },
            {
              key: "paid",
              label: "Amount paid",
              value: (p) => paid(p),
              render: (p) => money(paid(p)),
            },
            {
              key: "due",
              label: "Balance due",
              value: (p) => balanceDue(p),
              render: (p) => money(balanceDue(p)),
            },
          ]}
        />
      </section>
      <Modal
        title="New purchase"
        description="Receive stock and manage supplier payments."
        open={open}
        onClose={() => setOpen(false)}
        wide
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const n = await act(
              "purchase",
              {
                supplierId: supplier,
                items,
                discount,
                shipping,
                payment,
                method,
                notes,
              },
              "Purchase received",
            );
            if (n) {
              setOpen(false);
              onPurchase(n.purchases[0].id);
            }
          }}
        >
          <Picker
            label="Select supplier"
            options={s!.suppliers}
            value={supplier}
            onChange={setSupplier}
          />
          <div className="purchase-product-picker">
            <Picker
              label="Add product"
              options={s!.products
                .filter((p) => p.active)
                .map((p) => ({ id: p.id, name: productName(p, lang) }))}
              value={pick}
              onChange={(id) => {
                setPick("");
                const p = s!.products.find((x) => x.id === id);
                if (!p) return;
                setItems((a) =>
                  a.some((i) => i.productId === id)
                    ? a.map((i) =>
                        i.productId === id ? { ...i, qty: i.qty + 1 } : i,
                      )
                    : [...a, { productId: id, qty: 1, price: p.cost }],
                );
              }}
            />
          </div>
          <div className="purchase-lines">
            {items.map((i, n) => (
              <div key={i.productId}>
                <span>
                  {s!.products.find((p) => p.id === i.productId)?.name}
                </span>
                <Field
                  label="Quantity"
                  type="number"
                  step="1"
                  value={i.qty}
                  min={1}
                  onChange={(v) =>
                    setItems((a) =>
                      a.map((i, j) => (j === n ? { ...i, qty: v } : i)),
                    )
                  }
                />
                <Field
                  label="Cost price"
                  type="number"
                  value={i.price}
                  onChange={(v) =>
                    setItems((a) =>
                      a.map((i, j) => (j === n ? { ...i, price: v } : i)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={t("Remove item")}
                  className="icon-btn"
                  onClick={() => setItems((a) => a.filter((_, j) => j !== n))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="form-grid">
            <Field
              label="Discount"
              type="number"
              value={discount}
              max={subtotal}
              onChange={setDiscount}
            />
            <Field
              label="Shipping charges"
              type="number"
              value={shipping}
              onChange={setShipping}
            />
            <Choose
              label="Payment method"
              value={method}
              onChange={setMethod}
              options={METHODS.filter((m) => m !== "Cash on delivery")}
            />
            <Field
              label="Amount paid"
              type="number"
              value={payment}
              max={total}
              onChange={setPayment}
            />
            <Field
              label="Notes"
              value={notes}
              onChange={setNotes}
              className="span-2"
            />
          </div>
          <p className="modal-balance">
            {t("Total amount")}
            <strong dir="ltr">{money(total)}</strong>
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
            >
              {t("Cancel")}
            </button>
            <button className="btn primary" disabled={busy || !items.length}>
              {t("Receive purchase")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function Accounts({
  onOrder,
  onPurchase,
}: {
  onOrder: (id: string) => void;
  onPurchase: (id: string) => void;
}) {
  const { state: s, t } = useStore();
  const [tab, setTab] = useState("Customer balances"),
    [q, setQ] = useState("");
  const orders = s!.orders.filter((o) => due(o) > 0 || refundDue(o) > 0);
  const purchases = s!.purchases.filter(
    (p) => balanceDue(p) > 0 || refundDue(p) > 0,
  );
  const receivable = orders.reduce((a, o) => a + due(o), 0),
    payable = purchases.reduce((a, p) => a + balanceDue(p), 0),
    refunds = orders.reduce((a, o) => a + refundDue(o), 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Credit / Udhaar")}</h1>
          <p>{t("A clear view of money to collect and pay.")}</p>
        </div>
        <span className="currency-pill">PKR</span>
      </div>
      <div className="stat-grid three">
        {[
          ["Receivable", receivable],
          ["Payable", payable],
          ["Refund due", refunds],
        ].map(([l, v], i) => (
          <div className="stat-card" key={l}>
            <div>
              <span>{t(String(l))}</span>
              <span className={"stat-icon tone-" + i}>
                <Wallet size={20} />
              </span>
            </div>
            <strong className="money-stat" dir="ltr">
              {money(Number(v))}
            </strong>
          </div>
        ))}
      </div>
      <section className="surface">
        <TabBar
          value={tab}
          onChange={setTab}
          items={["Customer balances", "Supplier balances"]}
        />
        <div className="list-toolbar">
          <SearchBox value={q} onChange={setQ} />
        </div>
        {tab === "Customer balances" ? (
          <DataTable
            data={orders.filter((o) =>
              [o.id, o.customer.name, o.customer.phone]
                .join(" ")
                .toLowerCase()
                .includes(q.toLowerCase()),
            )}
            onRow={(o) => onOrder(o.id)}
            columns={[
              { key: "id", label: "Order ID", value: (o) => o.id },
              { key: "name", label: "Customer", value: (o) => o.customer.name },
              { key: "phone", label: "Phone", value: (o) => o.customer.phone },
              {
                key: "total",
                label: "Total",
                value: (o) => o.total,
                render: (o) => money(o.total),
              },
              {
                key: "paid",
                label: "Amount received",
                value: (o) => paid(o),
                render: (o) => money(paid(o)),
              },
              {
                key: "due",
                label: "Balance due",
                value: (o) => due(o),
                render: (o) => (
                  <b className="balance-amount">{money(due(o))}</b>
                ),
              },
              {
                key: "refund",
                label: "Refund due",
                value: (o) => refundDue(o),
                render: (o) => money(refundDue(o)),
              },
            ]}
          />
        ) : (
          <DataTable
            data={purchases.filter((p) =>
              [p.id, s!.suppliers.find((s) => s.id === p.supplierId)?.name]
                .join(" ")
                .toLowerCase()
                .includes(q.toLowerCase()),
            )}
            onRow={(p) => onPurchase(p.id)}
            columns={[
              { key: "id", label: "Purchase ID", value: (p) => p.id },
              {
                key: "supplier",
                label: "Supplier",
                value: (p) =>
                  s!.suppliers.find((x) => x.id === p.supplierId)?.name || "",
              },
              {
                key: "total",
                label: "Total",
                value: (p) => p.total,
                render: (p) => money(p.total),
              },
              {
                key: "paid",
                label: "Amount paid",
                value: (p) => paid(p),
                render: (p) => money(paid(p)),
              },
              {
                key: "balance",
                label: "Balance due",
                value: (p) => balanceDue(p),
                render: (p) => (
                  <b className="balance-amount">{money(balanceDue(p))}</b>
                ),
              },
              {
                key: "credit",
                label: "Supplier credit",
                value: (p) => refundDue(p),
                render: (p) => money(refundDue(p)),
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
function CourierForm({
  courier,
  onClose,
}: {
  courier: Courier | null;
  onClose: () => void;
}) {
  const { t, busy, act } = useStore();
  const [f, setF] = useState<Courier>({
    id: "",
    name: "",
    phone: "",
    website: "",
    pattern: "",
    contact: "",
  });
  useEffect(() => {
    if (courier) setF(courier);
  }, [courier]);
  if (!courier) return null;
  return (
    <Modal
      title={courier.id ? "Edit courier" : "Add courier"}
      open={!!courier}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("courier", f)) onClose();
        }}
      >
        <div className="stack-fields">
          <Field
            label="Courier name"
            value={f.name}
            onChange={(v) => setF({ ...f, name: v })}
            required
          />
          <Field
            label="Phone"
            value={f.phone}
            onChange={(v) => setF({ ...f, phone: v })}
            type="tel"
          />
          <Field
            label="Website"
            value={f.website}
            onChange={(v) => setF({ ...f, website: v })}
            type="url"
          />
          <Field
            label="Tracking URL pattern"
            value={f.pattern}
            onChange={(v) => setF({ ...f, pattern: v })}
            placeholder="https://courier.example/track/{tracking}"
          />
          <p className="help-text">
            {t("Use {tracking} where the number belongs.")}
          </p>
          <Field
            label="Contact information"
            value={f.contact}
            onChange={(v) => setF({ ...f, contact: v })}
            type="textarea"
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="btn primary" disabled={busy}>
            {t("Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Couriers() {
  const { state: s, t } = useStore();
  const [edit, setEdit] = useState<Courier | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Couriers")}</h1>
          <p>{t("Your shipping partners, all in one place.")}</p>
        </div>
        <button
          className="btn primary"
          onClick={() =>
            setEdit({
              id: "",
              name: "",
              phone: "",
              website: "",
              pattern: "",
              contact: "",
            })
          }
        >
          <Plus size={17} />
          {t("Add courier")}
        </button>
      </div>
      <div className="courier-grid">
        {s!.couriers.map((c) => (
          <article className="courier-card" key={c.id}>
            <div className="courier-card-head">
              <span className="courier-icon">
                <Truck size={27} />
              </span>
              <button
                className="icon-btn"
                aria-label={t("Edit") + " " + c.name}
                onClick={() => setEdit({ ...c })}
              >
                <PenLine size={17} />
              </button>
            </div>
            <h2>{c.name}</h2>
            <p>{c.phone || "—"}</p>
            {c.website && (
              <a
                className="text-button"
                href={c.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("Website")}
                <ExternalLink size={13} />
              </a>
            )}
            <p className="courier-contact">
              {c.contact || t("Manual updates")}
            </p>
            <div className="courier-stats">
              <span>
                <b>{s!.orders.filter((o) => o.courierId === c.id).length}</b>
                {t("Orders")}
              </span>
              <span>
                <b>
                  {
                    s!.orders.filter(
                      (o) => o.courierId === c.id && o.status === "Delivered",
                    ).length
                  }
                </b>
                {t("Delivered")}
              </span>
            </div>
            <div className="courier-pattern">
              <span>{t("Tracking URL pattern")}</span>
              <p>{c.pattern || "—"}</p>
            </div>
          </article>
        ))}
      </div>
      {!s!.couriers.length && (
        <EmptyState
          title="Nothing here yet"
          description="Your shipping partners, all in one place."
        />
      )}
      <p className="footnote">
        {t("No automatic courier connection is configured.")}
      </p>
      <CourierForm courier={edit} onClose={() => setEdit(null)} />
    </>
  );
}
export function StoreSettings({ onStart }: { onStart: () => void }) {
  const { state: s, t, busy, act } = useStore();
  const [f, setF] = useState<Settings>(s!.settings);
  const set = (key: keyof Settings, v: any) => setF({ ...f, [key]: v });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Settings")}</h1>
          <p>{t("Set up your store and preferred workflow.")}</p>
        </div>
        <span className="currency-pill">PKR</span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await act("settings", f);
        }}
        className="settings-form"
      >
        <section className="settings-section">
          <div>
            <h2>{t("Store details")}</h2>
            <p>{t("Store contact")}</p>
          </div>
          <div className="form-grid">
            <Field
              label="Store name"
              value={f.storeName}
              onChange={(v) => set("storeName", v)}
              required
            />
            <Field
              label="Phone"
              type="tel"
              value={f.phone}
              onChange={(v) => set("phone", v)}
            />
            <Field
              label="Address"
              value={f.address}
              onChange={(v) => set("address", v)}
              className="span-2"
            />
            <Field
              label="Default city"
              value={f.city}
              onChange={(v) => set("city", v)}
              required
            />
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>{t("Stock workflow")}</h2>
            <p>{t("Available stock is checked when an order is confirmed.")}</p>
          </div>
          <Choose
            label="Stock workflow"
            value={f.stockDeduction}
            onChange={(v) => set("stockDeduction", v)}
            options={[
              { value: "dispatch", label: "Deduct when dispatched" },
              { value: "confirm", label: "Deduct when confirmed" },
            ]}
          />
        </section>
        <section className="settings-section">
          <div>
            <h2>{t("Default charges")}</h2>
            <p>{t("All amounts in PKR")}</p>
          </div>
          <div className="form-grid">
            <Field
              label="Delivery charges"
              type="number"
              value={f.deliveryCharge}
              onChange={(v) => set("deliveryCharge", v)}
            />
            <Field
              label="Shipping charges"
              type="number"
              value={f.shippingCharge}
              onChange={(v) => set("shippingCharge", v)}
            />
            <Field
              label="Business charge name"
              value={f.extraChargeName}
              onChange={(v) => set("extraChargeName", v)}
            />
            <Field
              label="Business charge amount"
              type="number"
              value={f.extraCharge}
              onChange={(v) => set("extraCharge", v)}
            />
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>{t("Receipt message")}</h2>
          </div>
          <Field
            label="Receipt message"
            type="textarea"
            value={f.receiptNote}
            onChange={(v) => set("receiptNote", v)}
          />
        </section>
        <div className="settings-save">
          <button className="btn primary" disabled={busy}>
            {t(busy ? "Saving…" : "Save settings")}
          </button>
        </div>
      </form>
      <ChangeHistory />
      {s!.demo && (
        <div className="sample-reset">
          <div>
            <h3>{t("Sample workspace")}</h3>
            <p>
              {t("Remove all sample records and start with an empty store?")}
            </p>
          </div>
          <button className="btn" onClick={onStart}>
            {t("Start your store")}
          </button>
        </div>
      )}
    </>
  );
}
