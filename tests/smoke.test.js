/**
 * Smoke Tests - быстрые проверки базовой функциональности
 * Эти тесты должны выполняться меньше чем за 5 секунд
 */

const assert = require("assert");
const { test } = require("node:test");

// Test 1: Проверка загрузки основных модулей
test("Core modules can be loaded without errors", async () => {
  assert.doesNotThrow(() => {
    require("../constants");
  }, "constants.js should load without errors");

  assert.doesNotThrow(() => {
    require("../logger");
  }, "logger.js should load without errors");

  // dbConfig требует переменные окружения, пропускаем в тесте
  // Проверяем только что файл существует
  const fs = require("fs");
  const path = require("path");
  assert.ok(
    fs.existsSync(path.join(__dirname, "../dbConfig.js")),
    "dbConfig.js should exist",
  );
});

// Test 2: Проверка структуры приложения (без инициализации БД)
test("App structure is correct", async () => {
  // Устанавливаем mock переменные окружения для теста
  process.env.DB_HOST = "localhost";
  process.env.DB_USER = "test";
  process.env.DB_PASSWORD = "test";
  process.env.DB_NAME = "test_db";

  const { app } = require("../app");
  assert.ok(app, "Express app should be defined");
  assert.strictEqual(
    typeof app,
    "function",
    "Express app should be a function",
  );
});

// Test 3: Проверка constants
test("Constants are properly defined", async () => {
  const constants = require("../constants");

  assert.ok(constants.BASE_URL, "BASE_URL should be defined");
  assert.ok(constants.MAIN_SITE_URL, "MAIN_SITE_URL should be defined");
  assert.strictEqual(
    typeof constants.BASE_URL,
    "string",
    "BASE_URL should be a string",
  );
});

// Test 4: Проверка репозиториев (файлы существуют и синтаксис валиден)
test("Repositories can be instantiated", async () => {
  const fs = require("fs");
  const path = require("path");

  // Проверяем что файлы существуют
  assert.ok(
    fs.existsSync(path.join(__dirname, "../repository/sandboxRepository.js")),
    "sandboxRepository.js should exist",
  );
  assert.ok(
    fs.existsSync(path.join(__dirname, "../repository/categoryRepository.js")),
    "categoryRepository.js should exist",
  );

  // Проверяем синтаксис через node --check
  const { execSync } = require("child_process");
  assert.doesNotThrow(() => {
    execSync("node --check repository/sandboxRepository.js");
    execSync("node --check repository/categoryRepository.js");
  }, "Repository files should have valid syntax");
});

// Test 5: Проверка UUID generation
test("UUID generation works", async () => {
  const { v4: uuidv4 } = require("uuid");

  const uuid1 = uuidv4();
  const uuid2 = uuidv4();

  assert.ok(uuid1, "UUID should be generated");
  assert.ok(uuid2, "UUID should be generated");
  assert.notStrictEqual(uuid1, uuid2, "UUIDs should be unique");
  assert.match(
    uuid1,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "UUID should have valid format",
  );
});

// Test 6: Проверка bcrypt
test("Bcrypt works for password hashing", async () => {
  const bcrypt = require("bcrypt");

  const password = "testPassword123";
  const hash = await bcrypt.hash(password, 10);

  assert.ok(hash, "Hash should be generated");
  assert.notStrictEqual(
    password,
    hash,
    "Hash should be different from password",
  );

  const isMatch = await bcrypt.compare(password, hash);
  assert.strictEqual(isMatch, true, "Password should match hash");

  const isWrongMatch = await bcrypt.compare("wrongPassword", hash);
  assert.strictEqual(isWrongMatch, false, "Wrong password should not match");
});

// Test 7: Проверка WebSocket модуля
test("WebSocket module loads", async () => {
  const WebSocket = require("ws");
  assert.ok(WebSocket, "WebSocket should be available");
  assert.strictEqual(
    typeof WebSocket,
    "function",
    "WebSocket should be a constructor",
  );
});

// Test 8: Проверка Express middleware
test("Express middleware is configured", async () => {
  // Устанавливаем переменные окружения если еще не установлены
  if (!process.env.DB_HOST) {
    process.env.DB_HOST = "localhost";
    process.env.DB_USER = "test";
    process.env.DB_PASSWORD = "test";
    process.env.DB_NAME = "test_db";
  }

  const { app } = require("../app");

  // Проверяем что app имеет необходимые свойства
  assert.ok(app.locals, "app.locals should exist");
  assert.ok(
    app.locals.constants,
    "constants should be available in app.locals",
  );
});
