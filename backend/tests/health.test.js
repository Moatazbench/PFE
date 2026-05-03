const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('HR Evaluation API is running!');
  });
});