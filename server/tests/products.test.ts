import request from 'supertest';
import app from '../src/index';

describe('Products API', () => {
  describe('Authentication & Validation', () => {
    it('GET /api/products returns 401 UNAUTHORIZED when no session exists', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('POST /api/products returns 401 UNAUTHORIZED without admin credentials', async () => {
      const res = await request(app).post('/api/products').send({
        name: 'Cashew Burfi 250g',
        category: 'Burfi',
        sellingPrice: '150.00',
        purchasePrice: '120.00',
      });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/products/123 returns 401 UNAUTHORIZED without admin credentials', async () => {
      const res = await request(app).patch('/api/products/123').send({
        sellingPrice: '160.00',
      });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/products/123 returns 401 UNAUTHORIZED without admin credentials', async () => {
      const res = await request(app).delete('/api/products/123');
      expect(res.status).toBe(401);
    });

    it('GET /api/products/123/price-history returns 401 without authorized session', async () => {
      const res = await request(app).get('/api/products/123/price-history');
      expect(res.status).toBe(401);
    });
  });
});
