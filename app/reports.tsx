"use client";
import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  Wallet,
  Truck,
  Package,
  Download,
  Printer,
  FileText,
  Plus,
  CheckCheck,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useStore } from "./store-context";
import { DataTable, Choose, Field, Badge, dateLabel } from "./controls";
import {
  money,
  paid,
  due,
  reversed,
  stock,
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
import { orderColumns } from "./orders";
import { toast } from "sonner";
export function Overview({
  onOrder,
  onNavigate,
}: {
  onOrder: (id: string) => void;
  onNavigate: (s: string) => void;
}) {
  const { state: s, t } = useStore();
  const now = new Date(),
    today = now.toISOString().slice(0, 10);
  const sales = s!.orders.filter((o) => o.stage === "sold" && !reversed(o));
  const todays = sales.filter((o) => o.date.slice(0, 10) === today);
  const chart = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - (6 - i) * 86400000),
      iso = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en-GB", { weekday: "short" }),
      amount: sales
        .filter((o) => o.date.slice(0, 10) === iso)
        .reduce((a, o) => a + o.total, 0),
    };
  });
  const pending = s!.orders.filter(
    (o) => !["Delivered", "Cancelled", "Returned"].includes(o.status),
  ).length;
  const stats = [
    [
      "Today’s sales",
      money(todays.reduce((a, o) => a + o.total, 0)),
      ShoppingBag,
      "sales",
    ],
    [
      "Orders today",
      String(s!.orders.filter((o) => o.date.slice(0, 10) === today).length),
      Package,
      "orders",
    ],
    ["Pending delivery", String(pending), Truck, "tracking"],
    [
      "Outstanding credit",
      money(s!.orders.reduce((a, o) => a + due(o), 0)),
      Wallet,
      "accounts",
    ],
  ] as const;
  const delivered = s!.orders.filter((o) => o.status === "Delivered").length;
  const outside = s!.orders.filter((o) => o.type === "outside").length;
  const low = s!.products.filter(
    (p) => p.active && stock(s!, p.id).available <= p.reorderLevel,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{s!.settings.storeName.toUpperCase()}</p>
          <h1>{t("Store overview")}</h1>
          <p>{t("Your sales, stock, and deliveries at a glance.")}</p>
        </div>
        <button className="btn primary" onClick={() => onNavigate("pos")}>
          <Plus size={17} />
          {t("New order")}
        </button>
      </div>
      <div className="stat-grid">
        {stats.map(([label, value, Icon, view], i) => (
          <button
            className="stat-card"
            key={label}
            onClick={() => onNavigate(view)}
          >
            <div>
              <span>{t(label)}</span>
              <span className={"stat-icon tone-" + i}>
                <Icon size={19} />
              </span>
            </div>
            <strong
              className={i === 0 || i === 3 ? "money-stat" : ""}
              dir="ltr"
            >
              {value}
            </strong>
            <small>
              {t(i === 0 ? "PKR" : i === 3 ? "Credit / Udhaar" : "Orders")}
              <ArrowUpRight size={12} />
            </small>
          </button>
        ))}
      </div>
      <div className="overview-grid">
        <section className="chart-surface">
          <div className="section-head">
            <h2>{t("Sales this week")}</h2>
            <span className="muted">{t("Last 7 days")} · PKR</span>
          </div>
          <ChartContainer
            config={{ amount: { label: t("Sales"), color: "#428369" } }}
            className="sales-chart"
          >
            <BarChart
              data={chart}
              margin={{ top: 15, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 5"
                stroke="#e7edeb"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#8b9693" }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#8b9693" }}
                tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : v)}
              />
              <Tooltip
                formatter={(v: any) => money(Number(v))}
                contentStyle={{ borderRadius: 9, border: "1px solid #e2e9e6" }}
                cursor={{ fill: "#f0f6f2" }}
              />
              <Bar
                dataKey="amount"
                fill="#428369"
                radius={[5, 5, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ChartContainer>
        </section>
        <section className="delivery-overview">
          <div className="section-head">
            <h2>{t("Delivery overview")}</h2>
            <Truck size={18} />
          </div>
          <div className="delivery-big">
            <b>{pending}</b>
            <span>{t("Pending deliveries")}</span>
          </div>
          <div className="delivery-pair">
            <Building2 size={18} />
            <span>{t("City orders")}</span>
            <strong>{s!.orders.length - outside}</strong>
          </div>
          <div className="delivery-pair">
            <Truck size={18} />
            <span>{t("Out-of-city orders")}</span>
            <strong>{outside}</strong>
          </div>
          <div className="delivery-pair">
            <CheckCheck size={18} />
            <span>{t("Delivered")}</span>
            <strong>{delivered}</strong>
          </div>
          <button className="btn full" onClick={() => onNavigate("tracking")}>
            {t("Order tracking")}
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <section className="surface">
        <div className="section-head">
          <h2>{t("Recent orders")}</h2>
          <button className="text-button" onClick={() => onNavigate("orders")}>
            {t("View all")}
            <ArrowRight size={14} />
          </button>
        </div>
        <DataTable
          data={s!.orders.slice(0, 6)}
          columns={orderColumns(t)}
          onRow={(o) => onOrder(o.id)}
          compact
        />
      </section>
      {low.length > 0 && (
        <section className="stock-alert">
          <Package size={20} />
          <span>
            {low.length} {t("Low stock").toLowerCase()} ·{" "}
            {low
              .map((p) => p.name)
              .slice(0, 3)
              .join(", ")}
          </span>
          <button
            className="text-button"
            onClick={() => onNavigate("products")}
          >
            {t("View all")}
            <ArrowRight size={14} />
          </button>
        </section>
      )}
    </>
  );
}
const types = [
  "All orders",
  "City orders",
  "Out-of-city orders",
  "Pending deliveries",
  "Delivered orders",
  "Returned orders",
  "Cancelled orders",
  "Courier-wise orders",
  "City-wise orders",
  "Delivery status",
  "Payment status",
];
export function Reports({ onOrder }: { onOrder: (id: string) => void }) {
  const { state: s, t, lang } = useStore();
  const [type, setType] = useState("All orders"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [city, setCity] = useState(""),
    [courier, setCourier] = useState("");
  const orders = s!.orders.filter(
    (o) =>
      (!from || o.date.slice(0, 10) >= from) &&
      (!to || o.date.slice(0, 10) <= to) &&
      (!city || o.customer.city === city) &&
      (!courier || o.courierId === courier) &&
      (type === "City orders"
        ? o.type === "city"
        : type === "Out-of-city orders"
          ? o.type === "outside"
          : type === "Pending deliveries"
            ? !["Delivered", "Returned", "Cancelled"].includes(o.status)
            : type === "Delivered orders"
              ? o.status === "Delivered"
              : type === "Returned orders"
                ? o.status === "Returned"
                : type === "Cancelled orders"
                  ? o.status === "Cancelled"
                  : true),
  );
  const grouped = [
    "Courier-wise orders",
    "City-wise orders",
    "Delivery status",
    "Payment status",
  ].includes(type);
  const groups = Object.values(
    orders.reduce(
      (all, o) => {
        const key =
          type === "Courier-wise orders"
            ? s!.couriers.find((c) => c.id === o.courierId)?.name ||
              t("No courier selected")
            : type === "City-wise orders"
              ? o.customer.city || "—"
              : type === "Payment status"
                ? t(paymentStatus(o))
                : t(o.type === "outside" ? o.trackingStatus : o.status);
        const g = all[key] || {
          id: key,
          name: key,
          count: 0,
          total: 0,
          paid: 0,
          balance: 0,
        };
        g.count++;
        g.total = roundMoney(g.total + o.total);
        g.paid = roundMoney(g.paid + paid(o));
        g.balance = roundMoney(g.balance + due(o));
        all[key] = g;
        return all;
      },
      {} as Record<
        string,
        {
          id: string;
          name: string;
          count: number;
          total: number;
          paid: number;
          balance: number;
        }
      >,
    ),
  );
  const rows = grouped
    ? [
        [
          t(type),
          ...["Order count", "Amount", "Amount received", "Balance due"].map(t),
        ],
        ...groups.map((g) => [g.name, g.count, g.total, g.paid, g.balance]),
      ]
    : orderRows(s!, orders, lang);
  const exportFile = (format: string) => {
    if (format === "csv") csvExport("karobar-report", rows);
    else if (format === "excel") excelExport("karobar-report", rows);
    else {
      if (format === "pdf")
        toast.info(t("Choose Save as PDF in the print dialog."));
      printDocument(
        t(type),
        reportHTML(t(type), rows, s!, `${from || "—"} — ${to || "—"}`),
        lang,
      );
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Reports")}</h1>
          <p>{t("Filter, review, and export your order records.")}</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => exportFile("print")}>
            <Printer size={16} />
            {t("Print")}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="btn primary">
              <Download size={16} />
              {t("Export")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportFile("pdf")}>
                {t("PDF")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportFile("csv")}>
                {t("CSV")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportFile("excel")}>
                {t("Excel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <section className="surface report-filters">
        <Choose
          label="Report type"
          value={type}
          onChange={setType}
          options={types}
        />
        <Field label="From" type="date" value={from} onChange={setFrom} />
        <Field label="To" type="date" value={to} onChange={setTo} />
        <Choose
          label="City"
          value={city}
          onChange={setCity}
          options={[
            { value: "", label: "All cities" },
            ...[
              ...new Set(s!.orders.map((o) => o.customer.city).filter(Boolean)),
            ],
          ]}
        />
        <Choose
          label="Courier"
          value={courier}
          onChange={setCourier}
          options={[
            { value: "", label: "All couriers" },
            ...s!.couriers.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </section>
      <div className="stat-grid three">
        <div className="stat-card">
          <span>{t("Order count")}</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="stat-card">
          <span>{t("Amount")}</span>
          <strong className="money-stat" dir="ltr">
            {money(orders.reduce((a, o) => a + o.total, 0))}
          </strong>
        </div>
        <div className="stat-card">
          <span>{t("Balance due")}</span>
          <strong className="money-stat" dir="ltr">
            {money(orders.reduce((a, o) => a + due(o), 0))}
          </strong>
        </div>
      </div>
      <section className="surface">
        <div className="section-head">
          <h2>{t(type)}</h2>
          <span className="muted">{t("All amounts in PKR")}</span>
        </div>
        {grouped ? (
          <DataTable
            data={groups}
            columns={[
              { key: "name", label: type, value: (g) => g.name },
              { key: "count", label: "Order count", value: (g) => g.count },
              {
                key: "total",
                label: "Amount",
                value: (g) => g.total,
                render: (g) => money(g.total),
              },
              {
                key: "paid",
                label: "Amount received",
                value: (g) => g.paid,
                render: (g) => money(g.paid),
              },
              {
                key: "balance",
                label: "Balance due",
                value: (g) => g.balance,
                render: (g) => money(g.balance),
              },
            ]}
          />
        ) : (
          <DataTable
            data={orders}
            columns={orderColumns(t)}
            onRow={(o) => onOrder(o.id)}
          />
        )}
      </section>
    </>
  );
}
function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
