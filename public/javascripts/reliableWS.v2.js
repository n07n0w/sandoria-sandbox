(function () {
    // Expose globally
    window.createReliableWS = function (url, mySessionId, peerSessionId, options = {}) {
        // --------------- defaults / config ---------------
        const config = {
            ack: true,
            heartbeat: true,
            heartbeatInterval: 15000,
            reconnectDelay: 1000,
            maxReconnectDelay: 10000,
            resendInterval: 500,
            autoTarget: true, // if true, add `to: peerSessionId` automatically
            ...options
        };

        // default url -> same host/protocol as page
        if (!url) {
            const proto = location.protocol === "https:" ? "wss" : "ws";
            url = `${proto}://${location.host}`;
        }

        // --------------- internals ---------------
        let socket = null;
        let reconnectTimer = null;
        let resendTimer = null;
        let heartbeatTimer = null;
        let currentReconnectDelay = config.reconnectDelay;

        let isConnected = false;
        let isRegistered = false;

        const STORAGE_KEY = `pendingWS_${mySessionId || "unknown"}`;

        // pending: { msgId -> fullPayload }
        const pending = {};

        // handlers (single functions)
        const handlers = {
            message: null,
            presence: null,
            connected: null,
            disconnected: null,
            reconnect: null
        };

        // safe uuid
        function makeId() {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            // fallback
            return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        }

        // --------------- sessionStorage queue ---------------
        function savePending() {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
            } catch (e) {
                console.warn("reliableWS: failed to save pending", e);
            }
        }

        function loadPending() {
            try {
                const raw = sessionStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const obj = JSON.parse(raw);
                // copy into pending
                for (const k in obj) {
                    if (!pending[k]) pending[k] = obj[k];
                }
            } catch (e) {
                console.warn("reliableWS: failed to load pending", e);
            }
        }
        loadPending();

        // --------------- helpers ---------------
        function safeSendRaw(o) {
            if (!socket || socket.readyState !== WebSocket.OPEN) return false;
            try {
                socket.send(JSON.stringify(o));
                return true;
            } catch (e) {
                console.warn("reliableWS: send failed", e);
                return false;
            }
        }

        // --------------- send API ---------------
        // send(msgObject, opts = { to: '...', skipQueue: false })
        // msgObject is the payload body (must not include id/from/to ideally)
        function send(msgObject = {}, opts = {}) {
            const id = makeId();

            const payload = {
                id,
                from: mySessionId,
                // auto-add to unless explicitly provided in opts or in msgObject
                to: (opts.to !== undefined) ? opts.to : (msgObject.to !== undefined ? msgObject.to : (config.autoTarget ? peerSessionId : undefined)),
                // include rest of message fields
                ...msgObject
            };

            // If ACK enabled -> add to pending queue (so it will be retried)
            if (config.ack) {
                pending[id] = payload;
                savePending();
            }

            // Try to send now (if socket open)
            safeSendRaw(payload);

            return id;
        }

        // --------------- handle incoming ---------------
        function handleIncoming(raw) {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch (e) {
                // ignore non-json
                return;
            }

            // handle heartbeat ping/pong
            if (msg.type === "ping") {
                // reply with pong
                safeSendRaw({ type: "pong", ts: Date.now(), from: mySessionId });
                return;
            }
            if (msg.type === "pong") {
                // ignore or could update last-seen timestamp
                return;
            }

            // presence (server-originated presence event)
            if (msg.type === "presence") {
                if (typeof handlers.presence === "function") handlers.presence(msg);
                return;
            }

            // ACK received: our peer/server confirms message delivery
            // expected format: { type: "ack", ackFor: "<messageId>", from: "...", to: "..." }
            if (msg.type === "ack" && msg.ackFor) {
                const ackId = msg.ackFor;
                if (pending[ackId]) {
                    delete pending[ackId];
                    savePending();
                }
                return;
            }

            // For any normal incoming message that has id -> send ack back
            // (we send ack so sender can remove it from pending)
            if (config.ack && msg.id && msg.from) {
                // reply ack to sender (server will forward it)
                const ack = {
                    type: "ack",
                    ackFor: msg.id,
                    from: mySessionId,
                    to: msg.from
                };
                safeSendRaw(ack);
            }

            // Normal message -> deliver to handler
            if (typeof handlers.message === "function") {
                handlers.message(msg);
            }
        }

        // --------------- resend logic ---------------
        function startResendTimer() {
            stopResendTimer();
            if (!config.ack) return;

            resendTimer = setInterval(() => {
                if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;
                for (const id in pending) {
                    const p = pending[id];
                    if (!p) continue;
                    try {
                        socket.send(JSON.stringify(p));
                    } catch (e) {
                        // ignore send failure; will retry next tick
                    }
                }
            }, config.resendInterval);
        }

        function stopResendTimer() {
            if (resendTimer) {
                clearInterval(resendTimer);
                resendTimer = null;
            }
        }

        // --------------- heartbeat ---------------
        function startHeartbeat() {
            stopHeartbeat();
            if (!config.heartbeat) return;

            heartbeatTimer = setInterval(() => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    safeSendRaw({ type: "ping", from: mySessionId, ts: Date.now() });
                }
            }, config.heartbeatInterval);
        }

        function stopHeartbeat() {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        }

        // --------------- connect / reconnect ---------------
        function scheduleReconnect() {
            if (reconnectTimer) return;
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (typeof handlers.reconnect === "function") handlers.reconnect();
                connect(true);
            }, currentReconnectDelay);

            // exponential backoff-ish
            currentReconnectDelay = Math.min(currentReconnectDelay * 1.5, config.maxReconnectDelay);
        }

        function clearReconnect() {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            currentReconnectDelay = config.reconnectDelay;
        }

        function registerWithServer() {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            // register action expected by server: { action: "register", sessionId: "..." }
            safeSendRaw({ action: "register", sessionId: mySessionId });
            isRegistered = true;
        }

        function resendPendingOnceOnOpen() {
            // send all pending right away once socket opens
            if (!config.ack) return;
            if (!socket || socket.readyState !== WebSocket.OPEN) return;

            for (const id in pending) {
                const p = pending[id];
                if (!p) continue;
                try {
                    socket.send(JSON.stringify(p));
                } catch (e) { /* ignore */ }
            }
        }

        function connect(isReconnect) {
            try {
                socket = new WebSocket(url);
            } catch (e) {
                // invalid url / immediate failure -> schedule reconnect
                scheduleReconnect();
                return;
            }

            socket.onopen = function () {
                isConnected = true;
                clearReconnect();

                // reset reconnect delay to initial
                currentReconnectDelay = config.reconnectDelay;

                // register
                registerWithServer();

                // start heartbeat, resend timer
                startHeartbeat();
                startResendTimer();

                // immediately resend stored pending once
                resendPendingOnceOnOpen();

                // emit connected / reconnect handlers
                if (isReconnect) {
                    if (typeof handlers.reconnect === "function") handlers.reconnect();
                } else {
                    if (typeof handlers.connected === "function") handlers.connected();
                }
            };

            socket.onmessage = function (evt) {
                handleIncoming(evt.data);
            };

            socket.onclose = function () {
                isConnected = false;
                isRegistered = false;

                stopHeartbeat();
                stopResendTimer();

                if (typeof handlers.disconnected === "function") handlers.disconnected();

                // schedule reconnect
                scheduleReconnect();
            };

            socket.onerror = function (err) {
                // ensure socket closed -> will trigger onclose and reconnect
                try { socket.close(); } catch (e) {}
            };
        }

        // start initial connect
        connect(false);

        // --------------- public API ---------------
        function close() {
            // stop timers
            stopHeartbeat();
            stopResendTimer();
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            try {
                if (socket) socket.close();
            } catch (e) {}
            isConnected = false;
            isRegistered = false;
        }

        function onMessage(fn) { handlers.message = fn; }
        function onPresence(fn) { handlers.presence = fn; }
        function onConnected(fn) { handlers.connected = fn; }
        function onDisconnected(fn) { handlers.disconnected = fn; }
        function onReconnect(fn) { handlers.reconnect = fn; }

        // convenience: ability to override peerSessionId at runtime
        function setPeerSessionId(newId) { peerSessionId = newId; }

        // expose state check
        function getIsConnected() { return Boolean(isConnected && socket && socket.readyState === WebSocket.OPEN); }

        // --------------- return object ---------------
        return {
            send,               // send(payloadObject, opts?)
            close,
            onMessage,
            onPresence,
            onConnected,
            onDisconnected,
            onReconnect,
            setPeerSessionId,
            isConnected: getIsConnected
        };
    };
})();
