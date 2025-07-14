export function startP2PConnection(clientId, targetId, isInitiatorOfDataChannel, onMessageCallback) {
  let ws, peerConnection, dataChannel;
  let isReady = false;
  let closedManually = false;
  const pendingMessages = [];

  const log = msg => console.log(`[${clientId}] ${msg}`);

  function sendMessage(msg) {
    const text = typeof msg === "string" ? msg : JSON.stringify(msg);
    if (dataChannel && dataChannel.readyState === "open") {
      dataChannel.send(text);
    } else {
      log("⏳ Channel not ready, queueing message...");
      pendingMessages.push(msg);
    }
  }

  function flushQueue() {
    while (pendingMessages.length > 0) {
      const msg = pendingMessages.shift();
      sendMessage(msg);
    }
  }

  function setupWebSocket() {
    ws = new WebSocket(`ws://${location.host}`);

    ws.onopen = () => {
      log("🔌 WebSocket connected");
      ws.send(JSON.stringify({ type: "register", clientId }));
      setupPeerConnection();
    };

    ws.onclose = () => {
      log("❌ WebSocket closed");
      if (!closedManually) {
        log("🔁 Reconnecting WebSocket in 2s...");
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
      }

      if (data.type === "answer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }

      if (data.type === "ice") {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };
  }

  function setupPeerConnection() {
    if (peerConnection) {
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
      log("📥 Received data channel");
      setupDataChannel(event.channel);
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      log(`🔄 Peer connection state: ${state}`);

      if (state === "failed" || state === "disconnected") {
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
      log("✅ DataChannel open");
      flushQueue();
    };

    dataChannel.onmessage = (event) => {
      log("📨 Message from peer: " + event.data);
      if (onMessageCallback) onMessageCallback(event.data);
    };

    dataChannel.onclose = () => {
      log("❌ DataChannel closed");
      isReady = false;
    };
  }

  function close() {
    closedManually = true;
    log("🛑 Closing connection manually");

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
