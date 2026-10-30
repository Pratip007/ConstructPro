const request = require('supertest');
const { app } = require('../../server');

describe('Health check endpoint', () => {
  test('GET /api/health returns 200 with ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  test('GET /api/health response includes a timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.data.timestamp).toBeDefined();
    expect(new Date(res.body.data.timestamp).toString()).not.toBe('Invalid Date');
  });
});
