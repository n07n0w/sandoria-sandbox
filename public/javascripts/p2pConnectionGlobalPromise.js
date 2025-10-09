(function (global) {
  function startP2PConnection(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback, onStatusChange) {
    let ws, peerConnection, dataChannel;
    let isReady = false;
    let closedManually = false;
    const pendingMessages = [];

    // Добавляем счетчики для контроля переподключений
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectDelay = 3000;

	// Simple, safe logger that doesn't create stack traces for normal operations
	const log = (msg, ...args) => {
		// Simple, safe logger that doesn't create stack traces for normal operations
		const logMessage = `[${clientId}] ${msg}`;

		// Use console.log for normal messages, console.error for actual errors
		if (args && args.length) {
			if (/(error|failed|❌)/i.test(String(msg))) {
				console.error(logMessage, ...args);
			} else {
				console.log(logMessage, ...args);
			}
		} else {
			if (/(error|failed|❌)/i.test(String(msg))) {
				console.error(logMessage);
			} else {
				console.log(logMessage);
			}
		}

		// Only send to server for actual errors, not normal operational messages
		if (/(error|failed|❌)/i.test(String(msg))) {
			try {
				if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
					const payload = JSON.stringify({
						message: String(msg),
						clientId,
						timestamp: Date.now(),
						level: 'error'
					});
					navigator.sendBeacon('/log-trace', payload);
				} else if (typeof fetch !== 'undefined') {
					fetch('/log-trace', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							message: String(msg),
							clientId,
							timestamp: Date.now(),
							level: 'error'
						})
					}).catch(() => {});
				}
			} catch (err) {
				// silently ignore remote logging errors
			}
		};

    // LOG ADDED: structured logging helper for WebRTC diagnostics
    const correlationId = (clientId && targetId) ? `${clientId}->${targetId}` : (clientId || null);
    function safeStructLog(eventType, details, hint) { // LOG ADDED: helper
      try {
        const base = {
          timestamp: new Date().toISOString(),
          eventType,
          correlationId: correlationId || null,
          clientId,
          targetId,
          hint: hint || null
        };
        // Avoid throwing on circular / large objects
        let safeDetails = {};
        if (details && typeof details === 'object') {
          for (const k in details) {
            if (!Object.prototype.hasOwnProperty.call(details, k)) continue;
            const v = details[k];
            if (typeof v === 'function') continue;
            try {
              // Mask potential sensitive credential fields
              if (/credential|password|secret/i.test(k) && typeof v === 'string') {
                safeDetails[k] = v.replace(/.+/, '***');
              } else if (k === 'url' && typeof v === 'string') {
                // mask userinfo in URL if present
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
        try { console.warn({ timestamp: new Date().toISOString(), eventType: 'logSerializationError', correlationId, error: e && e.message }); } catch(_) {}
      }
    }

    function sendMessage(data) {
      const text = typeof data === "string" ? data : JSON.stringify(data);
      if (dataChannel && dataChannel.readyState === "open") {
        try {
          dataChannel.send(text);
        } catch (e) {
          log('Failed to send via dataChannel', e);
          safeStructLog('dataChannelSendError', { error: e && e.message }, 'Retry later, message queued'); // LOG ADDED: dataChannel send error
          pendingMessages.push(text);
        }
      } else {
        log("⏳ Queueing message...");
        safeStructLog('queueMessage', { length: text.length }, 'Will flush when channel opens'); // LOG ADDED: queue message
        pendingMessages.push(text);
      }
    }

    function flushQueue() {
      while (pendingMessages.length > 0) {
        if (!(dataChannel && dataChannel.readyState === "open")) break;
        const m = pendingMessages.shift();
        safeStructLog('flushQueuedMessage', { remaining: pendingMessages.length }, null); // LOG ADDED: flush queue
        sendMessage(m);
      }
    }

    function setupWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${location.host}`);

      ws.onopen = () => {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "register", clientId }));
            safeStructLog('wsRegisterSent', {}, null); // LOG ADDED: ws register
          }
        } catch (e) {
          log('Failed to send register', e);
          safeStructLog('wsRegisterError', { error: e && e.message }, 'Check WS server availability'); // LOG ADDED
        }
        log("🔌 WS connected");
        safeStructLog('wsOpen', {}, null); // LOG ADDED: ws open
        if (onStatusChange) onStatusChange('ws-connected');
        setupPeerConnection();
      };

      ws.onclose = () => {
        log("❌ WS closed");
        safeStructLog('wsClosed', {}, 'Will attempt reconnect if not closed manually'); // LOG ADDED
        if (onStatusChange) onStatusChange("ws-closed");
        if (!closedManually) {
          if (onStatusChange) onStatusChange("ws-reconnecting");
          setTimeout(() => {
            try { setupWebSocket(); } catch (e) { log('Reconnection failed', e); safeStructLog('wsReconnectError', { error: e && e.message }, 'Manual reload may be required'); }
          }, 2000);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          safeStructLog('wsMessage', { type: data && data.type }, null); // LOG ADDED
          if (data.type === "offer") {
            if (!peerConnection) setupPeerConnection();
            await peerConnection.setRemoteDescription(data.sdp);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "answer", sdp: peerConnection.localDescription, targetId: data.fromId }));
              safeStructLog('wsAnswerSent', {}, null); // LOG ADDED
            }
          } else if (data.type === "answer") {
            if (peerConnection) await peerConnection.setRemoteDescription(data.sdp);
            safeStructLog('remoteAnswerSet', {}, null); // LOG ADDED
          } else if (data.type === "ice") {
            if (peerConnection) await peerConnection.addIceCandidate(data.candidate);
            safeStructLog('remoteIceCandidateAdded', { candidate: data.candidate && data.candidate.candidate }, null); // LOG ADDED
          }
        } catch (e) {
          log('Error handling ws.onmessage', e);
          safeStructLog('wsMessageError', { error: e && e.message }, 'Verify signaling message format'); // LOG ADDED
        }
      };
    }

	function cleanupPeerConnection() {
		if (peerConnection) {
			try { peerConnection.onicecandidate = null; } catch (e) {}
			try { peerConnection.ondatachannel = null; } catch (e) {}
			try { peerConnection.onconnectionstatechange = null; } catch (e) {}
			try { peerConnection.close(); } catch (e) { log('Error closing peerConnection', e); safeStructLog('peerCloseError', { error: e && e.message }, null); }
		}
		peerConnection = null;
		dataChannel = null;
		isReady = false;
      safeStructLog('peerCleanup', {}, null); // LOG ADDED: cleanup
	}

	function setupPeerConnection() {
		log('setupPeerConnection()');
      safeStructLog('setupPeerConnection', {}, 'Creating new RTCPeerConnection'); // LOG ADDED
		if (peerConnection) {
			log('peerConnection.close()');
      safeStructLog('replacePeerConnection', {}, 'Previous connection will be replaced'); // LOG ADDED
			cleanupPeerConnection();
		}

      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          // Бесплатные публичные TURN серверы
          {
            urls: "turn:numb.viagenie.ca",
            credential: "muazkh",
            username: "webrtc@live.com"
          },
          {
            urls: "turn:192.158.29.39:3478?transport=udp",
            credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
            username: "28224511:1379330808"
          },
          {
            urls: "turn:192.158.29.39:3478?transport=tcp",
            credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
            username: "28224511:1379330808"
          }
        ],
        iceCandidatePoolSize: 10
      });

      peerConnection.onicecandidate = ({ candidate }) => {
        try {
          if (candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice", candidate, targetId }));
            safeStructLog('localIceCandidateSent', { candidate: candidate && candidate.candidate }, null); // LOG ADDED
          }
        } catch (e) {
          log('Failed to send ICE candidate', e);
          safeStructLog('localIceCandidateSendError', { error: e && e.message }, 'Check signaling channel'); // LOG ADDED
        }
      };

      // Добавляем диагностику ICE соединения
      peerConnection.onicecandidateerror = (event) => {
        // LOG ADDED: detailed ICE candidate error
        const { errorCode, errorText, url, hostCandidate } = event || {};
        safeStructLog('iceCandidateError', { errorCode, errorText, url, hostCandidate }, 'Verify STUN/TURN reachability / network');
        log('❌ ICE candidate error:', event && (event.errorText || 'Unknown ICE error'));
      };

      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        log(`🧊 ICE connection state: ${iceState}`);
        safeStructLog('iceConnectionStateChange', { state: iceState }, iceState === 'failed' ? 'Consider forcing restartIce / verify TURN' : null); // LOG ADDED

        if (iceState === 'failed') {
          log('❌ ICE connection failed - this usually means NAT/Firewall issues');
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        safeStructLog('iceGatheringStateChange', { state: peerConnection.iceGatheringState }, null); // LOG ADDED
        log(`🔍 ICE gathering state: ${peerConnection.iceGatheringState}`);
      };

      peerConnection.ondatachannel = (event) => {
        log("📥 Got data channel");
        safeStructLog('dataChannelReceived', { label: event && event.channel && event.channel.label }, null); // LOG ADDED
        setupDataChannel(event.channel);
      };

      peerConnection.onconnectionstatechange = () => {
        try {
          const state = peerConnection.connectionState;
          log("🔄 RTC state:", state);
          safeStructLog('connectionStateChange', { state }, null); // LOG ADDED

          if (state === 'connected') {
            reconnectAttempts = 0;
            reconnectDelay = 3000;
            safeStructLog('connectionStable', {}, null); // LOG ADDED
            if (onStatusChange) onStatusChange('connected');
          } else if ((state === "disconnected" || state === "failed" || state === 'closed') && !closedManually) {
            if (reconnectAttempts >= maxReconnectAttempts) {
              log(`❌ Max reconnect attempts (${maxReconnectAttempts}) reached. Stopping.`);
              safeStructLog('reconnectAborted', { attempts: reconnectAttempts }, 'Reload page or check network'); // LOG ADDED
              if (onStatusChange) onStatusChange('connection-failed');
              return;
            }

            reconnectAttempts++;
            log(`🔄 Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
            safeStructLog('reconnectAttempt', { attempt: reconnectAttempts, max: maxReconnectAttempts, delayMs: reconnectDelay, reason: state }, 'Await next attempt'); // LOG ADDED

            if (onStatusChange) onStatusChange("reconnecting");

            setTimeout(() => {
              try {
                setupPeerConnection();
              } catch (e) {
                log('Re-setup failed', e);
                safeStructLog('reconnectSetupError', { error: e && e.message }, 'Manual reload may be required'); // LOG ADDED
                if (onStatusChange) onStatusChange('connection-failed');
              }
            }, reconnectDelay);

            reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
          }
        } catch (e) { log('onconnectionstatechange handler error', e); safeStructLog('connectionStateHandlerError', { error: e && e.message }, null); }
      };

//      if (clientId < targetId) {
      if (isInitiatorOfDataChannel) {
        try {
          dataChannel = peerConnection.createDataChannel("chat");
          safeStructLog('dataChannelCreated', { label: dataChannel && dataChannel.label }, null); // LOG ADDED
          setupDataChannel(dataChannel);
          (async () => {
            try {
              const offer = await peerConnection.createOffer();
              safeStructLog('offerCreated', { hasSdp: !!offer && !!offer.sdp }, null); // LOG ADDED
              await peerConnection.setLocalDescription(offer);
              safeStructLog('localDescriptionSet', { type: offer && offer.type }, null); // LOG ADDED
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "offer", sdp: peerConnection.localDescription, targetId }));
                safeStructLog('offerSent', {}, null); // LOG ADDED
              } else {
                log('WS not open, cannot send offer', ws && ws.readyState);
                safeStructLog('offerSendSkipped', { wsState: ws && ws.readyState }, 'Wait for WS reconnect'); // LOG ADDED
              }
            } catch (e) {
              log('Failed to create/send offer', e);
              safeStructLog('offerError', { error: e && e.message }, 'Check local media / network'); // LOG ADDED
              if (onStatusChange) onStatusChange('failed');
            }
          })();
        } catch (e) {
          log('Error during initiator setup', e);
          safeStructLog('initiatorSetupError', { error: e && e.message }, null); // LOG ADDED
        }
      }
    }

    function setupDataChannel(channel) {
      dataChannel = channel;
      dataChannel.onopen = () => {
        isReady = true;
        safeStructLog('dataChannelOpen', { label: channel && channel.label }, 'Ready to send messages'); // LOG ADDED
        if (onStatusChange) onStatusChange("connected");
        flushQueue();
      };
      dataChannel.onmessage = (e) => {
        safeStructLog('dataChannelMessage', { length: e && e.data && e.data.length }, null); // LOG ADDED
        if (onMessageCallback) {
          try {
            const parsed = JSON.parse(e.data);
            onMessageCallback(parsed);
          } catch {
            onMessageCallback(e.data);
          }
        }
      };
      dataChannel.onclose = () => {
        isReady = false;
        safeStructLog('dataChannelClose', {}, null); // LOG ADDED
        if (onStatusChange) onStatusChange("disconnected");
      };
      dataChannel.onerror = (err) => {
        log('DataChannel error', err);
        safeStructLog('dataChannelError', { error: err && err.message }, 'Inspect network / ICE'); // LOG ADDED
      };
    }

    function close() {
	log('close()');
      closedManually = true;
      safeStructLog('manualClose', {}, null); // LOG ADDED
      if (onStatusChange) onStatusChange("closed");
      try { if (dataChannel) dataChannel.close(); } catch (e) { log('Error closing dataChannel', e); safeStructLog('dataChannelCloseError', { error: e && e.message }, null); }
      cleanupPeerConnection();
      try { if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close(); } catch (e) { log('Error closing ws', e); safeStructLog('wsCloseError', { error: e && e.message }, null); }
    }

    // 🟢 ВАЖЛИВО: запускаємо WebSocket підключення
    setupWebSocket();

    // ✅ Повертаємо API
    return {
      send: sendMessage,
      isConnected: () => isReady,
      close
    };
  }

  // Async обгортка
  function startP2PConnectionAsync(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback, onStatusChange) {
    return new Promise((resolve, reject) => {
      const connection = startP2PConnection(
        clientId,
        targetId,
        isInitiatorOfDataChannel,
        onMessageCallback,
        (status) => {
          if (onStatusChange) onStatusChange(status);

          if (status === 'connected') {
            resolve(connection);
          }

          // Опціонально: відхиляємо, якщо зʼєднання не вдалося
          if (status === 'failed' || status === 'closed') {
            reject(new Error(`P2P connection failed with status: ${status}`));
          }
        }
      );
    });
  }

  // Глобальне API
  global.startP2PConnection = startP2PConnection;
  global.startP2PConnectionAsync = startP2PConnectionAsync;
})(this);
