export type Lang = "en" | "ur" | "pa";
export type Product = {
  version?: number;
  id: string;
  name: string;
  nameUr: string;
  namePa: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  cost: number;
  openingStock: number;
  reorderLevel: number;
  active: boolean;
};
export type Person = {
  version?: number;
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  area: string;
  city: string;
  province: string;
  postal: string;
  notes: string;
};
export type Courier = {
  version?: number;
  id: string;
  name: string;
  phone: string;
  website: string;
  pattern: string;
  contact: string;
};
export type Line = {
  productId: string;
  name: string;
  qty: number;
  price: number;
};
export type Payment = {
  voided?: boolean;
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
};
export type TrackEvent = { status: string; date: string; note: string };
export type Order = {
  version?: number;
  id: string;
  invoice: string;
  date: string;
  type: "city" | "outside";
  customerId: string;
  customer: Person;
  items: Line[];
  discount: number;
  shipping: number;
  charge: number;
  chargeName: string;
  total: number;
  payments: Payment[];
  method: string;
  status: string;
  trackingStatus: string;
  courierId: string;
  trackingNumber: string;
  shipmentDate: string;
  expectedDate: string;
  trackingUrl: string;
  deliveryNotes: string;
  instructions: string;
  notes: string;
  history: TrackEvent[];
  stage: "reserved" | "sold" | "none";
  restocked: { productId: string; qty: number }[];
  returnReceived: boolean;
};
export type Purchase = {
  version?: number;
  id: string;
  date: string;
  supplierId: string;
  items: Line[];
  discount: number;
  shipping: number;
  total: number;
  payments: Payment[];
  notes: string;
};
export type Settings = {
  version?: number;
  storeName: string;
  phone: string;
  address: string;
  city: string;
  stockDeduction: "dispatch" | "confirm";
  deliveryCharge: number;
  shippingCharge: number;
  extraChargeName: string;
  extraCharge: number;
  receiptNote: string;
};
export type ChangeEntry = {
  id: string;
  date: string;
  kind: string;
  recordId: string;
  action: string;
  reason: string;
  changes: { field: string; before: unknown; after: unknown }[];
};
export type StockAdjustment = {
  id: string;
  productId: string;
  date: string;
  delta: number;
  reason: string;
};
export type StoreState = {
  changes?: ChangeEntry[];
  stockAdjustments?: StockAdjustment[];
  products: Product[];
  customers: Person[];
  suppliers: Person[];
  couriers: Courier[];
  orders: Order[];
  purchases: Purchase[];
  settings: Settings;
  sequence: number;
  purchaseSequence: number;
  demo: boolean;
  processed: string[];
};
export const CITY_STATUSES = [
  "New",
  "Confirmed",
  "Preparing",
  "Ready",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "Returned",
];
export const TRACK_STATUSES = [
  "Order Received",
  "Order Confirmed",
  "Packed",
  "Dispatched",
  "In Transit",
  "Arrived at Destination City",
  "Out for Delivery",
  "Delivered",
  "Delivery Attempted",
  "Returned",
  "Cancelled",
];
export const METHODS = [
  "Cash",
  "Bank transfer",
  "JazzCash",
  "Easypaisa",
  "Cash on delivery",
  "Credit / Udhaar",
];
export const CATEGORIES = ["Kitchen", "Cleaning", "Home essentials", "Other"];
export const blankPerson = (): Person => ({
  id: "",
  name: "",
  phone: "",
  whatsapp: "",
  address: "",
  area: "",
  city: "",
  province: "Punjab",
  postal: "",
  notes: "",
});
export const money = (n: number) =>
  "Rs. " +
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(n);
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const paid = (x: { payments: Payment[] }) =>
  round(x.payments.reduce((s, p) => s + p.amount, 0));
export const reversed = (o: Order) =>
  ["Cancelled", "Returned"].includes(o.status);
export const due = (o: Order) =>
  round(Math.max(0, (reversed(o) ? 0 : o.total) - paid(o)));
export const refundDue = (entry: Order | Purchase) =>
  round(
    Math.max(
      0,
      paid(entry) - ("status" in entry && reversed(entry) ? 0 : entry.total),
    ),
  );
export const balanceDue = (entry: Purchase) =>
  round(Math.max(0, entry.total - paid(entry)));
export const paymentStatus = (o: Order) =>
  refundDue(o) > 0
    ? "Refund due"
    : reversed(o)
      ? "Closed"
      : paid(o) >= o.total
        ? "Paid"
        : paid(o) > 0
          ? "Partially paid"
          : "Unpaid";
export const categories = (s: StoreState) => [
  ...new Set([...CATEGORIES, ...s.products.map((p) => p.category)]),
];
export function stock(s: StoreState, id: string) {
  const p = s.products.find((p) => p.id === id);
  let sold = 0,
    reserved = 0,
    returned = 0;
  for (const o of s.orders) {
    for (const i of o.items)
      if (i.productId === id) {
        if (o.stage === "reserved") reserved += i.qty;
        if (o.stage === "sold") sold += i.qty;
      }
    for (const r of o.restocked) if (r.productId === id) returned += r.qty;
  }
  const purchased = s.purchases
    .flatMap((x) => x.items)
    .filter((x) => x.productId === id)
    .reduce((a, i) => a + i.qty, 0);
  const adjusted = (s.stockAdjustments || [])
    .filter((a) => a.productId === id)
    .reduce((sum, a) => sum + a.delta, 0);
  const onHand =
    (p?.openingStock || 0) + purchased - sold + returned + adjusted;
  return {
    onHand,
    available: onHand - reserved,
    reserved,
    sold,
    returned,
    purchased,
    adjusted,
  };
}
export function trackingUrl(s: StoreState, o: Order) {
  const p =
    o.trackingUrl || s.couriers.find((c) => c.id === o.courierId)?.pattern;
  if (!p || !o.trackingNumber) return "";
  const url = p.replaceAll("{tracking}", encodeURIComponent(o.trackingNumber));
  try {
    const u = new URL(url);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function matchesOrder(o: Order, q: string) {
  const terms = q.trim().toLowerCase();
  return [
    o.id,
    o.invoice,
    o.customer.name,
    o.customer.phone,
    o.customer.city,
    o.trackingNumber,
  ]
    .join(" ")
    .toLowerCase()
    .includes(terms);
}
export function initialState(): StoreState {
  return {
    changes: [],
    stockAdjustments: [],
    products: [],
    customers: [],
    suppliers: [],
    couriers: [],
    orders: [],
    purchases: [],
    settings: {
      storeName: "My store",
      phone: "",
      address: "",
      city: "Lahore",
      stockDeduction: "dispatch",
      deliveryCharge: 150,
      shippingCharge: 300,
      extraChargeName: "",
      extraCharge: 0,
      receiptNote: "Thank you for shopping with us.",
    },
    sequence: 0,
    purchaseSequence: 0,
    demo: false,
    processed: [],
  };
}
export function sampleState(now = new Date()): StoreState {
  const s = initialState();
  s.demo = true;
  const names = [
    [
      "Stainless steel knife",
      "اسٹیل چھری",
      "سٹیل چھری",
      "Kitchen",
      180,
      120,
      96,
    ],
    [
      "Crystal spray bottle",
      "کرسٹل سپرے بوتل",
      "کرسٹل سپرے بوتل",
      "Home essentials",
      120,
      80,
      72,
    ],
    [
      "Steel hanger set",
      "اسٹیل ہینگر سیٹ",
      "سٹیل ہینگر سیٹ",
      "Home essentials",
      290,
      210,
      48,
    ],
    ["Kitchen gloves", "کچن گلوز", "کچن دے دستانے", "Kitchen", 230, 160, 60],
    [
      "Steel floor wiper",
      "اسٹیل وائپر",
      "سٹیل وائپر",
      "Cleaning",
      210,
      150,
      36,
    ],
    [
      "Silicone bath belt",
      "سلیکون باتھ بیلٹ",
      "سلیکون باتھ بیلٹ",
      "Home essentials",
      190,
      120,
      42,
    ],
    ["Bamboo spoon", "بانس کا چمچ", "بانس دا چمچ", "Kitchen", 65, 40, 120],
    ["Oil dispenser", "آئل بوتل", "تیل دی بوتل", "Kitchen", 140, 95, 64],
    ["Carpet brush", "کارپٹ برش", "قالین دا برش", "Cleaning", 105, 70, 84],
    [
      "Baby hanger set",
      "بچوں کے ہینگر",
      "بچیاں دے ہینگر",
      "Home essentials",
      240,
      180,
      32,
    ],
    ["Cotton buds", "کاٹن بڈز", "کاٹن بڈز", "Home essentials", 85, 55, 100],
    ["Steel strainer", "اسٹیل چھلنی", "سٹیل چھاننی", "Kitchen", 180, 125, 28],
  ];
  s.products = names.map((p, i) => ({
    id: "p" + (i + 1),
    name: String(p[0]),
    nameUr: String(p[1]),
    namePa: String(p[2]),
    category: String(p[3]),
    sku: "KB-" + String(i + 1).padStart(3, "0"),
    barcode: "890100000" + String(i + 1).padStart(3, "0"),
    price: Number(p[4]),
    cost: Number(p[5]),
    openingStock: Number(p[6]),
    reorderLevel: 10,
    active: true,
  }));
  s.customers = [
    ["Ahmed Hassan", "03001234567", "Lahore", "Gulberg III"],
    ["Fatima Ali", "03211234567", "Islamabad", "F-10 Markaz"],
    ["Usman Khan", "03321234567", "Karachi", "Gulshan-e-Iqbal"],
    ["Ayesha Malik", "03451234567", "Faisalabad", "D Ground"],
    ["Bilal Ahmed", "03121234567", "Lahore", "Model Town"],
  ].map((x, i) => ({
    ...blankPerson(),
    id: "c" + (i + 1),
    name: x[0],
    phone: x[1],
    whatsapp: x[1],
    city: x[2],
    area: x[3],
    address: "Sample address · " + x[3],
    province:
      x[2] === "Karachi"
        ? "Sindh"
        : x[2] === "Islamabad"
          ? "Islamabad Capital Territory"
          : "Punjab",
    postal: "54000",
  }));
  s.suppliers = [
    {
      ...blankPerson(),
      id: "s1",
      name: "Rehman Wholesale",
      phone: "04212345678",
      city: "Lahore",
      address: "Sample wholesale market",
    },
  ];
  s.couriers = [
    {
      id: "cr1",
      name: "City Express",
      phone: "",
      website: "",
      pattern: "",
      contact: "Sample courier · add your actual courier details",
    },
    {
      id: "cr2",
      name: "National Logistics",
      phone: "",
      website: "",
      pattern: "",
      contact: "Sample courier · add your actual courier details",
    },
  ];
  const states = [
    "In Transit",
    "Packed",
    "Out for Delivery",
    "Delivered",
    "Delivery Attempted",
    "Confirmed",
    "Returned",
    "Cancelled",
    "Delivered",
    "Dispatched",
    "Order Received",
    "Ready",
  ];
  for (let i = 0; i < 12; i++) {
    const date = new Date(
      now.getTime() - (i % 7) * 86400000 - 3600000,
    ).toISOString();
    const type = i % 3 === 2 ? "city" : "outside";
    const customer = s.customers[type === "outside" ? [1, 2, 3][i % 3] : i % 5];
    const status = states[i];
    const trackingStatus = type === "outside" ? status : "";
    const cityStatus =
      type === "city"
        ? status === "Order Confirmed"
          ? "Confirmed"
          : status
        : status === "Order Received"
          ? "New"
          : status === "Order Confirmed"
            ? "Confirmed"
            : status === "Packed"
              ? "Preparing"
              : [
                    "Dispatched",
                    "In Transit",
                    "Arrived at Destination City",
                    "Delivery Attempted",
                  ].includes(status)
                ? "Out for Delivery"
                : status;
    const items = [
      {
        productId: s.products[i % 12].id,
        name: s.products[i % 12].name,
        qty: 6,
        price: s.products[i % 12].price,
      },
      {
        productId: s.products[(i + 2) % 12].id,
        name: s.products[(i + 2) % 12].name,
        qty: 3,
        price: s.products[(i + 2) % 12].price,
      },
    ];
    const total =
      items.reduce((a, p) => a + p.qty * p.price, 0) +
      (type === "city" ? 150 : 300);
    const stage = ["New", "Cancelled"].includes(cityStatus)
      ? "none"
      : ["Delivered", "Out for Delivery", "Returned"].includes(cityStatus)
        ? "sold"
        : "reserved";
    const baseSteps =
      type === "outside"
        ? TRACK_STATUSES.slice(0, 8)
        : CITY_STATUSES.slice(0, 6);
    const activeStatus = type === "outside" ? status : cityStatus;
    const historySteps =
      activeStatus === "Cancelled"
        ? [...baseSteps.slice(0, 2), "Cancelled"]
        : ["Returned", "Delivery Attempted"].includes(activeStatus)
          ? [...baseSteps.slice(0, -1), activeStatus]
          : baseSteps.slice(0, baseSteps.indexOf(activeStatus) + 1);
    const history = historySteps.map((st, j) => ({
      status: st,
      date: new Date(new Date(date).getTime() + j * 60000).toISOString(),
      note: "Sample update",
    }));
    s.orders.push({
      id: `ORD-${now.getFullYear()}-${String(i + 1).padStart(5, "0")}`,
      invoice: `INV-${now.getFullYear()}-${String(i + 1).padStart(5, "0")}`,
      date,
      type,
      customerId: customer.id,
      customer: { ...customer },
      items,
      discount: 0,
      shipping: type === "city" ? 150 : 300,
      charge: 0,
      chargeName: "",
      total,
      method: i % 2 ? "Cash" : "Cash on delivery",
      payments:
        i % 2
          ? [
              {
                id: "pay" + i,
                date,
                amount: total,
                method: "Cash",
                note: "Sample payment",
              },
            ]
          : [],
      status: cityStatus,
      trackingStatus,
      courierId: type === "outside" ? s.couriers[i % 2].id : "",
      trackingNumber: type === "outside" ? "DEMO" + String(12001 + i) : "",
      shipmentDate: stage === "sold" ? date.slice(0, 10) : "",
      expectedDate: new Date(now.getTime() + 86400000)
        .toISOString()
        .slice(0, 10),
      trackingUrl: "",
      deliveryNotes: "",
      instructions: "",
      notes: "Sample order",
      history,
      stage,
      restocked: [],
      returnReceived: false,
    });
  }
  s.sequence = 12;
  return s;
}
