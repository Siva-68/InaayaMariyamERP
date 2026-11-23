import request from 'supertest';
import app from '../src/index';

describe('Auth & RBAC Middleware API', () => {
  describe('POST /api/auth/login validation', () => {
    it('returns 422 when email is missing or invalid', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('returns 422 when password is empty', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: '',
      });
      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Session protection (requireAuth)', () => {
    it('GET /api/auth/me returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('POST /api/auth/logout returns 401 UNAUTHORIZED without session', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('RBAC protection (requireRole)', () => {
    it('GET /api/users returns 401 UNAUTHORIZED for unauthenticated caller', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('POST /api/users returns 401 UNAUTHORIZED for unauthenticated caller', async () => {
      const res = await request(app).post('/api/users').send({
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
        role: 'billing_operator',
      });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });
});
