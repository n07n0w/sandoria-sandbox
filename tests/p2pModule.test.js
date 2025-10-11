describe('p2p module presence', () => {
  it('exports startP2PConnection functions without executing browser-only code', () => {
    const mod = require('../public/javascripts/p2pConnectionGlobalPromise.js');
    expect(typeof mod.startP2PConnection).toBe('function');
    expect(typeof mod.startP2PConnectionAsync).toBe('function');
  });
});
const request = require('supertest');
const app = require('../app');

describe('Health endpoint', () => {
  it('returns OK status JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });
});

