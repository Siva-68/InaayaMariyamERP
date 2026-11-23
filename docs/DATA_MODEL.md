# HINAYA MARIYAM ERP — MongoDB Data Model

> **Status:** Planned — not yet implemented.
> **Last Updated:** 2026-11-20

---

## Design Principles

1. **Invoice immutability:** All invoice line data is embedded as a snapshot. Later product/price changes do not alter historical invoices.
2. **Decimal safety:** All monetary fields use `Decimal128`. Never `Number` for prices, taxes, or totals.
3. **Audit trail:** Every significant state change produces an `AuditLog` entry.
4. **Soft deletes:** Products with transaction history are deactivated (`isActive: false`), not deleted.
5. **Transaction boundaries:** Invoice creation, stock deduction, payment, stock movement, and audit log are committed atomically in one MongoDB transaction.

---

## Collections

### 1. `users`

```typescript
{
  _id:          ObjectId,
  name:         String,           // display name
  email:        String,           // unique, lowercase
  passwordHash: String,           // argon2id — NEVER returned in API responses
  role:         'admin' | 'billing_operator' | 'accountant',
  isActive:     Boolean,          // default: true
  createdAt:    Date,
  updatedAt:    Date,
  createdBy:    ObjectId,         // ref: users
}
```

**Indexes:**
- `{ email: 1 }` — unique
- `{ role: 1, isActive: 1 }`

---

### 2. `products`

```typescript
{
  _id:            ObjectId,
  name:           String,         // required, trimmed
  category:       String,         // e.g. "Burfi", "Snacks", "Biscuits"
  sapCode:        String | null,  // from catalogue; nullable
  barcode:        String | null,
  packType:       String,         // e.g. "packet", "jar", "kg"
  netWeight:      String | null,  // e.g. "250g", "1kg"
  piecesPerPack:  Number | null,
  unitsPerCarton: Number | null,  // for carton→unit conversion
  
  // Pricing (Decimal128)
  purchasePrice:  Decimal128,     // visible to admin/accountant only
  sellingPrice:   Decimal128,     // per sellable unit
  mrp:            Decimal128 | null,
  
  // Tax (must be confirmed by accountant before live billing)
  gstRate:        Number | null,  // percentage, e.g. 5, 12, 18 — null = unconfirmed
  
  // Inventory
  stock:          Number,         // in sellable units; integer
  lowStockThreshold: Number,      // alert when stock ≤ this value
  
  // Status
  isActive:       Boolean,
  serialNumber:   String | null,  // from catalogue
  
  // Timestamps
  createdAt:      Date,
  updatedAt:      Date,
  createdBy:      ObjectId,       // ref: users
}
```

**Indexes:**
- `{ name: 1, category: 1 }` — unique (compound)
- `{ sapCode: 1 }` — sparse (sapCode may be null)
- `{ barcode: 1 }` — sparse
- `{ isActive: 1, category: 1 }`
- `{ stock: 1, lowStockThreshold: 1 }` — for low-stock queries

---

### 3. `price_history`

Append-only log of every price change for a product.

```typescript
{
  _id:            ObjectId,
  productId:      ObjectId,       // ref: products
  changedBy:      ObjectId,       // ref: users
  changedAt:      Date,
  field:          'sellingPrice' | 'purchasePrice' | 'mrp',
  previousValue:  Decimal128,
  newValue:       Decimal128,
  reason:         String | null,
}
```

**Indexes:**
- `{ productId: 1, changedAt: -1 }`

---

### 4. `purchase_entries`

Incoming stock records. No supplier master required initially.

```typescript
{
  _id:            ObjectId,
  productId:      ObjectId,       // ref: products
  productName:    String,         // snapshot at time of entry
  purchaseUnit:   String,         // e.g. "carton", "packet", "kg"
  purchaseQty:    Number,         // quantity received in purchase unit
  conversionFactor: Number,       // e.g. 50 (1 carton = 50 packets)
  unitQtyAdded:   Number,         // derived: purchaseQty × conversionFactor
  purchaseCost:   Decimal128,     // per purchase unit (admin/accountant only)
  totalCost:      Decimal128,     // purchaseQty × purchaseCost
  purchaseDate:   Date,
  notes:          String | null,
  recordedBy:     ObjectId,       // ref: users
  createdAt:      Date,
}
```

**Indexes:**
- `{ productId: 1, purchaseDate: -1 }`
- `{ purchaseDate: -1 }`

---

### 5. `stock_movements`

Append-only ledger of every stock change (sale, stock-in, adjustment).

```typescript
{
  _id:          ObjectId,
  productId:    ObjectId,         // ref: products
  productName:  String,           // snapshot
  movementType: 'sale' | 'stock_in' | 'adjustment' | 'opening',
  delta:        Number,           // positive = added, negative = deducted
  stockBefore:  Number,
  stockAfter:   Number,
  referenceType: 'invoice' | 'purchase_entry' | 'manual_adjustment' | null,
  referenceId:  ObjectId | null,  // invoice._id or purchase_entry._id
  reason:       String | null,    // required for manual_adjustment
  performedBy:  ObjectId,         // ref: users
  createdAt:    Date,
}
```

**Indexes:**
- `{ productId: 1, createdAt: -1 }`
- `{ referenceType: 1, referenceId: 1 }`
- `{ createdAt: -1 }` — for daily reports

---

### 6. `invoice_counters`

Single-document counter per invoice series. Used for sequential numbering.

```typescript
{
  _id:        ObjectId,
  seriesKey:  String,         // e.g. "HM/2026" — one doc per year
  lastNumber: Number,         // incremented atomically
  format:     String,         // e.g. "HM/YYYY/######"
  updatedAt:  Date,
}
```

**Indexes:**
- `{ seriesKey: 1 }` — unique

> `findOneAndUpdate({ seriesKey }, { $inc: { lastNumber: 1 } }, { new: true, upsert: true })` inside a transaction allocates the next number.

---

### 7. `invoices`

Immutable after `status = 'finalized'`. All line data is embedded as a snapshot.

```typescript
{
  _id:            ObjectId,
  invoiceNumber:  String,         // e.g. "HM/2026/000001" — unique
  
  // Customer
  customerName:   String,
  customerMobile: String,         // 10-digit, stored as string
  
  // Status
  status:         'draft' | 'finalized',
  
  // Line items (embedded snapshots)
  lines: [
    {
      lineNumber:     Number,
      productId:      ObjectId,   // ref only; snapshot below is authoritative
      
      // Snapshot at time of billing
      productName:    String,
      unit:           String,
      quantity:       Number,
      sellingPrice:   Decimal128,  // per unit at time of sale
      purchaseCost:   Decimal128 | null,  // cost at time of sale (admin only)
      gstRate:        Number,      // percentage, confirmed at time of sale
      taxableAmount:  Decimal128,  // = quantity × sellingPrice / (1 + gstRate/100)
      cgst:           Decimal128,
      sgst:           Decimal128,
      lineTotal:      Decimal128,  // = quantity × sellingPrice (GST-inclusive)
    }
  ],
  
  // Totals
  subtotalTaxable:  Decimal128,   // sum of taxableAmount
  totalCgst:        Decimal128,
  totalSgst:        Decimal128,
  grandTotal:       Decimal128,
  
  // Payment summary (denormalized for quick read; source of truth is payments collection)
  amountPaid:       Decimal128,
  outstandingAmount: Decimal128,
  
  // Idempotency
  idempotencyKey:   String,       // client-generated UUID; expires 24h
  
  // Metadata
  billedBy:         ObjectId,     // ref: users
  invoicedAt:       Date,
  createdAt:        Date,
  
  // Audit
  finalizedAt:      Date | null,
}
```

**Indexes:**
- `{ invoiceNumber: 1 }` — unique
- `{ idempotencyKey: 1 }` — unique, sparse, TTL 24h
- `{ customerMobile: 1, invoicedAt: -1 }`
- `{ customerName: "text" }` — text index for search
- `{ invoicedAt: -1 }` — for history queries
- `{ status: 1, invoicedAt: -1 }`
- `{ outstandingAmount: 1 }` — for outstanding-balance queries

> **Immutability Enforcement:** A Mongoose pre-save middleware and API-layer guard prevents any field mutation after `status = 'finalized'`. No `PUT`/`DELETE` routes exist for finalized invoices.

---

### 8. `payments`

Each payment event (initial or additional) against an invoice. Never modifies the invoice document.

```typescript
{
  _id:          ObjectId,
  invoiceId:    ObjectId,       // ref: invoices
  invoiceNumber: String,        // snapshot for quick lookup
  
  method:       'cash' | 'upi' | 'split',
  cashAmount:   Decimal128,     // 0 if pure UPI
  upiAmount:    Decimal128,     // 0 if pure cash
  totalAmount:  Decimal128,     // cashAmount + upiAmount
  
  upiReference: String | null,  // UPI transaction ID if available
  
  recordedBy:   ObjectId,       // ref: users
  paidAt:       Date,
  createdAt:    Date,
  note:         String | null,
}
```

**Indexes:**
- `{ invoiceId: 1, paidAt: -1 }`
- `{ paidAt: -1 }` — for daily cash/UPI aggregation

---

### 9. `audit_logs`

Append-only. Never updated or deleted.

```typescript
{
  _id:        ObjectId,
  actorId:    ObjectId,       // ref: users
  actorEmail: String,         // snapshot
  actorRole:  String,
  
  action:     String,         // e.g. "product.price_updated", "invoice.finalized"
  entity:     String,         // e.g. "product", "invoice", "user"
  entityId:   ObjectId | null,
  
  before:     Object | null,  // previous state (sensitive fields redacted)
  after:      Object | null,  // new state
  
  ipAddress:  String | null,
  userAgent:  String | null,
  createdAt:  Date,
}
```

**Indexes:**
- `{ actorId: 1, createdAt: -1 }`
- `{ entity: 1, entityId: 1, createdAt: -1 }`
- `{ action: 1, createdAt: -1 }`
- `{ createdAt: -1 }` — TTL index optional (keep for 2 years minimum)

---

### 10. `settings`

Single document per business (or keyed by namespace).

```typescript
{
  _id:          ObjectId,
  namespace:    'business' | 'report' | 'invoice',
  
  // Business (placeholder until confirmed)
  businessName:   String,       // "HINAYA MARIYAM"
  address:        String | null,  // PLACEHOLDER
  phone:          String | null,  // PLACEHOLDER
  gstin:          String | null,  // PLACEHOLDER — requires accountant confirmation
  
  // Invoice
  invoicePrefix:  String,       // "HM"
  invoiceFormat:  String,       // "HM/YYYY/######"
  
  // Report delivery
  reportTime:     String,       // "21:00" (HH:MM, Asia/Kolkata)
  reportEnabled:  Boolean,
  emailRecipients: [String],
  whatsappNumbers: [String],    // PLACEHOLDER
  
  // Integration flags
  emailEnabled:   Boolean,
  whatsappEnabled: Boolean,
  
  updatedAt:      Date,
  updatedBy:      ObjectId,
}
```

**Indexes:**
- `{ namespace: 1 }` — unique

---

### 11. `daily_reports`

Metadata for each generated daily report.

```typescript
{
  _id:            ObjectId,
  reportDate:     Date,         // business date (Asia/Kolkata midnight)
  generatedAt:    Date | null,
  status:         'pending' | 'generating' | 'generated' | 'failed',
  filePath:       String | null,
  
  // Delivery
  emailStatus:    'pending' | 'sent' | 'failed' | 'disabled',
  emailSentAt:    Date | null,
  emailError:     String | null,
  
  whatsappStatus: 'pending' | 'sent' | 'failed' | 'disabled',
  whatsappSentAt: Date | null,
  whatsappError:  String | null,
  whatsappMessageId: String | null,
  
  retryCount:     Number,       // max 3
  error:          String | null,
  createdAt:      Date,
}
```

**Indexes:**
- `{ reportDate: 1 }` — unique
- `{ status: 1, createdAt: -1 }`

---

## Transaction Boundaries

### Invoice Creation (Phase 3)

All of the following must commit atomically or all roll back:

```
START SESSION TRANSACTION
  1. Check idempotency key → abort if duplicate
  2. For each cart line:
       products.findOneAndUpdate({ _id, stock: {$gte: qty} }, {$inc:{stock: -qty}})
       → abort with InsufficientStockError if condition fails
  3. invoice_counters.findOneAndUpdate → get next invoice number
  4. invoices.create (status: finalized)
  5. payments.create
  6. stock_movements.insertMany
  7. audit_logs.create
COMMIT
```

### Stock-In (Phase 2)

```
START SESSION TRANSACTION
  1. products.findOneAndUpdate → $inc stock by unitQtyAdded
  2. purchase_entries.create
  3. stock_movements.create (movementType: 'stock_in')
  4. audit_logs.create
COMMIT
```

### Stock Adjustment (Phase 2)

```
START SESSION TRANSACTION
  1. products.findOneAndUpdate → $inc stock by delta (can be negative)
  2. stock_movements.create (movementType: 'adjustment', reason: required)
  3. audit_logs.create
COMMIT
```

---

## Index Summary Table

| Collection | Index | Type | Purpose |
|-----------|-------|------|---------|
| users | email | Unique | Login lookup |
| products | name+category | Unique Compound | Duplicate prevention |
| products | sapCode | Sparse | Catalogue lookup |
| products | stock+lowStockThreshold | Compound | Low-stock query |
| invoices | invoiceNumber | Unique | Idempotency + lookup |
| invoices | idempotencyKey | Unique+TTL | Duplicate submission guard |
| invoices | customerName | Text | Full-text search |
| invoices | invoicedAt | Desc | History pagination |
| payments | invoiceId+paidAt | Compound | Payment history |
| payments | paidAt | Desc | Daily aggregation |
| stock_movements | productId+createdAt | Compound | Movement history |
| audit_logs | entity+entityId+createdAt | Compound | Audit queries |
| daily_reports | reportDate | Unique | Duplicate report guard |
