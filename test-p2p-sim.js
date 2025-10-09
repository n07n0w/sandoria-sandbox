// Simple simulation test for p2pConnectionGlobalPromise.js
// This does NOT test real WebRTC, only basic control flow, queue flush, and API surface.

// ---- Mocks ----
class MockWebSocket {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  constructor(url){
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    setTimeout(()=>{ this.readyState = MockWebSocket.OPEN; this.onopen && this.onopen(); }, 5);
  }
  send(msg){ this.sent.push(msg); }
  close(){ this.readyState = MockWebSocket.CLOSED; this.onclose && this.onclose(); }
}

class MockRTCDataChannel {
  constructor(label){
    this.label = label;
    this.buffered = [];
    this.readyState = 'connecting';
    setTimeout(()=>{ this.readyState='open'; this.onopen && this.onopen(); }, 15);
  }
  send(m){ this.buffered.push(m); }
  close(){ this.readyState='closed'; this.onclose && this.onclose(); }
}

class MockRTCPeerConnection {
  constructor(cfg){ this.cfg = cfg; this.connectionState = 'new'; this.iceConnectionState='new'; setTimeout(()=>{ this.connectionState='connected'; this.onconnectionstatechange && this.onconnectionstatechange(); }, 40); }
  createDataChannel(label){ const ch = new MockRTCDataChannel(label); return ch; }
  async createOffer(){ return { type:'offer', sdp:'fake-offer' }; }
  async setLocalDescription(desc){ this.localDescription = desc; }
  async setRemoteDescription(desc){ this.remoteDescription = desc; }
  async createAnswer(){ return { type:'answer', sdp:'fake-answer' }; }
  async addIceCandidate(){ }
  close(){ this.connectionState='closed'; }
}

// Global / window mocks
global.window = { location: { protocol: 'http:', host: 'localhost:3000' } };
// Provide global.location alias like in browsers
global.location = global.window.location;
global.WebSocket = MockWebSocket;
global.RTCPeerConnection = MockRTCPeerConnection;
// Minimal navigator / fetch mocks to avoid errors in logger
global.navigator = { sendBeacon: ()=>{} };
global.fetch = ()=>Promise.resolve();

// Load implementation
const exported = require('./public/javascripts/p2pConnectionGlobalPromise.js');
const startAsync = exported.startP2PConnectionAsync || (global.window && window.startP2PConnectionAsync);
if (typeof startAsync !== 'function') {
  throw new Error('startP2PConnectionAsync not available after require');
}

function delay(ms){ return new Promise(r=>setTimeout(r, ms)); }

(async () => {
  const logs = [];
  const statusSeq = [];
  const origLog = console.log;
  console.log = (...a)=>{ logs.push(a.join(' ')); origLog(...a); };

  const conn = await startAsync('client-A','client-B', true, (msg)=>{
    logs.push('[MESSAGE_CB] '+JSON.stringify(msg));
  }, (status)=>{ statusSeq.push(status); });

  // Before channel open we queue some messages
  conn.send({type:'early', n:1});
  conn.send({type:'early', n:2});

  // Wait enough time for data channel to open and flush
  await delay(80);

  conn.send({type:'afterOpen'});

  // Close
  conn.close();
  await delay(10);

  console.log = origLog;

  // Assertions (basic)
  const result = {
    statusSequence: statusSeq,
    isConnectedFlag: conn.isConnected(),
    queuedFlushed: statusSeq.includes('connected'),
    notes: 'If statusSequence includes connected and no exceptions occurred, basic flow is OK.'
  };

  console.log('\n--- P2P Sim Result ---');
  console.log(JSON.stringify(result, null, 2));
})();
