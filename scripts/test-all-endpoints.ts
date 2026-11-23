import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../server/src/index';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hinaya_mariyam_erp';

interface TestResult {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  endpoint: string;
  status: number;
  expectedStatus: number;
  success: boolean;
  notes?: string;
}

const results: TestResult[] = [];

async function run() {
  console.log('====================================================');
  console.log('   HINAYA MARIYAM ERP — FULL END-TO-END API TEST    ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  let sessionCookie: string[] = [];

  const req = async (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
    expectedStatus: number = 200,
    label?: string
  ) => {
    let r;
    switch (method) {
      case 'GET':
        r = request(app).get(url);
        break;
      case 'POST':
        r = request(app).post(url).send(data as object);
        break;
      case 'PATCH':
        r = request(app).patch(url).send(data as object);
        break;
      case 'PUT':
        r = request(app).put(url).send(data as object);
        break;
      case 'DELETE':
        r = request(app).delete(url);
        break;
    }

    if (sessionCookie.length > 0) {
      r.set('Cookie', sessionCookie);
    }

    const res = await r;

    // Capture session cookie from login
    if (res.headers['set-cookie']) {
      sessionCookie = res.headers['set-cookie'];
    }

    const passed = res.status === expectedStatus;
    results.push({
      method,
      endpoint: url,
      status: res.status,
      expectedStatus,
      success: passed,
      notes: label || (res.body?.message || (res.body?.success ? 'Success' : JSON.stringify(res.body).slice(0, 80))),
    });

    const mark = passed ? '✅' : '❌';
    console.log(`${mark} [${method.padEnd(6)}] ${url.padEnd(38)} -> ${res.status} (${label || 'OK'})`);
    if (!passed) {
      console.log('    Response body:', JSON.stringify(res.body));
    }
    return res;
  };

  try {
    // 1. Health check (GET)
    await req('GET', '/api/health', undefined, 200, 'System Health & Replica Check');

    // 2. Auth Login (POST)
    await req(
      'POST',
      '/api/auth/login',
      { email: 'sivaprakashs127@gmail.com', password: 'Siva_6805' },
      200,
      'Admin Login with Demo Account'
    );

    // 3. Current Session (GET)
    await req('GET', '/api/auth/me', undefined, 200, 'Current Authenticated User Profile');

    // 4. User Management (GET)
    await req('GET', '/api/users', undefined, 200, 'List All Store Staff (Admin Only)');

    // 5. User Management (POST)
    const uniqueEmail = `staff_${Date.now()}@hinayamariyam.com`;
    await req(
      'POST',
      '/api/users',
      {
        name: 'Test Cashier Staff',
        email: uniqueEmail,
        password: 'Password_123',
        role: 'billing_operator',
      },
      201,
      'Create New Billing Operator Staff'
    );

    // 6. Products Catalogue (GET)
    await req('GET', '/api/products?limit=10', undefined, 200, 'List Active Catalogue Products');

    // 7. Product Creation (POST)
    const testSku = `TEST_${Date.now()}`;
    const createProductRes = await req(
      'POST',
      '/api/products',
      {
        name: `Special Ghee Mysore Pak ${testSku}`,
        category: 'Sweets',
        packType: 'box',
        purchasePrice: '120.00',
        sellingPrice: '180.00',
        gstRate: 5,
        sapCode: testSku,
        lowStockThreshold: 5,
      },
      201,
      'Create New Product with 5% GST'
    );
    const createdProductId = createProductRes.body?.data?.product?._id;

    // 8. Product Update (PATCH)
    if (createdProductId) {
      await req(
        'PATCH',
        `/api/products/${createdProductId}`,
        {
          name: `Special Ghee Mysore Pak ${testSku} (Updated)`,
          sellingPrice: '195.00',
          reason: 'Raw material ghee price revision',
        },
        200,
        'Update Product Details & Revise Price'
      );

      // 9. Price History (GET)
      await req(
        'GET',
        `/api/products/${createdProductId}/price-history`,
        undefined,
        200,
        'Verify Price History Audit Trail'
      );

      // 10. Stock-in (POST)
      await req(
        'POST',
        '/api/inventory/stock-in',
        {
          productId: createdProductId,
          purchaseUnit: 'carton',
          purchaseQty: 2,
          conversionFactor: 10,
          purchaseCost: '120.00',
          notes: 'Purchase invoice PUR-2026-001',
        },
        201,
        'Stock-in 20 units (2 cartons x 10 units)'
      );

      // 11. Stock Adjustment (POST)
      await req(
        'POST',
        '/api/inventory/adjust',
        {
          productId: createdProductId,
          delta: -2,
          reason: 'Damaged in transit packaging audit',
        },
        200,
        'Decrease Stock by -2 with Audit Reason'
      );

      // 12. Stock Movements Ledger (GET)
      await req(
        'GET',
        `/api/inventory/movements/${createdProductId}`,
        undefined,
        200,
        'Fetch Append-Only Stock Movements'
      );
    }

    // 13. Customers Lookup (GET)
    await req(
      'GET',
      '/api/customers/lookup?mobile=9698603288',
      undefined,
      200,
      'Customer Auto-Lookup by 10-Digit Mobile'
    );

    // 14. Customers Collection List (GET)
    await req('GET', '/api/customers', undefined, 200, 'List Dedicated Customer DB Records');

    // 15. Invoices List (GET)
    await req('GET', '/api/invoices?limit=5', undefined, 200, 'List Past Invoices Archive');

    // 16. Dashboard Business Reports (GET)
    await req('GET', '/api/reports/dashboard?range=today', undefined, 200, 'Today Sales & Gross Profit Analytics');

    // 17. Excel Export Report (GET)
    await req('GET', '/api/reports/export/excel', undefined, 200, 'Download Multi-Tab Excel Workbook');

    // 18. Daily Scheduled Report Info (GET)
    await req('GET', '/api/reports/daily', undefined, 200, 'Fetch 9:00 PM Daily Report Schedule Status');

    // 19. Product Soft-delete / Deactivate (DELETE)
    if (createdProductId) {
      await req(
        'DELETE',
        `/api/products/${createdProductId}`,
        undefined,
        200,
        'Deactivate / Soft-Delete Test Product'
      );
    }

    // 20. Auth Logout (POST)
    await req('POST', '/api/auth/logout', {}, 200, 'Secure Session Logout');

    console.log('\n====================================================');
    const total = results.length;
    const passed = results.filter((r) => r.success).length;
    const failed = total - passed;
    console.log(`TOTAL REQUESTS TESTED: ${total}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('====================================================\n');

    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal testing error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

run();
