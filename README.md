# Karobar POS

A password-protected PKR point-of-sale and delivery workspace with English, Urdu and Punjabi interfaces.

## Workflows

- City and out-of-city orders, inline customer details, barcode and QR scanning.
- Inventory reservations, dispatch, cancellation and inspected returns.
- Sales, purchases, customer and supplier accounts, partial payments and refunds.
- Multiple couriers, manual shipment updates, configurable tracking links and timelines.
- Date-filtered reports, CSV, Excel XML, PDF through the print dialog, and printable receipts.

## Editing your store

Open an order and choose **Edit order** to update the customer, delivery address, items, quantities, descriptions, prices, discount, charges, date, or notes. The order type can change before dispatch. Shipment details and delivery status have their own controls in the same order. Receipts and reports use the saved values.

Open a purchase and choose **Edit purchase** to correct the supplier, items, prices, quantities, date, discount, charges, or notes. Use the pencil beside a payment to correct an amount, date, method, or note; **Void this entry** retains the old values in change history. Corrections update records only; they do not transfer money.

Choose **Adjust stock** on a product to record a new physical count and a reason. Confirmed orders keep their stock reservations; edits cannot consume stock already sold or reserved. Received returns can be corrected if the returned units have not already been used. Customer refunds and supplier credits remain visible until the actual refund is recorded.

Corrections to orders, purchases, payments, returns, and stock require a reason. Order and purchase editors reject stale saves when another action has changed the record. Previous values remain under **Change history**, both on the record and in Settings. IDs and transaction history are preserved.

All source is editable TypeScript, TSX, and CSS. `app/` contains the screens; `app/globals.css` contains styling; `lib/pos/i18n.ts` contains Urdu/Punjabi translations; `lib/pos/model.ts`, `commands.ts`, and `editing.ts` contain the business rules. No visual builder or proprietary editor is required.

## Data and access

This version runs on Next.js and Vercel with PostgreSQL. The business ledger is stored durably using revision checks and idempotency keys. The server validates every operation and rejects overselling. Only language and sidebar preferences use browser storage.

The page and every business API require an authenticated session. Sign-in uses a strong store password, a signed 12-hour HttpOnly session cookie, and a database-backed attempt limit. Rotating either access environment variable invalidates all sessions. Credentials and live records are never committed to Git.

A new database starts empty. Set POS_DEMO_DATA=true only when sample records are wanted. Existing Sites records are not automatically transferred to PostgreSQL. The existing Sites deployment is separate and continues to hold its own records; do not use both stores for the same live inventory. Export and migrate the ledger explicitly before switching an active business.

Courier status updates are manual until an external integration is implemented. Camera scanning needs HTTPS and browser camera permission. A USB scanner can enter a barcode or QR value into product search.

## Setup

1. Install Node.js 22.13 or newer and the pnpm version in package.json.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local` and set DATABASE_URL to the provider's pooled PostgreSQL URL. Require TLS for hosted databases.
4. Run `pnpm auth:generate`. This saves strong access credentials privately to `.env.local` without printing them. Store the password in your password manager.
5. Run `pnpm db:migrate`, then `pnpm dev`.

The environment must contain DATABASE_URL, POS_ACCESS_PASSWORD (at least 24 characters), and POS_SESSION_SECRET (at least 32 characters). Missing setup leaves business data inaccessible. No database connection is needed for the production build.

## GitHub and Vercel

Target repository owner: `samillah602-debug`. Verify this identity before creating or pushing a repository.

Import the GitHub repository into Vercel. The included vercel.json selects Next.js and the normal pnpm build. Connect a PostgreSQL database, such as a Neon resource from Vercel's storage marketplace, and add the environment variables to the appropriate deployment environments. Keep preview data in a separate database from production. Run the migration against the selected database before using the deployment.

`pnpm typecheck`, `pnpm test`, and `pnpm build` validate the source. The SQL tests use an isolated PostgreSQL-compatible PGlite database and do not contact a live business database.

This source was adapted from the original Sites implementation. Legacy Cloudflare configuration and drizzle/ files are retained for reference; Vercel uses db/postgres.sql and does not run those legacy migrations.

Provider documentation: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Vercel storage integrations](https://vercel.com/docs/storage), and [node-postgres parameterized queries](https://node-postgres.com/features/queries).
