import request from 'supertest';
import app from '../src/index';

describe('Inventory API', () => {
  describe('Stock-in & Adjustment Authorization & Validation', () => {
    it('POST /api/inventory/stock-in returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).post('/api/inventory/stock-in').send({
        productId: '64b1f2e9a1b2c3d4e5f6a7b8',
        purchaseQty: 5,
        conversionFactor: 24,
        purchaseCost: '1200.00',
      });
      expect(res.status).toBe(401);
    });

    it('POST /api/inventory/adjust returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).post('/api/inventory/adjust').send({
        productId: '64b1f2e9a1b2c3d4e5f6a7b8',
        delta: -2,
        reason: 'Broken packages',
      });
      expect(res.status).toBe(401);
    });

    it('GET /api/inventory/movements/123 returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).get('/api/inventory/movements/123');
      expect(res.status).toBe(401);
    });
  });
});
