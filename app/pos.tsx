"use client";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ShoppingBag,
  Package,
  Plus,
  Minus,
  Building2,
  Truck,
  ScanLine,
  ArrowRight,
  Users,
  ChevronDown,
  ChevronUp,
  Trash2,
  RotateCcw,
  Camera,
  Scissors,
  Droplets,
  Shirt,
  Hand,
  Brush,
  UtensilsCrossed,
  Check,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  blankPerson,
  CATEGORIES,
  categories,
  METHODS,
  money,
  round,
  stock,
  type Person,
  type Product,
} from "@/lib/pos/model";
import { productName } from "@/lib/pos/i18n";
import { useStore } from "./store-context";
import { Choose, Field, Picker, Modal, EmptyState, TabBar } from "./controls";
export type CartItem = { productId: string; qty: number; price: number };
type OrderForm = {
  customer: Person;
  discount: number;
  shipping: number;
  charge: number;
  method: string;
  payment: number;
  courierId: string;
  trackingNumber: string;
  expectedDate: string;
  instructions: string;
  notes: string;
};
export function Scanner({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (s: string) => boolean;
}) {
  const { t } = useStore();
  const [value, setValue] = useState("");
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    setActive(false);
  };
  useEffect(() => {
    if (!open) stop();
    return () => {
      generation.current++;
      controls.current?.stop();
    };
  }, [open]);
  async function start() {
    setError("");
    setActive(true);
    const run = ++generation.current;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!video.current) return;
      const reader = new BrowserMultiFormatReader();
      const c = await reader.decodeFromVideoDevice(
        undefined,
        video.current,
        (result) => {
          if (result && run === generation.current) {
            const ok = onScan(result.getText());
            if (ok) {
              stop();
              onClose();
            } else setError(t("Product not found"));
          }
        },
      );
      if (run !== generation.current) c.stop();
      else controls.current = c;
    } catch {
      setError(
        t("Camera unavailable. Allow camera access or use a USB scanner."),
      );
      setActive(false);
    }
  }
  return (
    <Modal
      title="Barcode & QR scanner"
      description="USB scanners work in the product search field."
      open={open}
      onClose={() => {
        stop();
        onClose();
      }}
    >
      <video ref={video} className="scanner-video" muted playsInline autoPlay />
      <p className="help-text">
        {t("Point the camera at a barcode or QR code.")}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="btn" onClick={active ? stop : start}>
        <Camera size={18} />
        {t(active ? "Stop camera" : "Start camera")}
      </button>
      <Field label="Enter or scan a code" value={value} onChange={setValue} />
      <button
        className="btn primary"
        onClick={() => {
          if (onScan(value)) {
            stop();
            onClose();
          } else setError(t("Product not found"));
        }}
      >
        {t("Add item")}
      </button>
    </Modal>
  );
}
const icons = [
  Scissors,
  Droplets,
  Shirt,
  Hand,
  Brush,
  Package,
  UtensilsCrossed,
  Droplets,
  Brush,
  Shirt,
  Package,
  UtensilsCrossed,
];
export function POS({
  onOrder,
  onOrders,
  initialType = "city",
}: {
  onOrder: (id: string) => void;
  onOrders: () => void;
  initialType?: "city" | "outside";
}) {
  const { state: s, lang, t, act, busy } = useStore();
  const [type, setType] = useState<"city" | "outside">(initialType);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [autoPayment, setAutoPayment] = useState(true);
  const defaults = (): OrderForm => ({
    customer: { ...blankPerson(), city: s!.settings.city },
    discount: 0,
    shipping: 0,
    charge: 0,
    method: "Cash",
    payment: 0,
    courierId: "",
    trackingNumber: "",
    expectedDate: "",
    instructions: "",
    notes: "",
  });
  const form = useForm<OrderForm>({ defaultValues: defaults() });
  const f = form.watch();
  const set = (key: keyof OrderForm, v: any) =>
    form.setValue(key, v, { shouldDirty: true });
  const setCustomer = (key: keyof Person, v: any) =>
    set("customer", { ...f.customer, [key]: v });
  const subtotal = round(cart.reduce((sum, p) => sum + p.price * p.qty, 0));
  const total = round(
    Math.max(
      0,
      subtotal -
        Number(f.discount || 0) +
        Number(f.shipping || 0) +
        Number(f.charge || 0),
    ),
  );
  const payment =
    autoPayment && !["Cash on delivery", "Credit / Udhaar"].includes(f.method)
      ? total
      : Number(f.payment || 0);
  const balance = Math.max(0, round(total - payment));
  const products = s!.products.filter(
    (p) =>
      p.active &&
      (category === "All products" || p.category === category) &&
      [p.name, p.nameUr, p.namePa, p.sku, p.barcode]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function add(p: Product) {
    if (cart.length === 0) {
      set(
        "shipping",
        type === "city"
          ? s!.settings.deliveryCharge
          : s!.settings.shippingCharge,
      );
      set("charge", s!.settings.extraCharge);
    }
    const current = cart.find((i) => i.productId === p.id);
    if ((current?.qty || 0) >= stock(s!, p.id).available) {
      toast.error(t("Out of stock"));
      return false;
    }
    setCart((c) =>
      current
        ? c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { productId: p.id, qty: 1, price: p.price }],
    );
    return true;
  }
  function scan(value: string) {
    const p = s!.products.find(
      (p) =>
        p.active &&
        [p.barcode, p.sku, p.id].some(
          (x) => x && x.toLowerCase() === value.trim().toLowerCase(),
        ),
    );
    if (!p) return false;
    const ok = add(p);
    if (ok) setQuery("");
    return ok;
  }
  function switchType(v: "city" | "outside") {
    setType(v);
    set(
      "shipping",
      cart.length
        ? v === "city"
          ? s!.settings.deliveryCharge
          : s!.settings.shippingCharge
        : 0,
    );
    if (v === "outside") setCustomerOpen(true);
  }
  function reset() {
    setCart([]);
    setQuery("");
    setType("city");
    form.reset({ ...defaults(), shipping: 0 });
    setAutoPayment(true);
    setCustomerOpen(false);
  }
  async function save(draft = false) {
    if (!cart.length) {
      toast.error(t("Add at least one product"));
      return;
    }
    if (!f.customer.name || !f.customer.phone || !f.customer.address) {
      setCustomerOpen(true);
      toast.error(
        t(
          !f.customer.name
            ? "Customer name is required"
            : !f.customer.phone
              ? "Phone number is required"
              : "Delivery address is required",
        ),
      );
      return;
    }
    const next = await act(
      "createOrder",
      {
        ...f,
        type,
        items: cart,
        payment: draft ? 0 : payment,
        discount: Number(f.discount || 0),
        shipping: Number(f.shipping || 0),
        charge: Number(f.charge || 0),
        draft,
      },
      draft ? "Order saved" : "Order confirmed",
    );
    if (next) {
      reset();
      onOrder(next.orders[0].id);
    }
  }
  useEffect(() => {
    const handle = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (d.type === "city" || d.type === "outside") switchType(d.type);
    };
    window.addEventListener("karobar-start-order", handle);
    return () => window.removeEventListener("karobar-start-order", handle);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("LET’S GET TO BUSINESS")}</p>
          <h1>{t("Point of sale")}</h1>
          <p>{t("Create an order and arrange delivery.")}</p>
        </div>
        <button className="btn" onClick={onOrders}>
          <ClipboardList size={17} />
          {t("View orders")}
        </button>
      </div>
      <div className="order-type-grid">
        {(["city", "outside"] as const).map((v) => (
          <button
            key={v}
            className={"type-button " + (type === v ? "selected" : "")}
            aria-pressed={type === v}
            onClick={() => switchType(v)}
          >
            {v === "city" ? <Building2 /> : <Truck />}
            <span>
              <b>{t(v === "city" ? "City order" : "Out-of-city order")}</b>
              <small>
                {t(
                  v === "city"
                    ? "Local delivery, made simple"
                    : "Ship anywhere in Pakistan",
                )}
              </small>
            </span>
            {type === v ? (
              <span className="selection-check">
                <Check size={13} />
              </span>
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
        ))}
      </div>
      <div className="pos-grid">
        <section className="catalog">
          <div className="catalog-head">
            <h2>{t("Product catalog")}</h2>
            <span className="muted">
              {products.length} {t("Products").toLowerCase()}
            </span>
          </div>
          <div className="search-field">
            <ScanLine size={18} />
            <input
              aria-label={t("Search products or scan a barcode…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!scan(query)) toast.error(t("Product not found"));
                }
              }}
              placeholder={t("Search products or scan a barcode…")}
            />
            <button
              type="button"
              className="icon-btn"
              title={t("Scan code")}
              aria-label={t("Scan code")}
              onClick={() => setScanOpen(true)}
            >
              <Camera size={19} />
            </button>
          </div>
          <TabBar
            value={category}
            onChange={setCategory}
            items={["All products", ...categories(s!)]}
          />
          <div className="product-grid">
            {products.map((p) => {
              const i = s!.products.indexOf(p);
              const Icon = icons[i % icons.length];
              const available = stock(s!, p.id).available;
              const qty = cart.find((c) => c.productId === p.id)?.qty;
              return (
                <button
                  className={"product-card " + (qty ? "in-cart" : "")}
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={available <= 0}
                  aria-label={t("Add item") + ": " + productName(p, lang)}
                >
                  <div className={"product-visual tone-" + (i % 6)}>
                    <Icon size={40} strokeWidth={1.2} />
                    <span
                      className={
                        "stock-tag " +
                        (available <= p.reorderLevel ? "low" : "")
                      }
                    >
                      {available > 0
                        ? `${available} ${t("Available").toLowerCase()}`
                        : t("Out of stock")}
                    </span>
                    {qty && <span className="cart-qty-tag">{qty}</span>}
                  </div>
                  <div className="product-info">
                    <span className="product-category">
                      {t(p.category).toUpperCase()}
                    </span>
                    <h3>{productName(p, lang)}</h3>
                    <div>
                      <strong dir="ltr">{money(p.price)}</strong>
                      <span className="add-product">
                        <Plus size={17} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!products.length && (
            <EmptyState
              title={
                s!.products.length ? "No results found" : "No products yet"
              }
              description={
                s!.products.length
                  ? "Try another search or clear your filters."
                  : "Add your first product to get started."
              }
            />
          )}
          <p className="catalog-tip">
            <ScanLine size={14} />
            {t("USB scanners work in the product search field.")}
          </p>
        </section>
        <form
          className="order-panel"
          onSubmit={form.handleSubmit(() => save(false))}
        >
          <div className="panel-title">
            <div>
              <h2>{t("Current order")}</h2>
              <small>
                {t("New order")} · {cart.reduce((n, i) => n + i.qty, 0)}{" "}
                {t("Items").toLowerCase()}
              </small>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge green">
                {t(type === "city" ? "City order" : "Out-of-city order")}
              </span>
              {cart.length > 0 && (
                <button
                  className="icon-btn"
                  type="button"
                  title={t("Reset order")}
                  aria-label={t("Reset order")}
                  onClick={reset}
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          </div>
          <Collapsible open={customerOpen} onOpenChange={setCustomerOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="customer-box">
                <Users size={18} />
                <span>{f.customer.name || t("Add customer")}</span>
                {customerOpen ? <ChevronUp size={16} /> : <Plus size={17} />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="customer-form">
                <Picker
                  label="Select customer"
                  options={s!.customers}
                  value={f.customer.id}
                  onChange={(id) => {
                    const p = s!.customers.find((c) => c.id === id);
                    set(
                      "customer",
                      p
                        ? { ...p }
                        : { ...blankPerson(), city: s!.settings.city },
                    );
                  }}
                />
                <div className="form-grid">
                  <Field
                    label="Name"
                    value={f.customer.name}
                    onChange={(v) => setCustomer("name", v)}
                    required
                  />
                  <Field
                    label="Phone"
                    type="tel"
                    value={f.customer.phone}
                    onChange={(v) => setCustomer("phone", v)}
                    required
                  />
                  {type === "outside" && (
                    <Field
                      label="WhatsApp number"
                      type="tel"
                      value={f.customer.whatsapp}
                      onChange={(v) => setCustomer("whatsapp", v)}
                      required
                    />
                  )}
                  <Field
                    label="Area / locality"
                    value={f.customer.area}
                    onChange={(v) => setCustomer("area", v)}
                  />
                  <Field
                    label="Complete delivery address"
                    value={f.customer.address}
                    onChange={(v) => setCustomer("address", v)}
                    className="span-2"
                    required
                  />
                  {type === "outside" && (
                    <>
                      <Field
                        label="City"
                        value={f.customer.city}
                        onChange={(v) => setCustomer("city", v)}
                        required
                      />
                      <Choose
                        label="Province"
                        value={f.customer.province}
                        onChange={(v) => setCustomer("province", v)}
                        options={[
                          "Punjab",
                          "Sindh",
                          "Khyber Pakhtunkhwa",
                          "Balochistan",
                          "Islamabad Capital Territory",
                          "Gilgit-Baltistan",
                          "Azad Jammu and Kashmir",
                        ]}
                      />
                      <Field
                        label="Postal code"
                        value={f.customer.postal}
                        onChange={(v) => setCustomer("postal", v)}
                        required
                      />
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setCustomerOpen(false)}
                >
                  {t("Continue")}
                  <ChevronUp size={14} />
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {!cart.length ? (
            <div className="empty-cart">
              <ShoppingBag size={42} strokeWidth={1.4} />
              <h3>{t("Your next sale starts here")}</h3>
              <p>
                {t("Select a product or scan a code to add it to this order.")}
              </p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => {
                const p = s!.products.find((p) => p.id === item.productId)!;
                return (
                  <div className="cart-row" key={item.productId}>
                    <div className="cart-item-title">
                      <span>{productName(p, lang)}</span>
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={t("Remove item") + " " + p.name}
                        onClick={() =>
                          setCart((c) =>
                            c.filter((i) => i.productId !== item.productId),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="cart-row-controls">
                      <div className="quantity-stepper">
                        <button
                          type="button"
                          aria-label={t("Quantity") + " -"}
                          onClick={() =>
                            setCart((c) =>
                              c.map((i) =>
                                i.productId === item.productId
                                  ? { ...i, qty: Math.max(1, i.qty - 1) }
                                  : i,
                              ),
                            )
                          }
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          aria-label={t("Quantity") + " " + p.name}
                          type="number"
                          min="1"
                          max={stock(s!, p.id).available}
                          value={item.qty}
                          onChange={(e) =>
                            setCart((c) =>
                              c.map((i) =>
                                i.productId === item.productId
                                  ? {
                                      ...i,
                                      qty: Math.max(
                                        1,
                                        Math.floor(Number(e.target.value)),
                                      ),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          aria-label={t("Quantity") + " +"}
                          onClick={() => add(p)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span>×</span>
                      <input
                        className="price-input"
                        aria-label={t("Price") + " " + p.name}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) =>
                          setCart((c) =>
                            c.map((i) =>
                              i.productId === item.productId
                                ? {
                                    ...i,
                                    price: Math.max(0, Number(e.target.value)),
                                  }
                                : i,
                            ),
                          )
                        }
                      />
                      <b dir="ltr">{money(item.price * item.qty)}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {type === "outside" && (
            <div className="courier-inline">
              <h3>
                <Truck size={16} />
                {t("Courier + tracking")}
              </h3>
              <div className="form-grid">
                <Choose
                  label="Courier"
                  value={f.courierId}
                  onChange={(v) => set("courierId", v)}
                  options={s!.couriers.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  placeholder="Select courier"
                />
                <Field
                  label="Tracking number"
                  value={f.trackingNumber}
                  onChange={(v) => set("trackingNumber", v)}
                />
                <Field
                  label="Expected delivery"
                  type="date"
                  value={f.expectedDate}
                  onChange={(v) => set("expectedDate", v)}
                  className="span-2"
                />
              </div>
            </div>
          )}
          <div className="order-summary">
            <div>
              <span>{t("Subtotal")}</span>
              <b dir="ltr">{money(subtotal)}</b>
            </div>
            <div>
              <label htmlFor="discount">{t("Discount")}</label>
              <Input
                id="discount"
                aria-label={t("Discount")}
                type="number"
                min="0"
                max={subtotal}
                step="0.01"
                value={f.discount}
                onChange={(e) =>
                  set(
                    "discount",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </div>
            <div>
              <label htmlFor="shipping">
                {t(type === "city" ? "Delivery charges" : "Shipping charges")}
              </label>
              <Input
                id="shipping"
                type="number"
                min="0"
                step="0.01"
                value={f.shipping}
                onChange={(e) =>
                  set(
                    "shipping",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </div>
            {s!.settings.extraChargeName && (
              <div>
                <label htmlFor="charge">{s!.settings.extraChargeName}</label>
                <Input
                  id="charge"
                  type="number"
                  min="0"
                  value={f.charge}
                  onChange={(e) => set("charge", Number(e.target.value))}
                />
              </div>
            )}
            <div className="total">
              <b>{t("Total amount")}</b>
              <b dir="ltr">{money(total)}</b>
            </div>
            <div className="payment-inline">
              <Choose
                label="Payment method"
                value={f.method}
                onChange={(v) => {
                  set("method", v);
                  setAutoPayment(true);
                  set("payment", 0);
                }}
                options={METHODS}
              />
              <Field
                label="Amount received"
                type="number"
                value={payment}
                onChange={(v) => {
                  setAutoPayment(false);
                  set("payment", v);
                }}
                min={0}
                max={total}
              />
            </div>
            {balance > 0 && (
              <div className="balance">
                <span>{t("Balance due")}</span>
                <b dir="ltr">{money(balance)}</b>
              </div>
            )}
            <Collapsible
              open={moreOpen}
              onOpenChange={setMoreOpen}
              className="order-notes"
            >
              <CollapsibleTrigger className="text-button" type="button">
                {t("Notes")}{" "}
                {moreOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Field
                  label="Special instructions"
                  type="textarea"
                  value={f.instructions}
                  onChange={(v) => set("instructions", v)}
                />
                <Field
                  label="Internal notes"
                  type="textarea"
                  value={f.notes}
                  onChange={(v) => set("notes", v)}
                />
              </CollapsibleContent>
            </Collapsible>
            <button
              className="btn primary full"
              disabled={busy || !cart.length}
              type="submit"
            >
              {t(busy ? "Saving…" : "Confirm order")}
              <ArrowRight size={18} />
            </button>
            {cart.length > 0 && (
              <button
                className="text-button save-new"
                type="button"
                disabled={busy}
                onClick={() => save(true)}
              >
                {t("Save as new")}
              </button>
            )}
            <p className="summary-note">{t("All amounts in PKR")}</p>
          </div>
        </form>
      </div>
      <Scanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={scan}
      />
    </>
  );
}
