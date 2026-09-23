"use client";
import React, { useEffect, useState } from "react";
import {
  Truck,
  MapPin,
  Phone,
  Printer,
  Download,
  ExternalLink,
  Check,
  Package,
  Wallet,
  RotateCcw,
  Clock,
  ArrowRight,
  PenLine,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useStore } from "./store-context";
import {
  Badge,
  Choose,
  DataTable,
  Field,
  Modal,
  TabBar,
  dateLabel,
} from "./controls";
import {
  CITY_STATUSES,
  TRACK_STATUSES,
  METHODS,
  paid,
  due,
  money,
  paymentStatus,
  trackingUrl,
  reversed,
  refundDue,
  balanceDue,
  type Payment,
  type Order,
  type Purchase,
} from "@/lib/pos/model";
import { productName } from "@/lib/pos/i18n";
import { printDocument, receiptHTML, purchaseHTML } from "@/lib/pos/exports";
import { toast } from "sonner";
import {
  OrderEditor,
  PurchaseEditor,
  PaymentEditor,
  ChangeHistory,
} from "./record-editors";
export function PaymentModal({
  entry,
  kind = "order",
  refund = false,
  onClose,
}: {
  entry: Order | Purchase | null;
  kind?: "order" | "purchase";
  refund?: boolean;
  onClose: () => void;
}) {
  const { t, act, busy } = useStore();
  const [amount, setAmount] = useState(0),
    [method, setMethod] = useState("Cash"),
    [note, setNote] = useState("");
  useEffect(() => {
    if (entry) {
      setAmount(
        refund ? refundDue(entry) : Math.max(0, entry.total - paid(entry)),
      );
      setNote("");
    }
  }, [entry?.id, refund]);
  if (!entry) return null;
  const max = refund
    ? refundDue(entry)
    : Math.max(0, entry.total - paid(entry));
  return (
    <Modal
      title={refund ? "Record refund" : "Record payment"}
      open={!!entry}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act(
              "payment",
              { id: entry.id, kind, amount, method, note, refund },
              refund ? "Refund recorded" : "Payment recorded",
            )
          )
            onClose();
        }}
      >
        <p className="modal-balance">
          {t(refund ? "Amount to refund" : "Balance due")}
          <strong dir="ltr">{money(max)}</strong>
        </p>
        <div className="form-grid">
          <Field
            label="Amount"
            type="number"
            value={amount}
            onChange={setAmount}
            required
            min={0.01}
            max={max}
          />
          <Choose
            label="Payment method"
            value={method}
            onChange={setMethod}
            options={METHODS.filter(
              (m) => !["Credit / Udhaar", "Cash on delivery"].includes(m),
            )}
          />
          <Field
            label="Payment notes"
            type="textarea"
            value={note}
            onChange={setNote}
            className="span-2"
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="btn primary" disabled={busy || amount <= 0}>
            {t(busy ? "Saving…" : "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ReturnModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { act, busy, t } = useStore();
  const [original] = useState(order);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      order.restocked.map((item) => [item.productId, item.qty]),
    ),
  );
  const [note, setNote] = useState("");
  const editing = original.returnReceived;
  return (
    <Modal
      title={editing ? "Edit return" : "Receive return"}
      description="Only sellable items go back into available stock."
      open
      onClose={onClose}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await act(editing ? "editReturn" : "returnStock", {
              id: order.id,
              items: order.items.map((item) => ({
                productId: item.productId,
                qty: qty[item.productId] || 0,
              })),
              note,
              reason: note,
              expectedVersion: original.version || 0,
            })
          )
            onClose();
        }}
      >
        <div className="return-lines">
          {order.items.map((item) => (
            <div key={item.productId}>
              <span>
                {item.name}
                <small>
                  {t("Quantity")}: {item.qty}
                </small>
              </span>
              <Field
                label="Sellable quantity"
                type="number"
                step="1"
                min={0}
                max={item.qty}
                value={qty[item.productId] || 0}
                onChange={(value) =>
                  setQty({ ...qty, [item.productId]: value })
                }
              />
            </div>
          ))}
        </div>
        <Field
          label={editing ? "Reason for change" : "Notes"}
          value={note}
          onChange={setNote}
          type="textarea"
          required={editing}
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            disabled={busy || (editing && !note.trim())}
            className="btn primary"
          >
            {t(editing ? "Save changes" : "Receive return")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Timeline({ order: o }: { order: Order }) {
  const { t } = useStore();
  const steps =
    o.type === "outside"
      ? TRACK_STATUSES.slice(0, 8)
      : CITY_STATUSES.slice(0, 6);
  const current = o.type === "outside" ? o.trackingStatus : o.status;
  const index = steps.indexOf(current);
  const extra = ["Returned", "Cancelled", "Delivery Attempted"].includes(
    current,
  )
    ? [current]
    : [];
  return (
    <div className="timeline">
      {[...steps, ...extra].map((step, i) => {
        const events = o.history.filter((h) => h.status === step);
        const event = events.at(-1);
        const done = !!event || index > i;
        return (
          <div
            key={step}
            className={
              "timeline-item " +
              (done ? "done " : "") +
              (step === current ? "current" : "")
            }
          >
            <div className="timeline-mark">
              {done ? (
                <Check size={12} />
              ) : step === current ? (
                <Truck size={12} />
              ) : (
                <span />
              )}
            </div>
            <div>
              <b>{t(step)}</b>
              {event && (
                <>
                  <small>{dateLabel(event.date, true)}</small>
                  {event.note && <p>{event.note}</p>}
                </>
              )}
              {step === current && (
                <span className="current-label">{t("Status")}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function allowed(o: Order) {
  const list = o.type === "outside" ? TRACK_STATUSES : CITY_STATUSES;
  const current = o.type === "outside" ? o.trackingStatus : o.status;
  if (["Cancelled", "Returned"].includes(current)) return [current];
  if (current === "Delivered") return ["Delivered", "Returned"];
  const dispatched = !!o.shipmentDate;
  return list.filter(
    (st) =>
      st === current ||
      (st === "Cancelled" && !dispatched) ||
      (st === "Returned" && dispatched) ||
      (o.type === "outside" &&
        dispatched &&
        [
          "In Transit",
          "Arrived at Destination City",
          "Out for Delivery",
          "Delivery Attempted",
          "Delivered",
        ].includes(st) &&
        current === "Delivery Attempted") ||
      (!["Returned", "Cancelled"].includes(st) &&
        list.indexOf(st) > list.indexOf(current)),
  );
}
export function OrderDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { state: s, lang, t, busy, act } = useStore();
  const o = s?.orders.find((o) => o.id === id);
  const [tab, setTab] = useState("Order details"),
    [newStatus, setNewStatus] = useState(""),
    [note, setNote] = useState("");
  const [shipment, setShipment] = useState<any>({});
  const [payment, setPayment] = useState(false),
    [refund, setRefund] = useState(false),
    [returning, setReturning] = useState(false),
    [editing, setEditing] = useState(false);
  const [paymentEdit, setPaymentEdit] = useState<Payment | null>(null);
  useEffect(() => {
    if (o) {
      setNewStatus(o.type === "outside" ? o.trackingStatus : o.status);
      setShipment({
        id: o.id,
        courierId: o.courierId,
        trackingNumber: o.trackingNumber,
        shipmentDate: o.shipmentDate,
        expectedDate: o.expectedDate,
        trackingUrl: o.trackingUrl,
        deliveryNotes: o.deliveryNotes,
      });
    }
  }, [o?.id, o?.history.length]);
  useEffect(() => {
    setTab("Order details");
    setNote("");
    setPayment(false);
    setReturning(false);
    setRefund(false);
    setEditing(false);
    setPaymentEdit(null);
  }, [id]);
  if (!o) return null;
  const url = trackingUrl(s!, o);
  const print = (pdf = false) => {
    if (pdf) toast.info(t("Choose Save as PDF in the print dialog."));
    printDocument(o.invoice, receiptHTML(s!, o, lang), lang);
  };
  return (
    <>
      <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side={lang === "en" ? "right" : "left"}
          className="detail-sheet"
          dir={lang === "en" ? "ltr" : "rtl"}
        >
          <SheetHeader>
            <div className="detail-kicker">
              <span className="badge green">
                {t(o.type === "city" ? "City order" : "Out-of-city order")}
              </span>
              <span>{o.invoice}</span>
            </div>
            <SheetTitle>{o.id}</SheetTitle>
            <SheetDescription>
              {dateLabel(o.date, true)} · {t(paymentStatus(o))}
            </SheetDescription>
          </SheetHeader>
          <div className="detail-scroll">
            <div className="detail-summary">
              <div>
                <span>{t("Total amount")}</span>
                <strong dir="ltr">{money(o.total)}</strong>
              </div>
              <div>
                <span>{t("Amount received")}</span>
                <strong dir="ltr">{money(paid(o))}</strong>
              </div>
              <div>
                <span>{t("Balance due")}</span>
                <strong dir="ltr">{money(due(o))}</strong>
              </div>
            </div>
            <div className="detail-actions">
              <button className="btn primary" onClick={() => setEditing(true)}>
                <PenLine size={15} />
                {t("Edit order")}
              </button>
              <button className="btn" onClick={() => print()}>
                <Printer size={15} />
                {t("Print receipt")}
              </button>
              <button className="btn" onClick={() => print(true)}>
                <Download size={15} />
                {t("PDF")}
              </button>
              {o.type === "outside" && (
                <button
                  className="btn"
                  onClick={() => setTab("Tracking details")}
                >
                  <Truck size={16} />
                  {t("Track order")}
                </button>
              )}
              {url && (
                <a
                  className="btn"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={15} />
                  {t("Track shipment")}
                </a>
              )}
            </div>
            <TabBar
              value={tab}
              onChange={setTab}
              items={[
                "Order details",
                ...(o.type === "outside" ? ["Tracking details"] : []),
                "Payment history",
                "Change history",
              ]}
            />
            {tab === "Order details" && (
              <>
                <section className="detail-section">
                  <h3>{t("Customer details")}</h3>
                  <div className="customer-detail">
                    <span className="avatar large">{o.customer.name[0]}</span>
                    <div>
                      <strong>{o.customer.name}</strong>
                      <p dir="ltr">
                        <Phone size={13} />
                        {o.customer.phone}
                      </p>
                      <p>
                        <MapPin size={13} />
                        {o.customer.address}, {o.customer.area}{" "}
                        {o.customer.city}
                      </p>
                      <p>
                        {o.customer.province} · {o.customer.postal}
                      </p>
                      {o.customer.whatsapp && (
                        <p>
                          {t("WhatsApp number")}:{" "}
                          <bdi>{o.customer.whatsapp}</bdi>
                        </p>
                      )}
                    </div>
                  </div>
                </section>
                <section className="detail-section">
                  <h3>{t("Items")}</h3>
                  <DataTable
                    data={o.items.map((i, n) => ({ ...i, id: String(n) }))}
                    columns={[
                      {
                        key: "name",
                        label: "Product",
                        value: (i) => i.name,
                        render: (i) => {
                          const p = s!.products.find(
                            (p) => p.id === i.productId,
                          );
                          return p && lang !== "en" && i.name === p.name
                            ? productName(p, lang)
                            : i.name;
                        },
                      },
                      { key: "qty", label: "Quantity", value: (i) => i.qty },
                      {
                        key: "price",
                        label: "Price",
                        value: (i) => i.price,
                        render: (i) => <bdi>{money(i.price)}</bdi>,
                      },
                      {
                        key: "total",
                        label: "Total",
                        value: (i) => i.qty * i.price,
                        render: (i) => <bdi>{money(i.qty * i.price)}</bdi>,
                      },
                    ]}
                  />
                  <div className="detail-totals">
                    <p>
                      <span>{t("Subtotal")}</span>
                      <bdi>
                        {money(
                          o.items.reduce((n, i) => n + i.qty * i.price, 0),
                        )}
                      </bdi>
                    </p>
                    <p>
                      <span>{t("Discount")}</span>
                      <bdi>− {money(o.discount)}</bdi>
                    </p>
                    <p>
                      <span>{t("Delivery charges")}</span>
                      <bdi>{money(o.shipping)}</bdi>
                    </p>
                    {!!o.charge && (
                      <p>
                        <span>{o.chargeName}</span>
                        <bdi>{money(o.charge)}</bdi>
                      </p>
                    )}
                    <p className="total">
                      <strong>{t("Total amount")}</strong>
                      <bdi>{money(o.total)}</bdi>
                    </p>
                  </div>
                </section>
                {o.instructions && (
                  <section className="detail-section">
                    <h3>{t("Special instructions")}</h3>
                    <p>{o.instructions}</p>
                  </section>
                )}
                {o.notes && (
                  <section className="detail-section">
                    <h3>{t("Internal notes")}</h3>
                    <p>{o.notes}</p>
                  </section>
                )}
                <section className="detail-section">
                  <h3>{t("Update status")}</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await act("orderStatus", {
                          id: o.id,
                          status: newStatus,
                          note,
                        })
                      )
                        setNote("");
                    }}
                  >
                    <div className="form-grid">
                      <Choose
                        label="Status"
                        value={newStatus}
                        onChange={setNewStatus}
                        options={allowed(o)}
                      />
                      <Field
                        label="Update note"
                        value={note}
                        onChange={setNote}
                      />
                    </div>
                    <button
                      className="btn primary"
                      disabled={
                        busy || ["Cancelled", "Returned"].includes(o.status)
                      }
                    >
                      {t("Update status")}
                      <ArrowRight size={15} />
                    </button>
                  </form>
                </section>
                {o.type === "city" && (
                  <section className="detail-section">
                    <h3>{t("Tracking timeline")}</h3>
                    <Timeline order={o} />
                  </section>
                )}
              </>
            )}
            {tab === "Tracking details" && (
              <>
                <section className="shipment-banner">
                  <Truck size={25} />
                  <div>
                    <b>
                      {s!.couriers.find((c) => c.id === o.courierId)?.name ||
                        t("No courier selected")}
                    </b>
                    <p>{o.trackingNumber || t("No tracking number yet")}</p>
                  </div>
                  <Badge value={o.trackingStatus} />
                </section>
                <div className="tracking-columns">
                  <section className="detail-section">
                    <h3>{t("Tracking timeline")}</h3>
                    <Timeline order={o} />
                    <p className="help-text">
                      {t("Last update")}:{" "}
                      {dateLabel(o.history.at(-1)?.date || o.date, true)}
                    </p>
                    <p className="help-text">
                      {t("Tracking is updated manually by your staff.")}
                    </p>
                  </section>
                  <section className="detail-section">
                    <h3>{t("Shipment details")}</h3>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await act("shipment", shipment);
                      }}
                    >
                      <div className="stack-fields">
                        <Choose
                          label="Courier"
                          value={shipment.courierId || ""}
                          onChange={(v) =>
                            setShipment({ ...shipment, courierId: v })
                          }
                          options={s!.couriers.map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                          placeholder="Select courier"
                        />
                        {[
                          "Tracking number",
                          "Shipment date",
                          "Expected delivery date",
                          "Tracking URL",
                          "Delivery notes",
                        ].map((label, i) => {
                          const key = [
                            "trackingNumber",
                            "shipmentDate",
                            "expectedDate",
                            "trackingUrl",
                            "deliveryNotes",
                          ][i];
                          return (
                            <Field
                              key={key}
                              label={label}
                              type={
                                i === 1 || i === 2
                                  ? "date"
                                  : i === 3
                                    ? "url"
                                    : i === 4
                                      ? "textarea"
                                      : "text"
                              }
                              value={shipment[key] || ""}
                              onChange={(v) =>
                                setShipment({ ...shipment, [key]: v })
                              }
                            />
                          );
                        })}
                      </div>
                      <button disabled={busy} className="btn full">
                        {t("Save shipment")}
                      </button>
                    </form>
                    <hr />
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await act("orderStatus", {
                            id: o.id,
                            status: newStatus,
                            note,
                          })
                        )
                          setNote("");
                      }}
                    >
                      <Choose
                        label="Status"
                        value={newStatus}
                        onChange={setNewStatus}
                        options={allowed(o)}
                      />
                      <Field
                        label="Update note"
                        value={note}
                        onChange={setNote}
                      />
                      <button
                        className="btn primary full"
                        disabled={
                          busy || ["Cancelled", "Returned"].includes(o.status)
                        }
                      >
                        {t("Update status")}
                      </button>
                    </form>
                  </section>
                </div>
              </>
            )}
            {tab === "Payment history" && (
              <section className="detail-section">
                <h3>{t("Payment history")}</h3>
                <DataTable
                  data={o.payments}
                  columns={[
                    {
                      key: "date",
                      label: "Date",
                      value: (p) => p.date,
                      render: (p) => dateLabel(p.date, true),
                    },
                    {
                      key: "method",
                      label: "Payment method",
                      value: (p) => t(p.method),
                    },
                    {
                      key: "amount",
                      label: "Amount",
                      value: (p) => p.amount,
                      render: (p) => <bdi>{money(p.amount)}</bdi>,
                    },
                    { key: "note", label: "Notes", value: (p) => p.note },
                    {
                      key: "edit",
                      label: "Edit",
                      value: (p) => p.id,
                      render: (p) =>
                        p.voided ? (
                          <span>{t("Voided")}</span>
                        ) : (
                          <button
                            className="icon-btn"
                            aria-label={t("Edit payment")}
                            onClick={() => setPaymentEdit(p)}
                          >
                            <PenLine size={15} />
                          </button>
                        ),
                    },
                  ]}
                />
              </section>
            )}
            {tab === "Change history" && <ChangeHistory recordId={o.id} />}{" "}
            {o.status === "Returned" && (
              <section className="return-banner">
                <Package size={20} />
                <div>
                  <b>
                    {t(
                      o.returnReceived
                        ? "Return received"
                        : "Awaiting return receipt",
                    )}
                  </b>
                  <p>
                    {t("Returned units")}:{" "}
                    {o.restocked.reduce((s, i) => s + i.qty, 0)}
                  </p>
                </div>
                {
                  <button className="btn" onClick={() => setReturning(true)}>
                    {t(o.returnReceived ? "Edit return" : "Receive return")}
                  </button>
                }
              </section>
            )}
            <div className="detail-footer">
              {due(o) > 0 && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setRefund(false);
                    setPayment(true);
                  }}
                >
                  <Wallet size={17} />
                  {t("Record payment")}
                </button>
              )}
              {refundDue(o) > 0 && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setRefund(true);
                    setPayment(true);
                  }}
                >
                  <RotateCcw size={17} />
                  {t("Record refund")}
                </button>
              )}
              <Badge value={paymentStatus(o)} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <PaymentModal
        entry={payment ? o : null}
        refund={refund}
        onClose={() => setPayment(false)}
      />
      <>
        {returning && (
          <ReturnModal order={o} onClose={() => setReturning(false)} />
        )}
      </>
      {editing && <OrderEditor order={o} onClose={() => setEditing(false)} />}{" "}
      {paymentEdit && (
        <PaymentEditor
          entry={o}
          payment={paymentEdit}
          kind="order"
          onClose={() => setPaymentEdit(null)}
        />
      )}
    </>
  );
}
export function PurchaseDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { state: s, t, lang } = useStore();
  const p = s!.purchases.find((p) => p.id === id);
  const [payment, setPayment] = useState(false),
    [editing, setEditing] = useState(false),
    [refund, setRefund] = useState(false);
  const [paymentEdit, setPaymentEdit] = useState<Payment | null>(null);
  useEffect(() => {
    setPayment(false);
    setEditing(false);
    setRefund(false);
    setPaymentEdit(null);
  }, [id]);
  if (!p) return null;
  return (
    <>
      <Modal title="Purchase details" open={!!id} onClose={onClose} wide>
        <div className="detail-kicker">
          <b>{p.id}</b>
          <span>{dateLabel(p.date)}</span>
        </div>
        <div className="section-head">
          <h2>{s!.suppliers.find((x) => x.id === p.supplierId)?.name}</h2>
          <button className="btn primary" onClick={() => setEditing(true)}>
            <PenLine size={16} />
            {t("Edit purchase")}
          </button>
        </div>
        <DataTable
          data={p.items.map((i, n) => ({ ...i, id: String(n) }))}
          columns={[
            { key: "name", label: "Product", value: (i) => i.name },
            { key: "qty", label: "Quantity", value: (i) => i.qty },
            {
              key: "price",
              label: "Price",
              value: (i) => i.price,
              render: (i) => money(i.price),
            },
            {
              key: "total",
              label: "Total",
              value: (i) => i.price * i.qty,
              render: (i) => money(i.price * i.qty),
            },
          ]}
        />
        <div className="detail-totals">
          <p>
            <span>{t("Discount")}</span>
            {money(p.discount)}
          </p>
          <p>
            <span>{t("Shipping charges")}</span>
            {money(p.shipping)}
          </p>
          <p>
            <b>{t("Total")}</b>
            {money(p.total)}
          </p>
          <p>
            <span>{t("Balance due")}</span>
            {money(balanceDue(p))}
          </p>
          {refundDue(p) > 0 && (
            <p>
              <span>{t("Supplier credit")}</span>
              {money(refundDue(p))}
            </p>
          )}
        </div>
        <h3>{t("Payment history")}</h3>
        <DataTable
          data={p.payments}
          columns={[
            {
              key: "date",
              label: "Date",
              value: (p) => p.date,
              render: (p) => dateLabel(p.date, true),
            },
            {
              key: "method",
              label: "Payment method",
              value: (p) => t(p.method),
            },
            {
              key: "amount",
              label: "Amount",
              value: (p) => p.amount,
              render: (p) => money(p.amount),
            },
            { key: "note", label: "Notes", value: (p) => p.note },
            {
              key: "edit",
              label: "Edit",
              value: (payment) => payment.id,
              render: (payment) =>
                payment.voided ? (
                  <span>{t("Voided")}</span>
                ) : (
                  <button
                    className="icon-btn"
                    aria-label={t("Edit payment")}
                    onClick={() => setPaymentEdit(payment)}
                  >
                    <PenLine size={15} />
                  </button>
                ),
            },
          ]}
        />
        {p.notes && <p className="help-text">{p.notes}</p>}
        <ChangeHistory recordId={p.id} />
        <div className="modal-actions">
          <button
            className="btn"
            onClick={() => printDocument(p.id, purchaseHTML(s!, p, lang), lang)}
          >
            <Printer size={16} />
            {t("Print")}
          </button>
          {balanceDue(p) > 0 && (
            <button
              className="btn primary"
              onClick={() => {
                setRefund(false);
                setPayment(true);
              }}
            >
              {t("Record payment")}
            </button>
          )}
          {refundDue(p) > 0 && (
            <button
              className="btn primary"
              onClick={() => {
                setRefund(true);
                setPayment(true);
              }}
            >
              {t("Record supplier refund")}
            </button>
          )}
        </div>
      </Modal>
      <PaymentModal
        entry={payment ? p : null}
        kind="purchase"
        refund={refund}
        onClose={() => setPayment(false)}
      />
      {editing && (
        <PurchaseEditor purchase={p} onClose={() => setEditing(false)} />
      )}
      {paymentEdit && (
        <PaymentEditor
          entry={p}
          payment={paymentEdit}
          kind="purchase"
          onClose={() => setPaymentEdit(null)}
        />
      )}
    </>
  );
}
