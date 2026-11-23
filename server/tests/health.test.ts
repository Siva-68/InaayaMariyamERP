import request from 'supertest';
import app from '../src/index';
import mongoose from 'mongoose';

describe('Health Check API', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('GET /api/health returns health status object', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(res.body.success ? 200 : 503);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('db');
    expect(res.body.data).toHaveProperty('replicaSet');
  });

  it('GET /api/nonexistent returns 404 with structured error', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
