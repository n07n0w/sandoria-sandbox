(function (global) {
  console.log('[P2P] p2pConnectionGlobalPromise.js real implementation loaded');

  function startP2PConnection(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback, onStatusChange) {
    let ws, peerConnection, dataChannel;
    let isReady = false;
    let closedManually = false;
    const pendingMessages = [];

    // Reconnection control
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectDelay = 3000;

    // Simple, safe logger
    const log = (msg, ...args) => {
      const logMessage = `[${clientId}] ${msg}`;
      const isErr = /(error|failed|❌)/i.test(String(msg));
      if (args && args.length) {
        (isErr ? console.error : console.log)(logMessage, ...args);
      } else {
        (isErr ? console.error : console.log)(logMessage);
      }
      if (isErr) {
        try {
          if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const payload = JSON.stringify({ message: String(msg), clientId, timestamp: Date.now(), level: 'error' });
            navigator.sendBeacon('/log-trace', payload);
          } else if (typeof fetch !== 'undefined') {
            fetch('/log-trace', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: String(msg), clientId, timestamp: Date.now(), level: 'error' })
            }).catch(() => {});
          }
        } catch (_) {}
      }
    };

    // Structured logging helper for diagnostics
    const correlationId = (clientId && targetId) ? `${clientId}->${targetId}` : (clientId || null);
    function safeStructLog(eventType, details, hint) {
      try {
        const base = { timestamp: new Date().toISOString(), eventType, correlationId, clientId, targetId, hint: hint || null };
        let safeDetails = {};
        if (details && typeof details === 'object') {
          for (const k in details) {
            if (!Object.prototype.hasOwnProperty.call(details, k)) continue;
            const v = details[k];
            if (typeof v === 'function') continue;
            try {
              if (/credential|password|secret/i.test(k) && typeof v === 'string') {
                safeDetails[k] = '***';
              } else if (k === 'url' && typeof v === 'string') {
                safeDetails[k] = v.replace(/([^:]{2})[^@]*@/, '$1***@');
              } else {
                safeDetails[k] = v;
              }
            } catch (_) {
              safeDetails[k] = '[unserializable]';
            }
          }
        } else {
          safeDetails.value = details;
        }
        console.log({ ...base, ...safeDetails });
      } catch (e) {
        try { console.warn({ timestamp: new Date().toISOString(), eventType: 'logSerializationError', correlationId, error: e && e.message }); } catch (_) {}
      }
    }

    function sendMessage(data) {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(text);
        } catch (e) {
          log('Failed to send via dataChannel', e);
          safeStructLog('dataChannelSendError', { error: e && e.message }, 'Retry later');
          pendingMessages.push(text);
        }
      } else {
        log('⏳ Queueing message...');
        safeStructLog('queueMessage', { length: text.length }, 'Will flush when channel opens');
        pendingMessages.push(text);
      }
    }

    function flushQueue() {
      while (pendingMessages.length > 0) {
        if (!(dataChannel && dataChannel.readyState === 'open')) break;
        const m = pendingMessages.shift();
        safeStructLog('flushQueuedMessage', { remaining: pendingMessages.length }, null);
        sendMessage(m);
      }
    }

    function setupWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${location.host}`);

      ws.onopen = () => {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'register', clientId }));
            safeStructLog('wsRegisterSent', {}, null);
          }
        } catch (e) {
          log('Failed to send register', e);
          safeStructLog('wsRegisterError', { error: e && e.message }, 'Check WS server');
        }
        log('🔌 WS connected');
        safeStructLog('wsOpen', {}, null);
        onStatusChange && onStatusChange('ws-connected');
        setupPeerConnection();
      };

      ws.onclose = () => {
        log('❌ WS closed');
        safeStructLog('wsClosed', {}, 'Will attempt reconnect if not closed manually');
        onStatusChange && onStatusChange('ws-closed');
        if (!closedManually) {
          onStatusChange && onStatusChange('ws-reconnecting');
          setTimeout(() => { try { setupWebSocket(); } catch (e) { log('Reconnection failed', e); safeStructLog('wsReconnectError', { error: e && e.message }, 'Manual reload may help'); } }, 2000);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
            safeStructLog('wsMessage', { type: data && data.type }, null);
          if (data.type === 'offer') {
            if (!peerConnection) setupPeerConnection();
            await peerConnection.setRemoteDescription(data.sdp);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription, targetId: data.fromId }));
              safeStructLog('wsAnswerSent', {}, null);
            }
          } else if (data.type === 'answer') {
            if (peerConnection) await peerConnection.setRemoteDescription(data.sdp);
            safeStructLog('remoteAnswerSet', {}, null);
          } else if (data.type === 'ice') {
            if (peerConnection) await peerConnection.addIceCandidate(data.candidate);
            safeStructLog('remoteIceCandidateAdded', { candidate: data.candidate && data.candidate.candidate }, null);
          }
        } catch (e) {
          log('Error handling ws.onmessage', e);
          safeStructLog('wsMessageError', { error: e && e.message }, 'Check signaling data');
        }
      };
    }

    function cleanupPeerConnection() {
      if (peerConnection) {
        try { peerConnection.onicecandidate = null; } catch (_) {}
        try { peerConnection.ondatachannel = null; } catch (_) {}
        try { peerConnection.onconnectionstatechange = null; } catch (_) {}
        try { peerConnection.close(); } catch (e) { log('Error closing peerConnection', e); safeStructLog('peerCloseError', { error: e && e.message }, null); }
      }
      peerConnection = null;
      dataChannel = null;
      isReady = false;
      safeStructLog('peerCleanup', {}, null);
    }

    function setupPeerConnection() {
      log('setupPeerConnection()');
      safeStructLog('setupPeerConnection', {}, 'Creating new RTCPeerConnection');
      if (peerConnection) {
        log('peerConnection.close()');
        safeStructLog('replacePeerConnection', {}, 'Replacing existing connection');
        cleanupPeerConnection();
      }

      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'turn:numb.viagenie.ca', credential: 'muazkh', username: 'webrtc@live.com' },
          { urls: 'turn:192.158.29.39:3478?transport=udp', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username: '28224511:1379330808' },
          { urls: 'turn:192.158.29.39:3478?transport=tcp', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username: '28224511:1379330808' }
        ],
        iceCandidatePoolSize: 10
      });

      peerConnection.onicecandidate = ({ candidate }) => {
        try {
          if (candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ice', candidate, targetId }));
            safeStructLog('localIceCandidateSent', { candidate: candidate && candidate.candidate }, null);
          }
        } catch (e) {
          log('Failed to send ICE candidate', e);
          safeStructLog('localIceCandidateSendError', { error: e && e.message }, 'Check signaling channel');
        }
      };

      peerConnection.onicecandidateerror = (event) => {
        const { errorCode, errorText, url, hostCandidate } = event || {};
        safeStructLog('iceCandidateError', { errorCode, errorText, url, hostCandidate }, 'Verify STUN/TURN');
        log('❌ ICE candidate error:', event && (event.errorText || 'Unknown ICE error'));
      };

      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        log(`🧊 ICE connection state: ${iceState}`);
        safeStructLog('iceConnectionStateChange', { state: iceState }, iceState === 'failed' ? 'Consider restartIce / TURN' : null);
        if (iceState === 'failed') log('❌ ICE connection failed - possible NAT/Firewall issues');
      };

      peerConnection.onicegatheringstatechange = () => {
        safeStructLog('iceGatheringStateChange', { state: peerConnection.iceGatheringState }, null);
        log(`🔍 ICE gathering state: ${peerConnection.iceGatheringState}`);
      };

      peerConnection.ondatachannel = (event) => {
        log('📥 Got data channel');
        safeStructLog('dataChannelReceived', { label: event && event.channel && event.channel.label }, null);
        setupDataChannel(event.channel);
      };

      peerConnection.onconnectionstatechange = () => {
        try {
          const state = peerConnection.connectionState;
          log('🔄 RTC state:', state);
          safeStructLog('connectionStateChange', { state }, null);
          if (state === 'connected') {
            reconnectAttempts = 0;
            reconnectDelay = 3000;
            safeStructLog('connectionStable', {}, null);
            onStatusChange && onStatusChange('connected');
          } else if ((state === 'disconnected' || state === 'failed' || state === 'closed') && !closedManually) {
            if (reconnectAttempts >= maxReconnectAttempts) {
              log(`❌ Max reconnect attempts (${maxReconnectAttempts}) reached. Stopping.`);
              safeStructLog('reconnectAborted', { attempts: reconnectAttempts }, 'Reload page or check network');
              onStatusChange && onStatusChange('connection-failed');
              return;
            }
            reconnectAttempts++;
            log(`🔄 Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
            safeStructLog('reconnectAttempt', { attempt: reconnectAttempts, max: maxReconnectAttempts, delayMs: reconnectDelay, reason: state }, 'Await attempt');
            onStatusChange && onStatusChange('reconnecting');
            setTimeout(() => {
              try { setupPeerConnection(); } catch (e) { log('Re-setup failed', e); safeStructLog('reconnectSetupError', { error: e && e.message }, 'Manual reload may be required'); onStatusChange && onStatusChange('connection-failed'); }
            }, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
          }
        } catch (e) { log('onconnectionstatechange handler error', e); safeStructLog('connectionStateHandlerError', { error: e && e.message }, null); }
      };

      if (isInitiatorOfDataChannel) {
        try {
          dataChannel = peerConnection.createDataChannel('chat');
          safeStructLog('dataChannelCreated', { label: dataChannel && dataChannel.label }, null);
          setupDataChannel(dataChannel);
          (async () => {
            try {
              const offer = await peerConnection.createOffer();
              safeStructLog('offerCreated', { hasSdp: !!offer && !!offer.sdp }, null);
              await peerConnection.setLocalDescription(offer);
              safeStructLog('localDescriptionSet', { type: offer && offer.type }, null);
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription, targetId }));
                safeStructLog('offerSent', {}, null);
              } else {
                log('WS not open, cannot send offer', ws && ws.readyState);
                safeStructLog('offerSendSkipped', { wsState: ws && ws.readyState }, 'Wait for WS reconnect');
              }
            } catch (e) {
              log('Failed to create/send offer', e);
              safeStructLog('offerError', { error: e && e.message }, 'Check network');
              onStatusChange && onStatusChange('failed');
            }
          })();
        } catch (e) {
          log('Error during initiator setup', e);
          safeStructLog('initiatorSetupError', { error: e && e.message }, null);
        }
      }
    }

    function setupDataChannel(channel) {
      dataChannel = channel;
      dataChannel.onopen = () => {
        isReady = true;
        safeStructLog('dataChannelOpen', { label: channel && channel.label }, 'Ready to send messages');
        onStatusChange && onStatusChange('connected');
        flushQueue();
      };
      dataChannel.onmessage = (e) => {
        safeStructLog('dataChannelMessage', { length: e && e.data && e.data.length }, null);
        if (onMessageCallback) {
          try { onMessageCallback(JSON.parse(e.data)); } catch { onMessageCallback(e.data); }
        }
      };
      dataChannel.onclose = () => {
        isReady = false;
        safeStructLog('dataChannelClose', {}, null);
        onStatusChange && onStatusChange('disconnected');
      };
      dataChannel.onerror = (err) => {
        log('DataChannel error', err);
        safeStructLog('dataChannelError', { error: err && err.message }, 'Inspect network / ICE');
      };
    }

    function close() {
      log('close()');
      closedManually = true;
      safeStructLog('manualClose', {}, null);
      onStatusChange && onStatusChange('closed');
      try { dataChannel && dataChannel.close(); } catch (e) { log('Error closing dataChannel', e); safeStructLog('dataChannelCloseError', { error: e && e.message }, null); }
      cleanupPeerConnection();
      try { if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close(); } catch (e) { log('Error closing ws', e); safeStructLog('wsCloseError', { error: e && e.message }, null); }
    }

    // Start WS
    setupWebSocket();

    return { send: sendMessage, isConnected: () => isReady, close };
  }

  function startP2PConnectionAsync(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback, onStatusChange) {
    return new Promise((resolve, reject) => {
      const connection = startP2PConnection(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback, (status) => {
        onStatusChange && onStatusChange(status);
        if (status === 'connected') resolve(connection);
        if (status === 'failed' || status === 'closed') reject(new Error(`P2P connection failed with status: ${status}`));
      });
    });
  }

  global.startP2PConnection = startP2PConnection;
  global.startP2PConnectionAsync = startP2PConnectionAsync;

  // CommonJS export for Node/testing environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { startP2PConnection, startP2PConnectionAsync };
  }
})(typeof window !== 'undefined' ? window : globalThis);
