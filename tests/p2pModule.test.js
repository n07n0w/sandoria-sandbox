describe('p2p module presence', () => {
  it('exports startP2PConnection functions without executing browser-only code', () => {
    const mod = require('../public/javascripts/p2pConnectionGlobalPromise.js');
    expect(typeof mod.startP2PConnection).toBe('function');
    expect(typeof mod.startP2PConnectionAsync).toBe('function');
  });
});
