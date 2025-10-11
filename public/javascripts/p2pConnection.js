export function startP2PConnection(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback) {
  let ws, peerConnection, dataChannel;
  let isReady = false;
  let closedManually = false;
  const pendingMessages = [];

  const log = msg => console.log(`[${clientId}] ${msg}`);
  // LOG ADDED: structured logging helper
  const correlationId = (clientId && targetId) ? `${clientId}->${targetId}` : clientId || null; // LOG ADDED: correlation id
  function safeStructLog(eventType, details, hint) { // LOG ADDED: helper
    try {
      const base = { timestamp: new Date().toISOString(), eventType, correlationId, clientId, targetId, hint: hint || null };
      const safe = {};
      if (details && typeof details === 'object') {
        for (const k in details) {
          if (!Object.prototype.hasOwnProperty.call(details, k)) continue;
            let v = details[k];
            if (typeof v === 'function') continue;
            if (/credential|password|secret/i.test(k) && typeof v === 'string') v = v.replace(/.+/, '***');
            if (k === 'url' && typeof v === 'string') v = v.replace(/([^:]{2})[^@]*@/, '$1***@');
            safe[k] = v;
        }
      } else if (details !== undefined) {
        safe.value = details;
      }
      console.log({ ...base, ...safe });
    } catch(e) {
      try { console.warn({ timestamp: new Date().toISOString(), eventType: 'logSerializationError', correlationId, error: e && e.message }); } catch(_) {}
    }
  }

  // LOG ADDED: reconnection counters
  let _reconnectAttempts = 0; // unused currently
  const _maxReconnectAttempts = 5; // unused currently
  let _reconnectDelay = 3000; // unused currently

  function sendMessage(msg) {
    const text = typeof msg === "string" ? msg : JSON.stringify(msg);
    if (dataChannel && dataChannel.readyState === "open") {
      try {
        dataChannel.send(text);
      } catch(e) {
        safeStructLog('dataChannelSendError', { error: e && e.message }, 'Message queued'); // LOG ADDED
        pendingMessages.push(msg);
      }
    } else {
      log("⏳ Channel not ready, queueing message...");
      safeStructLog('queueMessage', { length: text.length, queued: pendingMessages.length + 1 }, 'Will flush when open'); // LOG ADDED
      pendingMessages.push(msg);
    }
  }

  function flushQueue() {
    while (pendingMessages.length > 0) {
      if (!(dataChannel && dataChannel.readyState === 'open')) break;
      const m = pendingMessages.shift();
      safeStructLog('flushQueuedMessage', { remaining: pendingMessages.length }, null); // LOG ADDED
      sendMessage(m);
    }
  }

  function setupWebSocket() {
    ws = new WebSocket(`ws://${location.host}`);

    ws.onopen = () => {
      log("🔌 WebSocket connected");
      safeStructLog('wsOpen', {}, null); // LOG ADDED
      ws.send(JSON.stringify({ type: "register", clientId }));
      safeStructLog('wsRegisterSent', {}, null); // LOG ADDED
      setupPeerConnection();
    };

    ws.onclose = () => {
      log("❌ WebSocket closed");
      safeStructLog('wsClosed', {}, 'Will attempt reconnect'); // LOG ADDED
      if (!closedManually) {
        log("🔁 Reconnecting WebSocket in 2s...");
        safeStructLog('wsReconnectScheduled', { delayMs: 2000 }, null); // LOG ADDED
        setTimeout(setupWebSocket, 2000);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        safeStructLog('wsMessage', { type: data && data.type }, null); // LOG ADDED
        if (data.type === "offer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: peerConnection.localDescription, targetId: data.fromId }));
          safeStructLog('wsAnswerSent', {}, null); // LOG ADDED
        } else if (data.type === "answer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          safeStructLog('remoteAnswerSet', {}, null); // LOG ADDED
        } else if (data.type === "ice") {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          safeStructLog('remoteIceCandidateAdded', { candidate: data.candidate && data.candidate.candidate }, null); // LOG ADDED
        }
      } catch(e) {
        safeStructLog('wsMessageError', { error: e && e.message }, 'Check signaling payload'); // LOG ADDED
      }
    };
  }

  function setupPeerConnection() {
    if (peerConnection) {
      peerConnection.close();
      safeStructLog('replacePeerConnection', {}, 'Previous connection closed'); // LOG ADDED
    }

    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        try {
          ws.send(JSON.stringify({ type: "ice", candidate, targetId }));
          safeStructLog('localIceCandidateSent', { candidate: candidate && candidate.candidate }, null); // LOG ADDED
        } catch(e) {
          safeStructLog('localIceCandidateSendError', { error: e && e.message }, 'Check WS connection'); // LOG ADDED
        }
      }
    };

    peerConnection.onicecandidateerror = (event) => { // LOG ADDED: ICE candidate error handler
      const { errorCode, errorText, url, hostCandidate } = event || {};
      safeStructLog('iceCandidateError', { errorCode, errorText, url, hostCandidate }, 'Verify STUN server reachability'); // LOG ADDED
    };

    peerConnection.onicegatheringstatechange = () => { // LOG ADDED: gathering state
      safeStructLog('iceGatheringStateChange', { state: peerConnection.iceGatheringState }, null);
    };

    peerConnection.oniceconnectionstatechange = () => { // LOG ADDED: connection state
      const st = peerConnection.iceConnectionState;
      safeStructLog('iceConnectionStateChange', { state: st }, st === 'failed' ? 'Consider restartIce() or TURN' : null);
    };

    peerConnection.ondatachannel = (event) => {
      log("📥 Received data channel");
      safeStructLog('dataChannelReceived', { label: event && event.channel && event.channel.label }, null); // LOG ADDED
      setupDataChannel(event.channel);
    };

    peerConnection.onconnectionstatechange = () => { // LOG ADDED: top-level connection state
      const state = peerConnection.connectionState;
      safeStructLog('connectionStateChange', { state }, null);
      log(`🔄 Peer connection state: ${state}`);

      if (state === 'connected') {
        _reconnectAttempts = 0; _reconnectDelay = 3000; // LOG ADDED: reset counters
        safeStructLog('connectionStable', {}, null); // LOG ADDED
      }

      if ((state === "failed" || state === "disconnected") && !closedManually) {
        safeStructLog('reconnectNeeded', { currentState: state }, null); // LOG ADDED
        log("⚠️ Connection lost. Reconnecting in 3s...");
        setTimeout(() => {
          if (!closedManually) setupPeerConnection();
        }, 3000);
      }
    };

    // ініціатор створює dataChannel
//    if (clientId < targetId) {
    if (isInitiatorOfDataChannel) {
      dataChannel = peerConnection.createDataChannel("chat");
      safeStructLog('dataChannelCreated', { label: dataChannel && dataChannel.label }, null); // LOG ADDED
      setupDataChannel(dataChannel);

      peerConnection.createOffer()
        .then(offer => { safeStructLog('offerCreated', { hasSdp: !!offer && !!offer.sdp }, null); return peerConnection.setLocalDescription(offer); }) // LOG ADDED
        .then(() => {
          ws.send(JSON.stringify({ type: "offer", sdp: peerConnection.localDescription, targetId }));
          safeStructLog('offerSent', {}, null); // LOG ADDED
        })
        .catch(e => { safeStructLog('offerError', { error: e && e.message }, 'Check local description'); }); // LOG ADDED
    }
  }

  function setupDataChannel(channel) {
    dataChannel = channel;

    dataChannel.onopen = () => {
      isReady = true;
      log("✅ DataChannel open");
      safeStructLog('dataChannelOpen', { label: channel && channel.label }, 'Ready to send'); // LOG ADDED
      flushQueue();
    };

    dataChannel.onmessage = (event) => {
      log("📨 Message from peer: " + event.data);
      safeStructLog('dataChannelMessage', { length: event && event.data && event.data.length }, null); // LOG ADDED
      if (onMessageCallback) onMessageCallback(event.data);
    };

    dataChannel.onclose = () => {
      log("❌ DataChannel closed");
      safeStructLog('dataChannelClose', {}, null); // LOG ADDED
      isReady = false;
    };

    dataChannel.onerror = (err) => { // LOG ADDED
      safeStructLog('dataChannelError', { error: err && err.message }, 'Inspect ICE / network');
    };
  }

  function close() {
    closedManually = true;
    log("🛑 Closing connection manually");
    safeStructLog('manualClose', {}, null); // LOG ADDED

    if (dataChannel) dataChannel.close();
    if (peerConnection) peerConnection.close();
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  }

  // запуск WebSocket + Peer
  setupWebSocket();

  return {
    send: sendMessage,
    isConnected: () => isReady,
    close
  };
}
