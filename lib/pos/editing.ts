import { z } from "zod";
import {
  METHODS,
  blankPerson,
  paid,
  round,
  stock,
  type StoreState,
  type Line,
  type Order,
} from "./model";

const text = z.string().trim().max(500).default("");
const amount = z.coerce.number().finite().min(0).max(1_000_000_000);
const quantity = z.coerce.number().int().min(0).max(1_000_000);
const reason = z
  .string()
  .trim()
  .min(1, "Enter a reason for this correction")
  .max(500);
const date = z.string().datetime({ offset: true });
const reference = z.object({
  id: z.string().min(1),
  expectedVersion: z.number().int().min(0),
  reason,
});
const person = z.object({
  id: text,
  name: z.string().trim().min(1).max(120),
  phone: text,
  whatsapp: text,
  address: text,
  area: text,
  city: text,
  province: text,
  postal: text,
  notes: text,
});
const itemList = z
  .array(
    z.object({
      productId: z.string().min(1),
      name: z.string().trim().min(1).max(160),
      qty: quantity.min(1),
      price: amount,
    }),
  )
  .min(1, "Add at least one product")
  .max(200);

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function version(entry: { version?: number }, expected: number) {
  check(
    (entry.version || 0) === expected,
    "This record changed. Close the editor and reopen it before saving.",
  );
}

function editedLines(
  state: StoreState,
  value: z.infer<typeof itemList>,
  original: Line[],
) {
  check(
    new Set(value.map((item) => item.productId)).size === value.length,
    "Each product can appear only once",
  );
  return value.map((item) => {
    const product = state.products.find(
      (product) => product.id === item.productId,
    );
    check(
      product &&
        (product.active ||
          original.some((line) => line.productId === product.id)),
      "Product is unavailable",
    );
    return { ...item, price: round(item.price) };
  });
}

function calculatedTotal(
  items: Line[],
  discount: number,
  shipping: number,
  charge = 0,
) {
  const subtotal = round(
    items.reduce((sum, item) => sum + item.qty * item.price, 0),
  );
  check(discount <= subtotal, "Discount cannot exceed the subtotal");
  const result = round(subtotal - discount + shipping + charge);
  check(
    Number.isSafeInteger(Math.round(result * 100)) &&
      result <= 1_000_000_000_000,
    "Order total exceeds the supported limit",
  );
  return result;
}

function inventoryCheck(state: StoreState, productIds: string[]) {
  for (const id of new Set(productIds)) {
    check(
      stock(state, id).available >= 0,
      "This correction would use stock that is already sold or reserved.",
    );
  }
}

function orderTypeStatus(order: Order, type: Order["type"]) {
  if (order.type === type) return;
  check(
    !order.shipmentDate && !["Delivered", "Returned"].includes(order.status),
    "Order type can only change before dispatch.",
  );
  if (type === "outside") {
    order.trackingStatus =
      (
        {
          New: "Order Received",
          Confirmed: "Order Confirmed",
          Preparing: "Packed",
          Ready: "Packed",
          Cancelled: "Cancelled",
        } as Record<string, string>
      )[order.status] || "Order Confirmed";
  } else {
    order.trackingStatus = "";
    order.courierId = "";
    order.trackingNumber = "";
    order.trackingUrl = "";
    order.expectedDate = "";
  }
  order.type = type;
}

/** Corrections run inside the same optimistic transaction as normal orders. */
export function applyEdit(
  state: StoreState,
  action: string,
  input: unknown,
  now: string,
): boolean {
  if (action === "editOrder") {
    const value = reference
      .extend({
        type: z.enum(["city", "outside"]),
        date,
        customer: person,
        items: itemList,
        discount: amount,
        shipping: amount,
        charge: amount,
        chargeName: text,
        method: z.enum(METHODS as [string, ...string[]]),
        instructions: text,
        notes: text,
      })
      .parse(input);
    const order = state.orders.find((order) => order.id === value.id);
    check(order, "Order not found");
    version(order, value.expectedVersion);
    check(value.customer.phone, "Phone number is required");
    check(value.customer.address, "Delivery address is required");
    if (value.type === "outside") {
      check(
        value.customer.city &&
          value.customer.province &&
          value.customer.postal &&
          value.customer.whatsapp,
        "Complete the out-of-city delivery details",
      );
    }
    const items = editedLines(state, value.items, order.items);
    check(
      !value.charge || value.chargeName,
      "Name the configured business charge",
    );
    const total = calculatedTotal(
      items,
      value.discount,
      value.shipping,
      value.charge,
    );
    for (const returned of order.restocked) {
      check(
        (items.find((item) => item.productId === returned.productId)?.qty ||
          0) >= returned.qty,
        "Correct the received return before reducing these order items.",
      );
    }
    const touched = [...order.items, ...items].map((item) => item.productId);
    orderTypeStatus(order, value.type);
    let customerId = value.customer.id;
    if (customerId)
      check(
        state.customers.some((customer) => customer.id === customerId),
        "Customer not found",
      );
    else {
      customerId = crypto.randomUUID();
      state.customers.push({
        ...blankPerson(),
        ...value.customer,
        id: customerId,
      });
    }
    // Delivery details are a snapshot for this order; editing them never rewrites other orders.
    Object.assign(order, {
      date: value.date,
      customerId,
      customer: { ...value.customer, id: customerId },
      items,
      discount: round(value.discount),
      shipping: round(value.shipping),
      charge: round(value.charge),
      chargeName: value.chargeName,
      total,
      method: value.method,
      instructions: value.instructions,
      notes: value.notes,
    });
    inventoryCheck(state, touched);
    order.history.push({
      status: order.trackingStatus || order.status,
      date: now,
      note: value.reason,
    });
    return true;
  }

  if (action === "editPurchase") {
    const value = reference
      .extend({
        date,
        supplierId: z.string().min(1),
        items: itemList,
        discount: amount,
        shipping: amount,
        notes: text,
      })
      .parse(input);
    const purchase = state.purchases.find(
      (purchase) => purchase.id === value.id,
    );
    check(purchase, "Purchase not found");
    version(purchase, value.expectedVersion);
    check(
      state.suppliers.some((supplier) => supplier.id === value.supplierId),
      "Select a supplier",
    );
    const items = editedLines(state, value.items, purchase.items);
    const touched = [...purchase.items, ...items].map((item) => item.productId);
    Object.assign(purchase, {
      date: value.date,
      supplierId: value.supplierId,
      items,
      discount: round(value.discount),
      shipping: round(value.shipping),
      notes: value.notes,
      total: calculatedTotal(items, value.discount, value.shipping),
    });
    inventoryCheck(state, touched);
    return true;
  }

  if (action === "editPayment") {
    const value = reference
      .extend({
        kind: z.enum(["order", "purchase"]),
        paymentId: z.string().min(1),
        amount: amount.min(0.01),
        date,
        method: z.enum(METHODS as [string, ...string[]]),
        note: text,
        void: z.boolean().default(false),
      })
      .parse(input);
    const entry =
      value.kind === "order"
        ? state.orders.find((order) => order.id === value.id)
        : state.purchases.find((purchase) => purchase.id === value.id);
    check(entry, "Account entry not found");
    version(entry, value.expectedVersion);
    const payment = entry.payments.find(
      (payment) => payment.id === value.paymentId,
    );
    check(payment && !payment.voided, "Payment not found");
    const nextAmount = value.void
      ? 0
      : round(value.amount) * (payment.amount < 0 ? -1 : 1);
    check(
      round(paid(entry) - payment.amount + nextAmount) >= 0,
      "Correct the related refund before reducing this payment.",
    );
    Object.assign(payment, {
      amount: nextAmount,
      date: value.date,
      method: value.method,
      note: value.note,
      voided: value.void,
    });
    return true;
  }

  if (action === "adjustStock") {
    const value = z
      .object({
        productId: z.string().min(1),
        expectedOnHand: quantity,
        onHand: quantity,
        reason,
      })
      .parse(input);
    const product = state.products.find(
      (product) => product.id === value.productId,
    );
    check(product, "Product is unavailable");
    const current = stock(state, product.id);
    check(
      current.onHand === value.expectedOnHand,
      "Stock changed. Close the editor and recount before saving.",
    );
    check(
      value.onHand >= current.reserved,
      "Stock on hand cannot be below reserved stock.",
    );
    const delta = value.onHand - current.onHand;
    if (delta) {
      (state.stockAdjustments ||= []).push({
        id: crypto.randomUUID(),
        productId: product.id,
        date: now,
        delta,
        reason: value.reason,
      });
      (state.changes ||= []).unshift({
        id: crypto.randomUUID(),
        date: now,
        kind: "products",
        recordId: product.id,
        action: "Stock corrected",
        reason: value.reason,
        changes: [
          { field: "onHand", before: current.onHand, after: value.onHand },
        ],
      });
    }
    return true;
  }

  if (action === "editReturn") {
    const value = reference
      .extend({
        items: z.array(
          z.object({ productId: z.string().min(1), qty: quantity }),
        ),
      })
      .parse(input);
    const order = state.orders.find((order) => order.id === value.id);
    check(
      order?.status === "Returned" && order.returnReceived,
      "Return not found",
    );
    version(order, value.expectedVersion);
    check(
      new Set(value.items.map((item) => item.productId)).size ===
        value.items.length,
      "Duplicate return item",
    );
    for (const item of value.items) {
      const original = order.items.find(
        (line) => line.productId === item.productId,
      );
      check(
        original && item.qty <= original.qty,
        "Returned quantity exceeds the order",
      );
    }
    const touched = [...order.restocked, ...value.items].map(
      (item) => item.productId,
    );
    order.restocked = value.items.filter((item) => item.qty > 0);
    inventoryCheck(state, touched);
    order.history.push({ status: "Returned", date: now, note: value.reason });
    return true;
  }
  return false;
}

const actionNames: Record<string, string> = {
  product: "Product updated",
  person: "Contact updated",
  courier: "Courier updated",
  settings: "Settings updated",
  editOrder: "Order corrected",
  editPurchase: "Purchase corrected",
  editPayment: "Payment corrected",
  editReturn: "Return corrected",
  orderStatus: "Status updated",
  shipment: "Shipment updated",
  payment: "Payment recorded",
  returnStock: "Return received",
};

/** Keep prior values, including payment amounts, in a durable correction journal. */
export function recordChanges(
  previous: StoreState,
  state: StoreState,
  action: string,
  input: { reason?: string; note?: string },
  now: string,
) {
  for (const kind of [
    "products",
    "customers",
    "suppliers",
    "couriers",
    "orders",
    "purchases",
    "settings",
  ] as const) {
    const beforeList =
      kind === "settings"
        ? [{ ...previous.settings, id: "settings" }]
        : previous[kind];
    const afterList = kind === "settings" ? [state.settings] : state[kind];
    for (const entry of afterList) {
      const recordId = "id" in entry ? entry.id : "settings";
      const before = beforeList.find((old) => old.id === recordId);
      if (!before) {
        entry.version = 1;
        continue;
      }
      entry.version = before.version || 0;
      const changes = Object.entries(entry)
        .filter(([field]) => !["id", "version", "history"].includes(field))
        .filter(
          ([field, value]) =>
            JSON.stringify(value) !==
            JSON.stringify((before as Record<string, unknown>)[field]),
        )
        .map(([field, value]) => ({
          field,
          before: (before as Record<string, unknown>)[field] ?? null,
          after: value,
        }));
      if (!changes.length) {
        if (
          "history" in entry &&
          "history" in before &&
          JSON.stringify(entry.history) !== JSON.stringify(before.history)
        ) {
          entry.version = (before.version || 0) + 1;
        }
        continue;
      }
      entry.version = (before.version || 0) + 1;
      (state.changes ||= []).unshift({
        id: crypto.randomUUID(),
        date: now,
        kind,
        recordId,
        action: actionNames[action] || "Details updated",
        reason: input.reason || input.note || "",
        changes,
      });
    }
  }
}
