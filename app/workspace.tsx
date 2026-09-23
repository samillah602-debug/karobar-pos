"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Store,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Truck,
  Users,
  BarChart3,
  Settings,
  Search,
  Plus,
  Wallet,
  ClipboardList,
  ShoppingCart,
  ChevronRight,
  ArrowUpRight,
  Languages,
  Globe,
  ArrowRight,
  Command as CommandIcon,
  Menu,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreProvider, useStore } from "./store-context";
import { Choose, dateLabel } from "./controls";
import { POS } from "./pos";
import { Orders } from "./orders";
import { OrderDetail, PurchaseDetail } from "./order-detail";
import {
  Products,
  People,
  Purchases,
  Accounts,
  Couriers,
  StoreSettings,
} from "./business";
import { Overview, Reports } from "./reports";
import { matchesOrder, type Lang } from "@/lib/pos/model";
const navigation = [
  ["overview", "Overview", LayoutDashboard],
  ["pos", "Point of sale", ShoppingBag],
  ["orders", "Orders", ClipboardList],
  ["tracking", "Order tracking", Truck],
  ["products", "Products", Package],
  ["sales", "Sales", BarChart3],
  ["purchases", "Purchases", ShoppingCart],
  ["customers", "Customers", Users],
  ["suppliers", "Suppliers", Store],
  ["accounts", "Credit / Udhaar", Wallet],
  ["couriers", "Couriers", Truck],
  ["reports", "Reports", BarChart3],
] as const;
export default function Workspace() {
  return (
    <StoreProvider>
      <WorkspaceShell />
    </StoreProvider>
  );
}
function WorkspaceShell() {
  const { lang } = useStore();
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "232px" } as React.CSSProperties}
      dir={lang === "en" ? "ltr" : "rtl"}
    >
      <Application />
    </SidebarProvider>
  );
}
function Application() {
  const {
    state: s,
    loading,
    error,
    retry,
    lang,
    setLang,
    t,
    act,
    busy,
  } = useStore();
  const { setOpenMobile } = useSidebar();
  const [view, setView] = useState("pos"),
    [selected, setSelected] = useState<string | null>(null),
    [purchase, setPurchase] = useState<string | null>(null),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(""),
    [startOpen, setStartOpen] = useState(false),
    [posKey, setPosKey] = useState(0),
    [initialType, setInitialType] = useState<"city" | "outside">("city");
  const current = useRef({
    s,
    act,
    navigate: (v: string) => {},
    openOrder: (id: string) => {},
    start: (v: "city" | "outside") => {},
  });
  const navigate = (v: string) => {
    setView(v);
    location.hash = v;
    setOpenMobile(false);
  };
  const openOrder = (id: string) => {
    setSelected(id);
    setSearchOpen(false);
    setSearch("");
  };
  const start = (type: "city" | "outside") => {
    setInitialType(type);
    setPosKey((n) => n + 1);
    navigate("pos");
  };
  current.current = { s, act, navigate, openOrder, start };
  useEffect(() => {
    const onHash = () => {
      const v = location.hash.slice(1);
      if ([...navigation.map((n) => n[0]), "settings"].includes(v as any))
        setView(v);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "search_orders",
        title: "Search store orders",
        description:
          "Find existing orders by order ID, invoice, customer, phone, city, or tracking number. Does not modify records.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: any) => {
          if (typeof input?.query !== "string" || input.query.length > 200)
            throw new Error("A search query is required");
          return (current.current.s?.orders || [])
            .filter((o) => matchesOrder(o, input.query))
            .slice(0, 25)
            .map((o) => ({
              id: o.id,
              customer: o.customer.name,
              type: o.type,
              status: o.type === "outside" ? o.trackingStatus : o.status,
              total: o.total,
              trackingNumber: o.trackingNumber,
            }));
        },
      },
      {
        name: "open_order",
        title: "Open an order",
        description:
          "Open the complete existing order in the visible detail panel. Does not change the order.",
        inputSchema: {
          type: "object",
          properties: { orderId: { type: "string" } },
          required: ["orderId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: any) => {
          const o = current.current.s?.orders.find(
            (o) => o.id === input?.orderId,
          );
          if (!o) throw new Error("Order not found");
          current.current.openOrder(o.id);
          return { opened: o.id };
        },
      },
      {
        name: "start_new_order",
        title: "Start a new order",
        description:
          "Open an empty city or out-of-city POS form. Does not create or confirm a saved order. Clears the current unsaved POS draft.",
        inputSchema: {
          type: "object",
          properties: {
            orderType: { type: "string", enum: ["city", "outside"] },
          },
          required: ["orderType"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: any) => {
          if (!["city", "outside"].includes(input?.orderType))
            throw new Error("Choose city or outside");
          current.current.start(input.orderType);
          return { formOpened: true, orderType: input.orderType };
        },
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    if (!search.trim()) return;
    const exact = s?.orders.find((o) =>
      [o.id, o.invoice, o.trackingNumber].some(
        (x) => x && x.toLowerCase() === search.trim().toLowerCase(),
      ),
    );
    if (exact) openOrder(exact.id);
  }, [search, s?.orders]);
  const found =
    s?.orders.filter((o) => matchesOrder(o, search)).slice(0, 12) || [];
  const title = navigation.find((n) => n[0] === view)?.[1] || "Settings";
  return (
    <>
      <Sidebar side={lang === "en" ? "left" : "right"} className="app-sidebar">
        <SidebarHeader>
          <button
            className="brand"
            onClick={() => navigate("overview")}
            aria-label={t("Overview")}
          >
            <span>
              <Store size={23} />
            </span>
            <div>
              karobar
              <small>
                {lang === "en"
                  ? "YOUR BUSINESS, TOGETHER"
                  : lang === "ur"
                    ? "آپ کا کاروبار، آپ کے ساتھ"
                    : "تہاڈا کاروبار، تہاڈے نال"}
              </small>
            </div>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("Workspace").toUpperCase()}
            </SidebarGroupLabel>
            <SidebarMenu>
              {navigation.map(([id, label, Icon], i) => (
                <SidebarMenuItem
                  key={id}
                  className={i === 4 ? "nav-section-break" : ""}
                >
                  <SidebarMenuButton
                    isActive={view === id}
                    onClick={() => navigate(id)}
                    tooltip={t(label)}
                  >
                    <Icon />
                    <span>{t(label)}</span>
                    {id === "tracking" &&
                      s &&
                      s.orders.filter(
                        (o) =>
                          o.type === "outside" &&
                          !["Delivered", "Returned", "Cancelled"].includes(
                            o.status,
                          ),
                      ).length > 0 && (
                        <small className="nav-count">
                          {
                            s.orders.filter(
                              (o) =>
                                o.type === "outside" &&
                                ![
                                  "Delivered",
                                  "Returned",
                                  "Cancelled",
                                ].includes(o.status),
                            ).length
                          }
                        </small>
                      )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="signout-button"
            onClick={async () => {
              const r = await fetch("/api/session", { method: "DELETE" });
              if (r.ok) location.replace("/");
            }}
          >
            {lang === "en"
              ? "Sign out"
              : lang === "ur"
                ? "سائن آؤٹ کریں"
                : "سائن آؤٹ کرو"}
          </button>
          <SidebarMenuButton
            isActive={view === "settings"}
            onClick={() => navigate("settings")}
          >
            <Settings />
            {t("Settings")}
          </SidebarMenuButton>
          <div className="store-profile">
            <span>
              {(s?.settings.storeName || "My store")
                .split(" ")
                .slice(0, 2)
                .map((x) => x[0])
                .join("")}
            </span>
            <div>
              {s?.settings.storeName || t("My store")}
              <small>{t("Main counter")} · PKR</small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <SidebarTrigger className="mobile-sidebar-toggle" />
          <span className="breadcrumb">
            {t("Workspace")}
            <ChevronRight size={12} />
            <b>{t(title)}</b>
          </span>
          <button className="global-search" onClick={() => setSearchOpen(true)}>
            <Search size={17} />
            <span>{t("Search orders, customers, tracking…")}</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="language-switch">
            <Globe size={16} />
            <Choose
              value={lang}
              onChange={(v) => setLang(v as Lang)}
              options={[
                { value: "en", label: "English" },
                { value: "ur", label: "اردو" },
                { value: "pa", label: "پنجابی" },
              ]}
              placeholder="Language"
            />
          </div>
          <div className="top-avatar">K</div>
        </header>
        <main className="main-content">
          {s?.demo && (
            <div className="sample-bar">
              <span>
                <span className="sample-dot" />
                {t("Sample workspace")}
              </span>
              <button onClick={() => setStartOpen(true)}>
                {t("Start your store")}
                <ArrowRight size={12} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-page">
              <h1>{t("Loading your store…")}</h1>
              <div className="order-type-grid">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-96" />
            </div>
          ) : error && !s ? (
            <section className="error-state">
              <AlertCircle size={32} />
              <h2>{t(error)}</h2>
              <button className="btn primary" onClick={retry}>
                <RefreshCw size={16} />
                {t("Retry")}
              </button>
            </section>
          ) : s ? (
            <>
              {view === "pos" && (
                <POS
                  key={posKey}
                  initialType={initialType}
                  onOrder={openOrder}
                  onOrders={() => navigate("orders")}
                />
              )}
              {view === "overview" && (
                <Overview onOrder={openOrder} onNavigate={navigate} />
              )}
              {["orders", "tracking", "sales"].includes(view) && (
                <Orders
                  key={view}
                  tracking={view === "tracking"}
                  sales={view === "sales"}
                  onOrder={openOrder}
                  onNew={() => navigate("pos")}
                />
              )}
              {view === "products" && <Products />}
              {view === "purchases" && <Purchases onPurchase={setPurchase} />}
              {["customers", "suppliers"].includes(view) && (
                <People
                  key={view}
                  kind={view as "customers" | "suppliers"}
                  onOrder={openOrder}
                  onPurchase={setPurchase}
                />
              )}
              {view === "accounts" && (
                <Accounts onOrder={openOrder} onPurchase={setPurchase} />
              )}
              {view === "couriers" && <Couriers />}
              {view === "reports" && <Reports onOrder={openOrder} />}
              {view === "settings" && (
                <StoreSettings onStart={() => setStartOpen(true)} />
              )}
            </>
          ) : null}
        </main>
      </SidebarInset>
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={t("Search")}
        description={t("Search orders, customers, tracking…")}
      >
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={t(
            "Search by order, invoice, name, phone, city or tracking…",
          )}
        />
        <CommandList>
          <CommandEmpty>{t("No results found")}</CommandEmpty>
          <CommandGroup heading={t("Orders")}>
            {found.map((o) => (
              <CommandItem
                key={o.id}
                value={[
                  o.id,
                  o.customer.name,
                  o.customer.phone,
                  o.customer.city,
                  o.trackingNumber,
                  o.invoice,
                ].join(" ")}
                onSelect={() => openOrder(o.id)}
              >
                <span className="command-order">
                  <b>{o.id}</b>
                  <span>
                    {o.customer.name} · {o.customer.city}
                  </span>
                  <small>{o.trackingNumber}</small>
                </span>
                <ArrowUpRight className="ml-auto" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      {s && (
        <>
          <OrderDetail id={selected} onClose={() => setSelected(null)} />
          <PurchaseDetail id={purchase} onClose={() => setPurchase(null)} />
        </>
      )}
      <AlertDialog open={startOpen} onOpenChange={setStartOpen}>
        <AlertDialogContent dir={lang === "en" ? "ltr" : "rtl"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Start an empty store")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Remove all sample records and start with an empty store?")}{" "}
              {t("This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (await act("clearDemo", {})) {
                  setStartOpen(false);
                  setSelected(null);
                  setPurchase(null);
                  setPosKey((n) => n + 1);
                  navigate("products");
                }
              }}
            >
              {t("Start your store")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
