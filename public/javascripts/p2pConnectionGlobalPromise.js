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
		}
	};

    function sendMessage(data) {
      const text = typeof data === "string" ? data : JSON.stringify(data);
      if (dataChannel && dataChannel.readyState === "open") {
        try {
          dataChannel.send(text);
        } catch (e) {
          log('Failed to send via dataChannel', e);
          pendingMessages.push(text);
        }
      } else {
        log("⏳ Queueing message...");
        pendingMessages.push(text);
      }
    }

    function flushQueue() {
      while (pendingMessages.length > 0) {
        // sendMessage will re-queue if channel not ready, but we prefer to break to avoid tight loop
        if (!(dataChannel && dataChannel.readyState === "open")) break;
        sendMessage(pendingMessages.shift());
      }
    }

    function setupWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${location.host}`);

      ws.onopen = () => {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "register", clientId }));
          }
        } catch (e) {
          log('Failed to send register', e);
        }
        log("🔌 WS connected");
        if (onStatusChange) onStatusChange('ws-connected');
        setupPeerConnection();
      };

      ws.onclose = () => {
        log("❌ WS closed");
        if (onStatusChange) onStatusChange("ws-closed");
        if (!closedManually) {
          if (onStatusChange) onStatusChange("ws-reconnecting");
          setTimeout(() => {
            try { setupWebSocket(); } catch (e) { log('Reconnection failed', e); }
          }, 2000);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "offer") {
            // if peerConnection is not ready, create it
            if (!peerConnection) setupPeerConnection();
            await peerConnection.setRemoteDescription(data.sdp);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "answer", sdp: peerConnection.localDescription, targetId: data.fromId }));
            }
          } else if (data.type === "answer") {
            if (peerConnection) await peerConnection.setRemoteDescription(data.sdp);
          } else if (data.type === "ice") {
            if (peerConnection) await peerConnection.addIceCandidate(data.candidate);
          }
        } catch (e) {
          log('Error handling ws.onmessage', e);
        }
      };
    }

	function cleanupPeerConnection() {
		if (peerConnection) {
			try { peerConnection.onicecandidate = null; } catch (e) {}
			try { peerConnection.ondatachannel = null; } catch (e) {}
			try { peerConnection.onconnectionstatechange = null; } catch (e) {}
			try { peerConnection.close(); } catch (e) { log('Error closing peerConnection', e); }
		}
		peerConnection = null;
		dataChannel = null;
		isReady = false;
	}

	function setupPeerConnection() {
		log('setupPeerConnection()');
		// Close and cleanup previous connection if exists
		if (peerConnection) {
			log('peerConnection.close()');
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
          }
        } catch (e) {
          log('Failed to send ICE candidate', e);
        }
      };

      // Добавляем диагностику ICE соединения
      peerConnection.onicecandidateerror = (event) => {
        log('❌ ICE candidate error:', event.errorText || 'Unknown ICE error');
      };

      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        log(`🧊 ICE connection state: ${iceState}`);

        if (iceState === 'failed') {
          log('❌ ICE connection failed - this usually means NAT/Firewall issues');
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        log(`🔍 ICE gathering state: ${peerConnection.iceGatheringState}`);
      };

      peerConnection.ondatachannel = (event) => {
        log("📥 Got data channel");
        setupDataChannel(event.channel);
      };

      peerConnection.onconnectionstatechange = () => {
        try {
          const state = peerConnection.connectionState;
          log("🔄 RTC state:", state);

          if (state === 'connected') {
            // Сбрасываем счетчик при успешном подключении
            reconnectAttempts = 0;
            reconnectDelay = 3000;
            if (onStatusChange) onStatusChange('connected');
          } else if ((state === "disconnected" || state === "failed" || state === 'closed') && !closedManually) {
            if (reconnectAttempts >= maxReconnectAttempts) {
              log(`❌ Max reconnect attempts (${maxReconnectAttempts}) reached. Stopping.`);
              if (onStatusChange) onStatusChange('connection-failed');
              return;
            }

            reconnectAttempts++;
            log(`🔄 Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay}ms`);

            if (onStatusChange) onStatusChange("reconnecting");

            setTimeout(() => {
              try {
                setupPeerConnection();
              } catch (e) {
                log('Re-setup failed', e);
                if (onStatusChange) onStatusChange('connection-failed');
              }
            }, reconnectDelay);

            // Увеличиваем задержку для следующей попытки (экспоненциальная задержка)
            reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
          }
        } catch (e) { log('onconnectionstatechange handler error', e); }
      };

//      if (clientId < targetId) {
      if (isInitiatorOfDataChannel) {
        try {
          dataChannel = peerConnection.createDataChannel("chat");
          setupDataChannel(dataChannel);
          (async () => {
            try {
              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "offer", sdp: peerConnection.localDescription, targetId }));
              } else {
                log('WS not open, cannot send offer', ws && ws.readyState);
              }
            } catch (e) {
              log('Failed to create/send offer', e);
              if (onStatusChange) onStatusChange('failed');
            }
          })();
        } catch (e) {
          log('Error during initiator setup', e);
        }
      }
    }

    function setupDataChannel(channel) {
      dataChannel = channel;
      dataChannel.onopen = () => {
        isReady = true;
        if (onStatusChange) onStatusChange("connected");
        flushQueue();
      };
      dataChannel.onmessage = (e) => {
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
        if (onStatusChange) onStatusChange("disconnected");
      };
      dataChannel.onerror = (err) => {
        log('DataChannel error', err);
      };
    }

    function close() {
	log('close()');
      closedManually = true;
      if (onStatusChange) onStatusChange("closed");
      try { if (dataChannel) dataChannel.close(); } catch (e) { log('Error closing dataChannel', e); }
      cleanupPeerConnection();
      try { if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close(); } catch (e) { log('Error closing ws', e); }
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
