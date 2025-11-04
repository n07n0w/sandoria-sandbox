// ========== ЛОГГЕР (залишив твій варіант) ==========
(function() {
  const originalLog = console.log;
  console.log = function(...args) {
    const now = new Date();
    const time = now.toISOString().split('T')[1].replace('Z', ''); // 12:34:56.789
    const stack = new Error().stack
      .split('\n')
      .slice(2, 5)
      .join('\n');
    originalLog(`%c[${time}]`, 'color: #888', ...args);
    originalLog('%cStack trace:', 'color: gray');
    originalLog(stack);
  };
})();


// ========== P2P MODULE ==========
(function (global) {
  function startP2PConnection(
    clientId,
    targetId,
    isInitiatorOfDataChannel,
    onMessageCallback,
    onStatusChange,
  ) {
    let ws = null;
    let peerConnection = null;
    let dataChannel = null;
    let isReady = false;
    let closedManually = false;
    let reconnecting = false;
    const pendingMessages = [];

    const RECONNECT_DELAY = 2000; // ms
    const log = (msg, ...args) => console.log(`[${clientId}] ${msg}`, ...args);

    function sendMessage(data) {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(text);
        } catch (e) {
          log('❌ Failed to send message', e);
          pendingMessages.push(text);
        }
      } else {
        log('⏳ Queueing message...');
        pendingMessages.push(text);
      }
    }

    function flushQueue() {
      while (pendingMessages.length > 0 && dataChannel?.readyState === 'open') {
        dataChannel.send(pendingMessages.shift());
      }
    }

    function cleanupPeerConnection() {
      try {
        peerConnection?.close();
      } catch {}
      peerConnection = null;
      dataChannel = null;
      isReady = false;
    }

    function cleanupWebSocket() {
      try {
        ws?.close();
      } catch {}
      ws = null;
    }

    // ---------- PeerConnection ----------
    function setupPeerConnection() {
      log('setupPeerConnection()');
      cleanupPeerConnection();

      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ice', candidate, targetId }));
        }
      };

      peerConnection.ondatachannel = (event) => {
        log('📥 Got remote data channel');
        setupDataChannel(event.channel);
      };

      peerConnection.onconnectionstatechange = async () => {
        const state = peerConnection.connectionState;
        log('🔄 RTC state:', state);

        if (state === 'connected') {
          isReady = true;
          flushQueue();
          onStatusChange?.('connected');
        } else if (
          ['disconnected', 'failed', 'closed'].includes(state) &&
          !closedManually
        ) {
          onStatusChange?.('reconnecting');
          cleanupPeerConnection();
          setTimeout(() => {
            if (!closedManually) setupPeerConnection();
          }, RECONNECT_DELAY);
        }
      };

      if (isInitiatorOfDataChannel) {
        try {
          dataChannel = peerConnection.createDataChannel('chat');
          setupDataChannel(dataChannel);
          (async () => {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'offer',
                  sdp: peerConnection.localDescription,
                  targetId,
                }),
              );
            } else {
              log('⚠️ WS not ready to send offer');
            }
          })();
        } catch (e) {
          log('❌ Error creating offer', e);
          onStatusChange?.('failed');
        }
      }
    }

    function setupDataChannel(channel) {
      dataChannel = channel;
      dataChannel.onopen = () => {
        isReady = true;
        onStatusChange?.('connected');
        flushQueue();
      };
      dataChannel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          onMessageCallback?.(msg);
        } catch {
          onMessageCallback?.(e.data);
        }
      };
      dataChannel.onclose = () => {
        isReady = false;
        onStatusChange?.('disconnected');
      };
      dataChannel.onerror = (err) => log('⚠️ DataChannel error', err);
    }

    // ---------- WebSocket ----------
    function setupWebSocket() {
      if (reconnecting) return;
      reconnecting = true;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      cleanupWebSocket();
      ws = new WebSocket(`${protocol}://${location.host}`);

      ws.onopen = () => {
        reconnecting = false;
        log('🔌 WS connected');
        onStatusChange?.('ws-connected');
        ws.send(JSON.stringify({ type: 'register', clientId }));
        setupPeerConnection();
      };

      ws.onclose = () => {
        log('❌ WS closed');
        onStatusChange?.('ws-closed');
        if (!closedManually) {
          onStatusChange?.('ws-reconnecting');
          setTimeout(() => {
            reconnecting = false;
            setupWebSocket();
          }, RECONNECT_DELAY);
        }
      };

      ws.onerror = (err) => {
        log('⚠️ WS error', err);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'offer':
              if (!peerConnection) setupPeerConnection();
              await peerConnection.setRemoteDescription(data.sdp);
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              ws.send(
                JSON.stringify({
                  type: 'answer',
                  sdp: peerConnection.localDescription,
                  targetId: data.fromId,
                }),
              );
              break;
            case 'answer':
              if (peerConnection) {
                await peerConnection.setRemoteDescription(data.sdp);
              }
              break;
            case 'ice':
              if (peerConnection && data.candidate) {
                await peerConnection.addIceCandidate(data.candidate);
              }
              break;
          }
        } catch (e) {
          log('Error handling WS message', e);
        }
      };
    }

    function close() {
      log('close()');
      closedManually = true;
      onStatusChange?.('closed');
      cleanupPeerConnection();
      cleanupWebSocket();
    }

    setupWebSocket();

    return {
      send: sendMessage,
      isConnected: () => isReady,
      close,
    };
  }

  // ---------- Promise-based wrapper ----------
  function startP2PConnectionAsync(
    clientId,
    targetId,
    isInitiatorOfDataChannel,
    onMessageCallback,
    onStatusChange,
  ) {
    return new Promise((resolve, reject) => {
      const connection = startP2PConnection(
        clientId,
        targetId,
        isInitiatorOfDataChannel,
        onMessageCallback,
        (status) => {
          onStatusChange?.(status);
          if (status === 'connected') resolve(connection);
          if (['failed', 'closed'].includes(status))
            reject(new Error(`P2P failed: ${status}`));
        },
      );
    });
  }

  global.startP2PConnection = startP2PConnection;
  global.startP2PConnectionAsync = startP2PConnectionAsync;
})(this);
