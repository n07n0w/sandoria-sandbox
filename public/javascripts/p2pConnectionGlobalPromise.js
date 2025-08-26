(function (global) {
  function startP2PConnection(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback, onStatusChange) {
    let ws, peerConnection, dataChannel;
    let isReady = false;
    let closedManually = false;
    const pendingMessages = [];

//    const log = msg => console.log(`[${clientId}] ${msg}`);
	const log = msg => console.trace(`[${clientId}] ${msg}`);

    function sendMessage(data) {
      const text = typeof data === "string" ? data : JSON.stringify(data);
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(text);
      } else {
        log("⏳ Queueing message...");
        pendingMessages.push(text);
      }
    }

    function flushQueue() {
      while (pendingMessages.length > 0) {
        sendMessage(pendingMessages.shift());
      }
    }

    function setupWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${location.host}`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "register", clientId }));
        log("🔌 WS connected");
        setupPeerConnection();
      };

      ws.onclose = () => {
        log("❌ WS closed");
        if (onStatusChange) onStatusChange("ws-closed");
        if (!closedManually) {
          if (onStatusChange) onStatusChange("ws-reconnecting");
          setTimeout(setupWebSocket, 2000);
        }
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "offer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: peerConnection.localDescription, targetId: data.fromId }));
        } else if (data.type === "answer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === "ice") {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };
    }

	function setupPeerConnection() {
		log('setupPeerConnection()');
		if (peerConnection) {
			log('peerConnection.close()');
			peerConnection.close();
		}

      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          ws.send(JSON.stringify({ type: "ice", candidate, targetId }));
        }
      };

      peerConnection.ondatachannel = (event) => {
        log("📥 Got data channel");
        setupDataChannel(event.channel);
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        log("🔄 RTC state:", state);
        if ((state === "disconnected" || state === "failed") && !closedManually) {
          if (onStatusChange) onStatusChange("reconnecting");
          setTimeout(() => setupPeerConnection(), 3000);
        }
      };

//      if (clientId < targetId) {
      if (isInitiatorOfDataChannel) {
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannel(dataChannel);
        peerConnection.createOffer()
          .then(offer => peerConnection.setLocalDescription(offer))
          .then(() => {
            ws.send(JSON.stringify({ type: "offer", sdp: peerConnection.localDescription, targetId }));
          });
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
    }

    function close() {
	log('close()');
      closedManually = true;
      if (onStatusChange) onStatusChange("closed");
      if (dataChannel) dataChannel.close();
      if (peerConnection) peerConnection.close();
      if (ws) ws.close();
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
