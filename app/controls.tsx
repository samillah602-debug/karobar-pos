"use client";
import React, { useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Search,
} from "lucide-react";
import {
  useLegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { useStore } from "./store-context";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  disabled = false,
  min,
  max,
  step,
  className = "",
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
}) {
  const { t } = useStore();
  return (
    <label className={"field " + className}>
      <span>
        {t(label)}
        {required && <i> *</i>}
      </span>
      {type === "textarea" ? (
        <Textarea
          required={required}
          aria-label={t(label)}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(placeholder)}
          disabled={disabled}
        />
      ) : (
        <Input
          aria-label={t(label)}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              type === "number"
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          type={type}
          required={required}
          placeholder={t(placeholder)}
          disabled={disabled}
          min={min ?? (type === "number" ? 0 : undefined)}
          max={max}
          step={step ?? (type === "number" ? "0.01" : undefined)}
          dir={
            ["number", "tel", "url", "date", "datetime-local"].includes(type)
              ? "ltr"
              : undefined
          }
        />
      )}
    </label>
  );
}
export function Choose({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  disabled = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { t, lang } = useStore();
  return (
    <div className={"field " + className}>
      {label && <span>{t(label)}</span>}
      <Select
        value={
          value ||
          (options.some((o) => (typeof o === "string" ? o : o.value) === "")
            ? "__none"
            : undefined)
        }
        onValueChange={(v) => onChange(v === "__none" ? "" : v)}
        dir={lang === "en" ? "ltr" : "rtl"}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={t(label || placeholder)}
          className="choose-trigger"
        >
          <SelectValue placeholder={t(placeholder)} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value,
              l = typeof o === "string" ? o : o.label;
            return (
              <SelectItem key={v || "__none"} value={v || "__none"}>
                {t(l)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string; phone?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useStore();
  const selected = options.find((o) => o.id === value) || null;
  return (
    <label className="field">
      <span>{t(label)}</span>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(v) => onChange(v?.id || "")}
        itemToStringLabel={(o) => o.name + (o.phone ? " · " + o.phone : "")}
      >
        <ComboboxInput placeholder={t(label)} aria-label={t(label)} showClear />
        <ComboboxContent>
          <ComboboxEmpty>{t("No results found")}</ComboboxEmpty>
          <ComboboxList>
            {(o: { id: string; name: string; phone?: string }) => (
              <ComboboxItem key={o.id} value={o}>
                {o.name}
                {o.phone && <small>{o.phone}</small>}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </label>
  );
}
export function Badge({ value }: { value: string }) {
  const { t } = useStore();
  const c = [
    "Delivered",
    "Paid",
    "Active",
    "Confirmed",
    "Order Confirmed",
    "Available",
  ].includes(value)
    ? "green"
    : [
          "Cancelled",
          "Returned",
          "Refund due",
          "Inactive",
          "Out of stock",
        ].includes(value)
      ? "red"
      : [
            "In Transit",
            "Dispatched",
            "Out for Delivery",
            "Partially paid",
          ].includes(value)
        ? "blue"
        : [
              "Delivery Attempted",
              "Unpaid",
              "Low stock",
              "Preparing",
              "Packed",
            ].includes(value)
          ? "amber"
          : "";
  return <span className={"badge " + c}>{t(value)}</span>;
}
export function TabBar({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (s: string) => void;
  items: (string | { value: string; label: string; count?: number })[];
}) {
  const { t } = useStore();
  return (
    <Tabs value={value} onValueChange={onChange} className="tabbar">
      <TabsList variant="line">
        {items.map((it) => {
          const v = typeof it === "string" ? it : it.value,
            l = typeof it === "string" ? it : it.label;
          return (
            <TabsTrigger key={v} value={v}>
              {t(l)}
              {typeof it !== "string" && it.count !== undefined && (
                <span className="tab-count">{it.count}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
export function EmptyState({
  title = "No results found",
  description = "Try another search or clear your filters.",
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const { t } = useStore();
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Package />
        </EmptyMedia>
        <EmptyTitle>{t(title)}</EmptyTitle>
        <EmptyDescription>{t(description)}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search",
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onEnter?: () => void;
}) {
  const { t } = useStore();
  return (
    <div className="search-field">
      <Search size={18} />
      <input
        aria-label={t(placeholder)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(placeholder)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onEnter?.();
          }
        }}
      />
    </div>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { t, lang } = useStore();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={"app-modal " + (wide ? "wide" : "")}
        dir={lang === "en" ? "ltr" : "rtl"}
      >
        <DialogHeader>
          <DialogTitle>{t(title)}</DialogTitle>
          <DialogDescription className={description ? "" : "sr-only"}>
            {t(description || title)}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export type Column<T> = {
  key: string;
  label: string;
  value: (r: T) => string | number;
  render?: (r: T) => React.ReactNode;
};
export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRow,
  compact = false,
}: {
  data: T[];
  columns: Column<T>[];
  onRow?: (r: T) => void;
  compact?: boolean;
}) {
  const { t } = useStore();
  const cols: LegacyColumnDef<T>[] = React.useMemo(
    () =>
      columns.map((c) => ({
        id: c.key,
        header: t(c.label),
        accessorFn: c.value,
        cell: ({ row }) =>
          c.render ? c.render(row.original) : c.value(row.original),
      })),
    [columns, t],
  );
  const table = useLegacyTable({
    data,
    columns: cols,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: compact ? 6 : 15 } },
  });
  return (
    <div className="table-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  <button
                    onClick={h.column.getToggleSortingHandler()}
                    className="table-sort"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    <ArrowUpDown size={11} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={onRow ? "clickable-row" : ""}
              onClick={() => onRow?.(row.original)}
              tabIndex={onRow ? 0 : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  onRow?.(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((c) => (
                <TableCell key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data.length && <EmptyState />}
      {data.length > 15 && (
        <div className="pagination">
          <span>
            {table.getState().pagination.pageIndex + 1} {t("of")}{" "}
            {table.getPageCount()}
          </span>
          <button
            aria-label={t("Previous")}
            className="icon-btn"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label={t("Next")}
            className="icon-btn"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
export function dateLabel(d: string, time = false) {
  return d
    ? new Date(d).toLocaleString(
        "en-GB",
        time
          ? {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }
          : { day: "2-digit", month: "short", year: "numeric" },
      )
    : "—";
}
