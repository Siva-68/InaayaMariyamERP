# HINAYA MARIYAM ERP — REST API Contract

> **Status:** Planned — not yet implemented.
> **Last Updated:** 2026-11-20
>
> Base URL: `/api`
> Content-Type: `application/json`
> Authentication: Session cookie (`HttpOnly`, `Secure`, `SameSite=Strict`)
> Authorization roles: `admin` | `billing_operator` | `accountant`

---

## Conventions

- All `Decimal128` monetary values are serialized as strings in JSON responses (e.g. `"125.50"`).
- Dates are ISO 8601 strings in UTC; timezone conversions happen on the client.
- Pagination: `?page=1&limit=20` on list endpoints.
- Errors: `{ success: false, error: { code, message, details? } }`
- Success: `{ success: true, data: { ... } }`

---

## 1. Health

### `GET /api/health`
No auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "db": "connected",
    "replicaSet": true,
    "timestamp": "2026-11-20T16:30:00.000Z"
  }
}
```

---

## 2. Auth

### `POST /api/auth/login`
Rate-limited: 5 requests / minute / IP.

**Request:**
```json
{ "email": "admin@example.com", "password": "••••••••" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "Owner", "email": "...", "role": "admin" }
  }
}
```
Sets `Set-Cookie: session=...`

**Errors:** `401 INVALID_CREDENTIALS` | `429 RATE_LIMITED`

---

### `POST /api/auth/logout`
Auth required.

**Response 200:** `{ "success": true }`

---

### `GET /api/auth/me`
Auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "...", "email": "...", "role": "...", "isActive": true }
  }
}
```

---

## 3. Users

### `GET /api/users`
Auth: `admin`

**Query:** `?page&limit&isActive`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": [ { "_id":"...", "name":"...", "email":"...", "role":"...", "isActive":true, "createdAt":"..." } ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "pages": 1 }
  }
}
```

---

### `POST /api/users`
Auth: `admin`

**Request:**
```json
{ "name": "Billing Staff", "email": "staff@example.com", "password": "••••••••", "role": "billing_operator" }
```

**Response 201:** New user object (no passwordHash).

---

### `PATCH /api/users/:id`
Auth: `admin`

**Request (partial):**
```json
{ "role": "accountant", "isActive": false }
```

**Response 200:** Updated user object.

---

## 4. Products

### `GET /api/products`
Auth: all roles.

**Query:** `?page&limit&search&category&isActive&lowStock`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "_id": "...",
        "name": "Kaju Burfi 250g",
        "category": "Burfi",
        "sapCode": "KBF-001",
        "barcode": null,
        "packType": "packet",
        "netWeight": "250g",
        "sellingPrice": "150.00",
        "mrp": "160.00",
        "gstRate": null,
        "stock": 48,
        "lowStockThreshold": 10,
        "isActive": true,
        "purchasePrice": "HIDDEN"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 85, "pages": 5 }
  }
}
```

> `purchasePrice` is included only for `admin` and `accountant` roles. `billing_operator` receives `"HIDDEN"`.

---

### `POST /api/products`
Auth: `admin`

**Request:**
```json
{
  "name": "Kaju Burfi 250g",
  "category": "Burfi",
  "sapCode": "KBF-001",
  "packType": "packet",
  "netWeight": "250g",
  "piecesPerPack": 1,
  "unitsPerCarton": 24,
  "purchasePrice": "120.00",
  "sellingPrice": "150.00",
  "mrp": "160.00",
  "gstRate": null,
  "stock": 0,
  "lowStockThreshold": 10
}
```

**Response 201:** Created product object.

---

### `GET /api/products/:id`
Auth: all roles. `purchasePrice` role-gated.

---

### `PATCH /api/products/:id`
Auth: `admin`

**Request (partial):** Any product fields. Price changes automatically create `price_history` record.

**Response 200:** Updated product object.

---

### `DELETE /api/products/:id`
Auth: `admin`

If product has invoice history → `409 CONFLICT` with message: "Product has billing history. Use isActive: false to deactivate instead."

If no history → hard delete.

---

### `GET /api/products/:id/price-history`
Auth: `admin | accountant`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "history": [
      { "_id":"...", "field":"sellingPrice", "previousValue":"140.00", "newValue":"150.00", "changedBy":{"name":"Owner"}, "changedAt":"..." }
    ]
  }
}
```

---

## 5. Inventory

### `POST /api/inventory/stock-in`
Auth: `admin`

**Request:**
```json
{
  "productId": "...",
  "purchaseUnit": "carton",
  "purchaseQty": 2,
  "conversionFactor": 24,
  "purchaseCost": "2880.00",
  "purchaseDate": "2026-11-20",
  "notes": "Morning delivery"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "purchaseEntry": { "..." },
    "stockMovement": { "delta": 48, "stockAfter": 96 }
  }
}
```

---

### `POST /api/inventory/adjust`
Auth: `admin`

**Request:**
```json
{
  "productId": "...",
  "delta": -3,
  "reason": "Damaged items disposed"
}
```

**Response 201:** `{ stockMovement: { ... } }`

---

### `GET /api/inventory/movements/:productId`
Auth: `admin | accountant`

**Query:** `?page&limit&from&to&movementType`

---

## 6. Invoices

### `POST /api/invoices`
Auth: `admin | billing_operator`

**Request:**
```json
{
  "idempotencyKey": "uuid-v4-here",
  "customerName": "Mohammed Ali",
  "customerMobile": "9876543210",
  "lines": [
    { "productId": "...", "quantity": 2, "sellingPrice": "150.00" }
  ],
  "payment": {
    "method": "split",
    "cashAmount": "100.00",
    "upiAmount": "200.00",
    "upiReference": "UPI123456"
  }
}
```

**Server-side actions (atomic transaction):**
1. Validate idempotency key
2. Revalidate prices and stock
3. Deduct stock atomically
4. Allocate invoice number
5. Create invoice (finalized)
6. Create payment record
7. Create stock movements
8. Create audit log
9. Commit

**Response 201:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "...",
    "invoiceNumber": "HM/2026/000042",
    "grandTotal": "300.00",
    "amountPaid": "300.00",
    "outstandingAmount": "0.00"
  }
}
```

**Errors:**
- `409 DUPLICATE_INVOICE` — idempotency key already used
- `422 INSUFFICIENT_STOCK` — `{ productId, productName, available, requested }`
- `422 GST_NOT_CONFIGURED` — product has `gstRate: null`
- `422 PRICE_CHANGED` — server price differs from client submission

---

### `GET /api/invoices`
Auth: all roles.

**Query:** `?page&limit&search&from&to&status&paymentStatus`

`search` matches `invoiceNumber`, `customerName`, `customerMobile`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "...",
        "invoiceNumber": "HM/2026/000042",
        "customerName": "Mohammed Ali",
        "customerMobile": "9876543210",
        "grandTotal": "300.00",
        "amountPaid": "300.00",
        "outstandingAmount": "0.00",
        "status": "finalized",
        "invoicedAt": "2026-11-20T10:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 240, "pages": 12 }
  }
}
```

---

### `GET /api/invoices/:id`
Auth: all roles. Full invoice with line items and payment history.

---

### `GET /api/invoices/:id/pdf`
Auth: all roles.

Returns PDF binary stream. `Content-Type: application/pdf`.

> **Never** re-computes prices from current product data. PDF is derived only from the saved invoice snapshot.

---

### `POST /api/invoices/:id/payments`
Auth: `admin | billing_operator`

Records an **additional** payment against outstanding balance. Does NOT modify the invoice document.

**Request:**
```json
{
  "method": "cash",
  "cashAmount": "150.00",
  "upiAmount": "0.00"
}
```

**Response 201:** New payment record. Updates `invoice.amountPaid` and `invoice.outstandingAmount` via `$inc` (invoice-level denormalized fields only; embedded line data unchanged).

---

> **No `PUT`, `PATCH`, or `DELETE` on finalized invoices.**

---

## 7. Reports & Dashboard

### `GET /api/reports/summary`
Auth: `admin | accountant` (gross profit fields); `billing_operator` sees sales/count only.

**Query:** `?period=today|week|month|custom&from&to`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": "today",
    "totalSales": "15420.00",
    "invoiceCount": 38,
    "cashCollected": "9200.00",
    "upiCollected": "5120.00",
    "outstanding": "1100.00",
    "cgstCollected": "420.00",
    "sgstCollected": "420.00",
    "estimatedGrossProfit": "3200.00",
    "grossProfitNote": "Estimated based on purchase cost at time of sale. Not net profit."
  }
}
```

---

### `GET /api/reports/product-sales`
Auth: `admin | accountant`

**Query:** `?from&to&limit=10`

**Response 200:** Top-N products by quantity sold and revenue.

---

### `GET /api/reports/inventory`
Auth: `admin | accountant`

Returns full active-product inventory with stock levels and low-stock flags.

---

### `GET /api/reports/gst-summary`
Auth: `admin | accountant`

**Query:** `?from&to`

Returns CGST/SGST totals grouped by GST rate.

---

### `GET /api/reports/export`
Auth: `admin | accountant`

**Query:** `?format=excel|pdf&type=invoices|product-sales|inventory&from&to`

Returns file download. `Content-Disposition: attachment`.

---

## 8. Daily Reports

### `GET /api/daily-reports`
Auth: `admin`

Lists generated report metadata.

---

### `POST /api/daily-reports/generate`
Auth: `admin`

Triggers manual report generation for a given date.

**Request:** `{ "reportDate": "2026-11-20" }`

**Response 202:** `{ "reportId": "...", "status": "generating" }`

---

### `GET /api/daily-reports/:id/download`
Auth: `admin`

Streams the generated PDF.

---

## 9. Settings

### `GET /api/settings/:namespace`
Auth: `admin`

---

### `PATCH /api/settings/:namespace`
Auth: `admin`

**Request (business namespace):**
```json
{
  "address": "123 Main Street, City",
  "phone": "+91 98765 43210",
  "gstin": "29XXXXX1234X1Z5"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Not logged in |
| `FORBIDDEN` | 403 | Logged in but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `DUPLICATE_INVOICE` | 409 | Idempotency key already processed |
| `PRODUCT_HAS_HISTORY` | 409 | Cannot delete product with invoices |
| `INSUFFICIENT_STOCK` | 422 | Not enough stock to complete sale |
| `GST_NOT_CONFIGURED` | 422 | Product gstRate is null |
| `PRICE_CHANGED` | 422 | Server price differs from client |
| `VALIDATION_ERROR` | 422 | Zod schema failure (details array) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no details in production) |
| `REPLICA_SET_REQUIRED` | 503 | MongoDB standalone — transactions unavailable |
