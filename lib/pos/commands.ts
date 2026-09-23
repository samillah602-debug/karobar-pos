import { applyEdit, recordChanges } from "./editing";
import { z } from "zod";
import {
  blankPerson,
  CATEGORIES,
  CITY_STATUSES,
  TRACK_STATUSES,
  METHODS,
  due,
  initialState,
  paid,
  round,
  stock,
  reversed,
  refundDue,
  type StoreState,
  type Order,
  type Person,
  type Line,
} from "./model";
const txt = z.string().trim().max(500).default("");
const amount = z.coerce.number().finite().min(0).max(1_000_000_000);
const count = z.coerce.number().int().min(0).max(1_000_000);
const personSchema = z.object({
  id: txt,
  name: z.string().trim().min(1, "Customer name is required").max(120),
  phone: txt,
  whatsapp: txt,
  address: txt,
  area: txt,
  city: txt,
  province: txt,
  postal: txt,
  notes: txt,
});
const lineSchema = z.object({
  productId: z.string().min(1),
  qty: count.min(1),
  price: amount,
});
const newId = () => crypto.randomUUID();
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function url(value: string, pattern = false) {
  if (!value) return "";
  try {
    const u = new URL(pattern ? value.replaceAll("{tracking}", "123") : value);
    check(
      ["http:", "https:"].includes(u.protocol),
      "Use a valid website address",
    );
    return value;
  } catch {
    throw new Error("Use a valid website address");
  }
}
function lines(s: StoreState, input: unknown): Line[] {
  const list = z
    .array(lineSchema)
    .min(1, "Add at least one product")
    .max(200)
    .parse(input);
  check(
    new Set(list.map((l) => l.productId)).size === list.length,
    "Each product can appear only once",
  );
  return list.map((l) => {
    const p = s.products.find((p) => p.id === l.productId && p.active);
    check(p, "Product is unavailable");
    return { ...l, price: round(l.price), name: p.name };
  });
}
function reserveCheck(s: StoreState, items: Line[]) {
  for (const l of items)
    check(
      stock(s, l.productId).available >= l.qty,
      `Insufficient stock: ${l.name}`,
    );
}
function person(s: StoreState, c: Person) {
  if (c.id) {
    check(
      s.customers.some((x) => x.id === c.id),
      "Customer not found",
    );
    return c;
  }
  const existing = s.customers.find((p) => p.phone && p.phone === c.phone);
  if (existing) return { ...c, id: existing.id };
  c.id = newId();
  s.customers.push(c);
  return c;
}
function total(items: Line[], discount: number, shipping: number, charge = 0) {
  const sub = round(items.reduce((a, l) => a + l.qty * l.price, 0));
  check(discount <= sub, "Discount cannot exceed the subtotal");
  const sum = round(sub - discount + shipping + charge);
  check(
    Number.isSafeInteger(Math.round(sum * 100)) && sum <= 1_000_000_000_000,
    "Order total exceeds the supported limit",
  );
  return sum;
}
export function applyCommand(
  previous: StoreState,
  action: string,
  input: any,
  requestId: string,
  now = new Date().toISOString(),
): StoreState {
  if (previous.processed.includes(requestId)) return previous;
  const s = structuredClone(previous);
  switch (action) {
    case "product": {
      const p = z
        .object({
          id: txt,
          name: z.string().trim().min(1).max(160),
          nameUr: txt,
          namePa: txt,
          sku: z.string().trim().min(1).max(60),
          barcode: txt,
          category: z.string().trim().min(1).max(60),
          price: amount,
          cost: amount,
          openingStock: count,
          reorderLevel: count,
          active: z.boolean(),
        })
        .parse(input);
      const current = s.products.find((x) => x.id === p.id);
      check(
        !s.products.some(
          (x) =>
            x.id !== p.id &&
            (x.sku.toLowerCase() === p.sku.toLowerCase() ||
              (p.barcode && x.barcode === p.barcode)),
        ),
        "SKU or barcode already exists",
      );
      if (current)
        Object.assign(current, { ...p, openingStock: current.openingStock });
      else s.products.push({ ...p, id: newId() });
      break;
    }
    case "person": {
      check(
        ["customers", "suppliers"].includes(input.kind),
        "Invalid account type",
      );
      const p = personSchema.parse(input.person);
      const list = input.kind === "customers" ? s.customers : s.suppliers;
      const current = list.find((x) => x.id === p.id);
      if (current) Object.assign(current, p);
      else list.push({ ...p, id: newId() });
      break;
    }
    case "courier": {
      const p = z
        .object({
          id: txt,
          name: z.string().trim().min(1).max(120),
          phone: txt,
          website: txt,
          pattern: txt,
          contact: txt,
        })
        .parse(input);
      url(p.website);
      url(p.pattern, true);
      check(
        !p.pattern || p.pattern.includes("{tracking}"),
        "Tracking pattern must contain {tracking}",
      );
      const c = s.couriers.find((c) => c.id === p.id);
      if (c) Object.assign(c, p);
      else s.couriers.push({ ...p, id: newId() });
      break;
    }
    case "createOrder": {
      const p = z
        .object({
          type: z.enum(["city", "outside"]),
          customer: personSchema,
          items: z.unknown(),
          discount: amount,
          shipping: amount,
          charge: amount,
          method: z.enum(METHODS as [string, ...string[]]),
          payment: amount,
          courierId: txt,
          trackingNumber: txt,
          expectedDate: txt,
          instructions: txt,
          notes: txt,
          draft: z.boolean().default(false),
        })
        .parse(input);
      check(p.customer.phone, "Phone number is required");
      check(p.customer.address, "Delivery address is required");
      if (p.type === "outside") {
        check(p.customer.city, "City is required");
        check(p.customer.province, "Province is required");
        check(p.customer.postal, "Postal code is required");
        check(p.customer.whatsapp, "WhatsApp number is required");
      }
      const items = lines(s, p.items);
      if (!p.draft) reserveCheck(s, items);
      check(
        !p.charge || s.settings.extraChargeName,
        "Configure a business charge first",
      );
      const totalAmount = total(items, p.discount, p.shipping, p.charge);
      check(p.payment <= totalAmount, "Payment cannot exceed the order total");
      check(
        !p.draft || p.payment === 0,
        "Save a new order without collecting payment",
      );
      check(
        !p.courierId || s.couriers.some((c) => c.id === p.courierId),
        "Courier not found",
      );
      const customer = person(s, p.customer);
      s.sequence++;
      const num = `${now.slice(0, 4)}-${String(s.sequence).padStart(5, "0")}`;
      const status = p.draft ? "New" : "Confirmed";
      const trackingStatus =
        p.type === "outside"
          ? p.draft
            ? "Order Received"
            : "Order Confirmed"
          : "";
      const order: Order = {
        id: "ORD-" + num,
        invoice: "INV-" + num,
        date: now,
        type: p.type,
        customerId: customer.id,
        customer,
        items,
        discount: round(p.discount),
        shipping: round(p.shipping),
        charge: round(p.charge),
        chargeName: s.settings.extraChargeName,
        total: totalAmount,
        payments: p.payment
          ? [
              {
                id: newId(),
                date: now,
                amount: round(p.payment),
                method: p.method,
                note: "",
              },
            ]
          : [],
        method: p.method,
        status,
        trackingStatus,
        courierId: p.courierId,
        trackingNumber: p.trackingNumber,
        shipmentDate: "",
        expectedDate: p.expectedDate,
        trackingUrl: "",
        deliveryNotes: "",
        instructions: p.instructions,
        notes: p.notes,
        history: [
          {
            status: p.type === "outside" ? "Order Received" : "New",
            date: now,
            note: "",
          },
          ...(!p.draft
            ? [{ status: trackingStatus || status, date: now, note: "" }]
            : []),
        ],
        stage: p.draft
          ? "none"
          : s.settings.stockDeduction === "confirm"
            ? "sold"
            : "reserved",
        restocked: [],
        returnReceived: false,
      };
      s.orders.unshift(order);
      break;
    }
    case "orderStatus": {
      const p = z.object({ id: txt, status: txt, note: txt }).parse(input);
      const o = s.orders.find((x) => x.id === p.id);
      check(o, "Order not found");
      const allowed = o.type === "outside" ? TRACK_STATUSES : CITY_STATUSES;
      check(allowed.includes(p.status), "Invalid status");
      const before = o.type === "outside" ? o.trackingStatus : o.status;
      if (before === p.status) {
        if (p.note)
          o.history.push({ status: p.status, date: now, note: p.note });
        break;
      }
      check(
        !["Cancelled", "Returned"].includes(o.status),
        "This order is already closed",
      );
      check(
        o.status !== "Delivered" || p.status === "Returned",
        "Delivered orders can only be returned",
      );
      const dispatchStatuses =
        o.type === "outside"
          ? [
              "Dispatched",
              "In Transit",
              "Arrived at Destination City",
              "Out for Delivery",
              "Delivered",
              "Delivery Attempted",
            ]
          : ["Out for Delivery", "Delivered"];
      const wasDispatched =
        !!o.shipmentDate ||
        o.history.some((e) => dispatchStatuses.includes(e.status));
      if (p.status === "Cancelled")
        check(!wasDispatched, "Dispatched orders must use the return process");
      if (p.status === "Returned")
        check(wasDispatched, "Only dispatched orders can be returned");
      if (wasDispatched)
        check(
          dispatchStatuses.includes(p.status) || p.status === "Returned",
          "A dispatched order cannot move back to preparation",
        );
      if (p.status !== "Cancelled" && p.status !== "Returned") {
        const main =
          o.type === "outside"
            ? TRACK_STATUSES.slice(0, 8)
            : CITY_STATUSES.slice(0, 6);
        if (
          before !== "Delivery Attempted" &&
          p.status !== "Delivery Attempted"
        )
          check(
            main.indexOf(p.status) >= main.indexOf(before),
            "Order status cannot move backwards",
          );
        if (o.stage === "none") {
          reserveCheck(s, o.items);
          o.stage =
            s.settings.stockDeduction === "confirm" ? "sold" : "reserved";
        }
        if (dispatchStatuses.includes(p.status)) {
          o.stage = "sold";
          o.shipmentDate = o.shipmentDate || now.slice(0, 10);
          if (o.type === "outside") {
            check(o.courierId, "Select a courier before dispatch");
            check(o.trackingNumber, "Enter a tracking number before dispatch");
          }
        }
      } else if (p.status === "Cancelled") {
        o.stage = "none";
      }
      if (o.type === "outside") {
        o.trackingStatus = p.status;
        o.status =
          p.status === "Order Received"
            ? "New"
            : p.status === "Order Confirmed"
              ? "Confirmed"
              : p.status === "Packed"
                ? "Preparing"
                : [
                      "Dispatched",
                      "In Transit",
                      "Arrived at Destination City",
                      "Delivery Attempted",
                    ].includes(p.status)
                  ? "Out for Delivery"
                  : p.status;
      } else o.status = p.status;
      o.history.push({ status: p.status, date: now, note: p.note });
      break;
    }
    case "shipment": {
      const p = z
        .object({
          id: txt,
          courierId: txt,
          trackingNumber: txt,
          shipmentDate: txt,
          expectedDate: txt,
          trackingUrl: txt,
          deliveryNotes: txt,
        })
        .parse(input);
      const o = s.orders.find((o) => o.id === p.id);
      check(o && o.type === "outside", "Shipment not found");
      check(
        !p.courierId || s.couriers.some((c) => c.id === p.courierId),
        "Courier not found",
      );
      url(p.trackingUrl);
      if (p.shipmentDate && p.expectedDate)
        check(
          p.expectedDate >= p.shipmentDate,
          "Expected delivery must follow shipment date",
        );
      const current = o.trackingStatus;
      check(
        ![
          "Dispatched",
          "In Transit",
          "Arrived at Destination City",
          "Out for Delivery",
          "Delivered",
          "Delivery Attempted",
          "Returned",
        ].includes(current) || !!(p.trackingNumber && p.courierId),
        "Dispatched orders need a courier and tracking number",
      );
      const hasDispatched = o.history.some((h) =>
        [
          "Dispatched",
          "In Transit",
          "Out for Delivery",
          "Delivered",
          "Delivery Attempted",
        ].includes(h.status),
      );
      check(
        !p.shipmentDate || hasDispatched,
        "Set status to Dispatched before entering a shipment date",
      );
      Object.assign(o, p, { shipmentDate: p.shipmentDate || o.shipmentDate });
      o.history.push({
        status: current,
        date: now,
        note: p.deliveryNotes || "Shipment details updated",
      });
      break;
    }
    case "payment": {
      const p = z
        .object({
          id: txt,
          kind: z.enum(["order", "purchase"]),
          amount: amount.min(0.01),
          method: z.enum(METHODS as [string, ...string[]]),
          note: txt,
          refund: z.boolean().default(false),
        })
        .parse(input);
      const x =
        p.kind === "order"
          ? s.orders.find((o) => o.id === p.id)
          : s.purchases.find((o) => o.id === p.id);
      check(x, "Account entry not found");
      const amountPaid = paid(x);
      if (p.refund) {
        check(p.amount <= refundDue(x), "Refund exceeds the amount owed");
      } else {
        check(
          p.kind !== "order" || !reversed(x as Order),
          "This order is closed",
        );
        check(
          p.amount <= round(x.total - amountPaid),
          "Payment exceeds the balance",
        );
      }
      x.payments.push({
        id: newId(),
        date: now,
        amount: round(p.refund ? -p.amount : p.amount),
        method: p.method,
        note: p.note,
      });
      break;
    }
    case "returnStock": {
      const p = z
        .object({
          id: txt,
          items: z.array(z.object({ productId: txt, qty: count })),
          note: txt,
        })
        .parse(input);
      const o = s.orders.find((o) => o.id === p.id);
      check(o?.status === "Returned", "Mark the order as returned first");
      check(!o.returnReceived, "This return has already been received");
      check(
        new Set(p.items.map((i) => i.productId)).size === p.items.length,
        "Duplicate return item",
      );
      for (const i of p.items) {
        const original = o.items.find((x) => x.productId === i.productId);
        check(
          original && i.qty <= original.qty,
          "Returned quantity exceeds the order",
        );
      }
      o.restocked = p.items.filter((i) => i.qty > 0);
      o.returnReceived = true;
      o.history.push({
        status: "Returned",
        date: now,
        note: `Return received: ${o.restocked.reduce((a, i) => a + i.qty, 0)} sellable units. ${p.note}`,
      });
      break;
    }
    case "purchase": {
      const p = z
        .object({
          supplierId: txt,
          items: z.unknown(),
          discount: amount,
          shipping: amount,
          payment: amount,
          method: z.enum(METHODS as [string, ...string[]]),
          notes: txt,
        })
        .parse(input);
      check(
        s.suppliers.some((s) => s.id === p.supplierId),
        "Select a supplier",
      );
      const items = lines(s, p.items);
      const sum = total(items, p.discount, p.shipping);
      check(p.payment <= sum, "Payment exceeds the purchase total");
      s.purchaseSequence++;
      s.purchases.unshift({
        id: `PUR-${now.slice(0, 4)}-${String(s.purchaseSequence).padStart(5, "0")}`,
        date: now,
        supplierId: p.supplierId,
        items,
        discount: p.discount,
        shipping: p.shipping,
        total: sum,
        payments: p.payment
          ? [
              {
                id: newId(),
                date: now,
                amount: p.payment,
                method: p.method,
                note: "",
              },
            ]
          : [],
        notes: p.notes,
      });
      break;
    }
    case "settings": {
      const p = z
        .object({
          storeName: z.string().trim().min(1).max(120),
          phone: txt,
          address: txt,
          city: z.string().trim().min(1).max(120),
          stockDeduction: z.enum(["dispatch", "confirm"]),
          deliveryCharge: amount,
          shippingCharge: amount,
          extraChargeName: txt,
          extraCharge: amount,
          receiptNote: txt,
        })
        .parse(input);
      check(
        !p.extraCharge || p.extraChargeName,
        "Name the configured business charge",
      );
      s.settings = p;
      break;
    }
    case "clearDemo": {
      check(s.demo, "Sample records are already cleared");
      const clean = initialState();
      clean.settings = s.settings;
      Object.assign(s, clean);
      break;
    }
    default:
      if (!applyEdit(s, action, input, now)) throw new Error("Unknown action");
  }
  if (action !== "clearDemo") recordChanges(previous, s, action, input, now);
  s.processed = [...s.processed, requestId].slice(-500);
  return s;
}
