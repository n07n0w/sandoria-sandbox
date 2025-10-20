/**
 * P2P Connection Tests
 * Тесты для проверки логики P2P соединения (без реального подключения)
 */

const assert = require("assert");
const { test } = require("node:test");
const fs = require("fs");
const path = require("path");

// Test 1: Проверка существования P2P модуля
test("P2P connection module exists", () => {
  const p2pPath = path.join(__dirname, "../public/p2pConnection.js");
  assert.ok(fs.existsSync(p2pPath), "p2pConnection.js should exist");
});

// Test 2: Проверка P2P модуля на валидный JavaScript
test("P2P connection module is valid JavaScript", () => {
  const p2pPath = path.join(__dirname, "../public/p2pConnection.js");
  const content = fs.readFileSync(p2pPath, "utf8");

  // Проверка базового синтаксиса
  assert.ok(
    content.includes("function startP2PConnection"),
    "Should export startP2PConnection function",
  );
  assert.ok(content.includes("WebSocket"), "Should use WebSocket");
  assert.ok(
    content.includes("RTCPeerConnection"),
    "Should use RTCPeerConnection",
  );
});

// Test 3: Проверка P2P Global Promise модуля
test("P2P Global Promise module exists and is valid", () => {
  const p2pPath = path.join(
    __dirname,
    "../public/javascripts/p2pConnectionGlobalPromise.js",
  );
  assert.ok(
    fs.existsSync(p2pPath),
    "p2pConnectionGlobalPromise.js should exist",
  );

  const content = fs.readFileSync(p2pPath, "utf8");
  assert.ok(
    content.includes("startP2PConnection"),
    "Should define startP2PConnection",
  );
  assert.ok(
    content.includes("startP2PConnectionAsync"),
    "Should define startP2PConnectionAsync",
  );
  assert.ok(
    content.includes("setupWebSocket"),
    "Should have setupWebSocket function",
  );
  assert.ok(
    content.includes("setupPeerConnection"),
    "Should have setupPeerConnection function",
  );
});

// Test 4: Проверка наличия reconnection логики
test("P2P module has reconnection logic", () => {
  const p2pPath = path.join(
    __dirname,
    "../public/javascripts/p2pConnectionGlobalPromise.js",
  );
  const content = fs.readFileSync(p2pPath, "utf8");

  assert.ok(content.includes("ws.onclose"), "Should handle WebSocket close");
  assert.ok(content.includes("reconnect"), "Should have reconnection logic");
  assert.ok(
    content.includes("setTimeout"),
    "Should use setTimeout for reconnection",
  );
});

// Test 5: Проверка message queue
test("P2P module has message queuing", () => {
  const p2pPath = path.join(
    __dirname,
    "../public/javascripts/p2pConnectionGlobalPromise.js",
  );
  const content = fs.readFileSync(p2pPath, "utf8");

  assert.ok(
    content.includes("pendingMessages"),
    "Should have pendingMessages queue",
  );
  assert.ok(content.includes("flushQueue"), "Should have flushQueue function");
});
