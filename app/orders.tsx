"use client";
import React, { useState } from "react";
import {
  Truck,
  Package,
  CheckCheck,
  MapPin,
  ArrowUpRight,
  Search,
  Plus,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  FilterX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useStore } from "./store-context";
import {
  Badge,
  Choose,
  DataTable,
  Field,
  SearchBox,
  TabBar,
  dateLabel,
  type Column,
} from "./controls";
import {
  matchesOrder,
  money,
  paymentStatus,
  type Order,
} from "@/lib/pos/model";
import {
  csvExport,
  excelExport,
  orderRows,
  printDocument,
  reportHTML,
} from "@/lib/pos/exports";
import { toast } from "sonner";
export function ExportMenu({
  orders,
  title = "Orders",
  range = "",
}: {
  orders: Order[];
  title?: string;
  range?: string;
}) {
  const { state: s, t, lang } = useStore();
  const rows = () => orderRows(s!, orders, lang);
  const print = (pdf = false) => {
    if (pdf) toast.info(t("Choose Save as PDF in the print dialog."));
    printDocument(t(title), reportHTML(t(title), rows(), s!, range), lang);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="btn">
        <Download size={16} />
        {t("Export")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => print(true)}>
          <FileText />
          {t("PDF")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => csvExport("karobar-orders", rows())}>
          <FileSpreadsheet />
          {t("CSV")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => excelExport("karobar-orders", rows())}>
          <FileSpreadsheet />
          {t("Excel")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => print()}>
          <Printer />
          {t("Print")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function orderColumns(
  t: (s: string) => string,
  tracking = false,
): Column<Order>[] {
  return [
    {
      key: "id",
      label: "Order ID",
      value: (o) => o.id,
      render: (o) => (
        <div className="order-id">
          <b>{o.id}</b>
          <small>{dateLabel(o.date)}</small>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      value: (o) => o.customer.name,
      render: (o) => (
        <div className="person-cell">
          <span className="avatar">
            {o.customer.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <b>{o.customer.name}</b>
            <small dir="ltr">{o.customer.phone}</small>
          </div>
        </div>
      ),
    },
    { key: "city", label: "City", value: (o) => o.customer.city },
    {
      key: "type",
      label: tracking ? "Tracking number" : "Order type",
      value: (o) =>
        tracking
          ? o.trackingNumber
          : t(o.type === "city" ? "City order" : "Out-of-city order"),
      render: (o) =>
        tracking ? (
          <span className="mono">{o.trackingNumber || "—"}</span>
        ) : (
          <span className="type-label">
            {o.type === "city" ? <MapPin size={13} /> : <Truck size={13} />}{" "}
            {t(o.type === "city" ? "City order" : "Out-of-city order")}
          </span>
        ),
    },
    {
      key: "amount",
      label: "Amount",
      value: (o) => o.total,
      render: (o) => (
        <b className="amount" dir="ltr">
          {money(o.total)}
        </b>
      ),
    },
    {
      key: "payment",
      label: "Payment",
      value: (o) => paymentStatus(o),
      render: (o) => <Badge value={paymentStatus(o)} />,
    },
    {
      key: "status",
      label: "Delivery status",
      value: (o) => (o.type === "outside" ? o.trackingStatus : o.status),
      render: (o) => (
        <Badge value={o.type === "outside" ? o.trackingStatus : o.status} />
      ),
    },
  ];
}
export function Orders({
  tracking = false,
  sales = false,
  onOrder,
  onNew,
}: {
  tracking?: boolean;
  sales?: boolean;
  onOrder: (id: string) => void;
  onNew: () => void;
}) {
  const { state: s, t } = useStore();
  const [q, setQ] = useState(""),
    [tab, setTab] = useState("All orders"),
    [status, setStatus] = useState(""),
    [city, setCity] = useState(""),
    [courier, setCourier] = useState(""),
    [payment, setPayment] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const all = s!.orders.filter(
    (o) =>
      (!tracking || o.type === "outside") && (!sales || o.stage === "sold"),
  );
  const filtered = all.filter(
    (o) =>
      matchesOrder(o, q) &&
      (!city || o.customer.city === city) &&
      (!courier || o.courierId === courier) &&
      (!payment || paymentStatus(o) === payment) &&
      (!from || o.date.slice(0, 10) >= from) &&
      (!to || o.date.slice(0, 10) <= to) &&
      (!status ||
        (o.type === "outside" ? o.trackingStatus : o.status) === status) &&
      (tab === "All orders" ||
        (tab === "City orders" && o.type === "city") ||
        (tab === "Out-of-city orders" && o.type === "outside") ||
        (tab === "Awaiting dispatch" &&
          ["Order Received", "Order Confirmed", "Packed"].includes(
            o.trackingStatus,
          )) ||
        (o.type === "outside" ? o.trackingStatus : o.status) === tab),
  );
  const title = tracking ? "Order tracking" : sales ? "Sales" : "Orders";
  const statuses = [
    ...new Set(
      all.map((o) => (o.type === "outside" ? o.trackingStatus : o.status)),
    ),
  ];
  const counts = [
    ["All orders", all.length, Truck],
    [
      "Awaiting dispatch",
      all.filter((o) =>
        ["Order Received", "Order Confirmed", "Packed"].includes(
          o.trackingStatus,
        ),
      ).length,
      Package,
    ],
    [
      "In Transit",
      all.filter((o) => o.trackingStatus === "In Transit").length,
      MapPin,
    ],
    [
      "Delivered",
      all.filter((o) => o.status === "Delivered").length,
      CheckCheck,
    ],
  ] as const;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t(title)}</h1>
          <p>
            {t(
              tracking
                ? "Follow every out-of-city shipment."
                : "Manage every order from confirmation to delivery.",
            )}
          </p>
        </div>
        <div className="actions">
          <ExportMenu
            orders={filtered}
            title={title}
            range={`${from || "—"} — ${to || "—"}`}
          />
          <button className="btn primary" onClick={onNew}>
            <Plus size={17} />
            {t("New order")}
          </button>
        </div>
      </div>
      {tracking && (
        <div className="stat-grid">
          {counts.map(([label, value, Icon], i) => (
            <button
              key={label}
              className={"stat-card " + (tab === label ? "chosen" : "")}
              onClick={() => setTab(label)}
            >
              <div>
                <span>{t(label)}</span>
                <span className={"stat-icon tone-" + i}>
                  <Icon size={19} />
                </span>
              </div>
              <strong>{value}</strong>
              <small>{t("Orders")}</small>
            </button>
          ))}
        </div>
      )}
      <section className="surface">
        <TabBar
          value={tab}
          onChange={setTab}
          items={
            tracking
              ? [
                  "All orders",
                  "Awaiting dispatch",
                  "Dispatched",
                  "In Transit",
                  "Out for Delivery",
                  "Delivered",
                  "Delivery Attempted",
                  "Returned",
                  "Cancelled",
                ]
              : [
                  "All orders",
                  "City orders",
                  "Out-of-city orders",
                  "Delivered",
                  "Cancelled",
                  "Returned",
                ]
          }
        />
        <div className="filter-main">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search by order, invoice, name, phone, city or tracking…"
            onEnter={() => {
              if (filtered.length === 1) onOrder(filtered[0].id);
            }}
          />
        </div>
        <div className="filters">
          <Choose
            label="Status"
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "All statuses" }, ...statuses]}
            placeholder="All statuses"
          />
          <Choose
            label="City"
            value={city}
            onChange={setCity}
            options={[
              { value: "", label: "All cities" },
              ...[...new Set(all.map((o) => o.customer.city).filter(Boolean))],
            ]}
          />
          {tracking && (
            <Choose
              label="Courier"
              value={courier}
              onChange={setCourier}
              options={[
                { value: "", label: "All couriers" },
                ...s!.couriers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}
          <Choose
            label="Payment status"
            value={payment}
            onChange={setPayment}
            options={[
              { value: "", label: "All payments" },
              "Paid",
              "Unpaid",
              "Partially paid",
              "Refund due",
              "Closed",
            ]}
          />
          <Field label="From" type="date" value={from} onChange={setFrom} />
          <Field label="To" type="date" value={to} onChange={setTo} />
          {(q ||
            city ||
            courier ||
            status ||
            payment ||
            from ||
            to ||
            tab !== "All orders") && (
            <button
              className="icon-btn"
              title={t("Clear filters")}
              aria-label={t("Clear filters")}
              onClick={() => {
                setQ("");
                setCity("");
                setCourier("");
                setStatus("");
                setPayment("");
                setFrom("");
                setTo("");
                setTab("All orders");
              }}
            >
              <FilterX size={18} />
            </button>
          )}
        </div>
        <DataTable
          data={filtered}
          columns={orderColumns(t, tracking)}
          onRow={(o) => onOrder(o.id)}
        />
      </section>
      {tracking && (
        <p className="footnote">
          {t("Tracking is updated manually by your staff.")}
        </p>
      )}
    </>
  );
}
