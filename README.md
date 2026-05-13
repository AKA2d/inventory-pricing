# Inventory Pricing

Production-oriented inventory pricing application built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Docker, and Odoo 18 JSON-RPC.

## Features

- Username/password authentication with `admin` and `viewer` roles
- Protected inventory workspace with desktop table and mobile card layouts
- Keyword-based product search against Odoo by product name and barcode only
- Search runs only on Enter or Search button click
- Hybrid cache strategy:
  searched and recently accessed products are cached locally, stale entries can be refreshed, and cached matches are used when Odoo is unavailable
- Inline AED and IRR price editing with explicit Save, optimistic updates, loading states, and toast feedback
- Full audit trail for all price changes
- Odoo service layer with reusable JSON-RPC client, retries, timeouts, structured errors, and request logging
- Dockerized app and PostgreSQL services for self-hosted deployment

## Stack

- Next.js `16.2.6` with App Router
- React `19`
- Tailwind CSS `4`
- PostgreSQL
- Prisma ORM
- Odoo 18 JSON-RPC
- Sonner for toast notifications
- Pino for structured logging
- Zod for validation

## Environment

Copy `.env.example` to `.env` for local development if you want to override the checked-in defaults used by Docker Compose.

Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: at least 32 random characters
- `ODOO_URL`: base URL of the Odoo instance
- `ODOO_DB`: Odoo database name
- `ODOO_USERNAME`: Odoo API user
- `ODOO_API_KEY`: Odoo API key
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`: seeded initial admin credentials

## Local development

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker

The full stack runs with:

```bash
docker compose up --build
```

The app is exposed on `http://localhost:3000`.
`docker-compose.yml` uses `.env.example` by default so the stack can boot immediately; replace those values with real Odoo credentials before using the integration in earnest.

## Search behavior

- Input is trimmed and split into tokens
- Extra spaces are ignored
- Tokens are matched with partial `contains/ilike` behavior
- Tokens may appear in any order
- Only `name` and `barcode` are searched
- Odoo is queried first when available, then results are cached locally

Example: searching for `dimm 16gb` matches products containing `dimm`, `16`, and `gb` across name or barcode fields in any order.

## Pricing model

- `uaePriceAed` stores whole AED values as `BIGINT`
- `irPriceIrr` stores whole IRR values as `BIGINT`
- Latest prices live in `RegionalPrice`
- All changes are recorded in `PriceAuditLog`

## Roles

- `ADMIN`: can search and edit prices
- `VIEWER`: can search with read-only access

Users are managed directly in PostgreSQL. There is no user-management UI by design.

## Data model

Prisma models included:

- `User`
- `CachedProduct`
- `RegionalPrice`
- `PriceAuditLog`
- `CacheMetadata`
- `OdooRequestLog`
- `OdooRetryQueue`

## API surface

- `GET /api/products/search?q=...&page=1&pageSize=50`
  Searches by product name/barcode, hydrates cache from Odoo when possible, and falls back to cache when Odoo is unavailable.
- `PATCH /api/prices`
  Accepts batched price updates for admin users and writes audit records.
- `POST /api/jobs/refresh-stale-cache`
  Refreshes stale cached products for admin users.

## Folder structure

```text
prisma/
  migrations/
  schema.prisma
  seed.ts
src/
  app/
    api/
    actions/
    login/
  components/
    auth/
    inventory/
    providers/
    ui/
  lib/
    auth/
    config/
    odoo/
    products/
    search/
```

## Operational notes

- The cache is intentionally partial. This app does not mirror the full Odoo catalog.
- Odoo request logs are stored locally for debugging and future monitoring.
- `OdooRetryQueue` and `CacheMetadata` are included to support future background jobs and sync extensions.
- Rate limiting and CSV import/export are left as straightforward extension points rather than partially implemented features.
