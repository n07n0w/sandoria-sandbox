# 🎯 Next Steps After Testing Setup

## ✅ Что уже сделано

1. ✅ GitHub Actions workflow настроен
2. ✅ 18 тестов (13 smoke + 5 P2P) работают
3. ✅ ESLint настроен (информативный режим)
4. ✅ Документация создана
5. ✅ npm scripts готовы к использованию

---

## 🚀 Что делать дальше

### 1. Закоммитить и запушить изменения

```bash
# Добавить все файлы
git add .

# Создать коммит
git commit -m "feat: add CI/CD testing setup with GitHub Actions

- Add GitHub Actions workflow for quick CI tests
- Add 18 automated tests (smoke + P2P)
- Configure ESLint for code quality
- Add comprehensive testing documentation
- Update package.json with test scripts

Tests run in < 3 minutes on all branches"

# Запушить на GitHub
git push origin dev
```

### 2. Проверить что CI работает

1. Перейдите на https://github.com/n07n0w/sandoria-sandbox/actions
2. Найдите workflow "Quick CI Tests"
3. Убедитесь что он запустился автоматически
4. Проверьте что все шаги зеленые ✅

### 3. Добавить badge в README (опционально)

См. инструкции в `TESTING-BADGE.md`

---

## 🔧 Начать улучшать Recovery механизм

Теперь, когда у вас есть тесты, можно безопасно вносить изменения!

### Приоритет #1: Серверное хранилище состояния

**Проблема:** localStorage ненадежен (теряется в incognito mode, при очистке браузера)

**Решение:**

#### Шаг 1: Установить Redis (или использовать MySQL)

```bash
# Для development локально
npm install redis

# Или использовать MySQL (уже установлен)
```

#### Шаг 2: Добавить endpoint для сохранения state

```javascript
// routes/session.js - ДОБАВИТЬ новые роуты

// Сохранить состояние сессии
router.post("/state/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const { state, timestamp } = req.body;

  try {
    // Сохранить в DB (или Redis)
    await pool.execute(
      "INSERT INTO session_state (session_id, state, timestamp) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE state = ?, timestamp = ?",
      [
        sessionId,
        JSON.stringify(state),
        timestamp,
        JSON.stringify(state),
        timestamp,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save state:", error);
    res.status(500).json({ error: "Failed to save state" });
  }
});

// Получить состояние сессии
router.get("/state/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const [results] = await pool.execute(
      "SELECT state, timestamp FROM session_state WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1",
      [sessionId],
    );

    if (results.length > 0) {
      res.json({
        state: JSON.parse(results[0].state),
        timestamp: results[0].timestamp,
      });
    } else {
      res.json({});
    }
  } catch (error) {
    console.error("Failed to load state:", error);
    res.status(500).json({ error: "Failed to load state" });
  }
});
```

#### Шаг 3: Добавить таблицу в БД

```sql
-- DB/session_state.sql
CREATE TABLE IF NOT EXISTS session_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    state LONGTEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Шаг 4: Обновить client-side код

```javascript
// views/ejs/index.ejs

// Автосохранение каждые 30 секунд
setInterval(async () => {
  if (myConn && myConn.isConnected()) {
    const state = stage.toJSON();

    try {
      await fetch(`/session/state/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          timestamp: Date.now(),
        }),
      });
      console.log("✅ State auto-saved to server");
    } catch (error) {
      console.error("Failed to save state to server:", error);
    }
  }
}, 30000); // Каждые 30 секунд

// При reconnect - загрузить с сервера
const reLoadStateAfterReconnect = async () => {
  try {
    // Получить state с сервера
    const response = await fetch(`/session/state/${sessionId}`);
    const { state: serverState, timestamp: serverTimestamp } =
      await response.json();

    // Получить локальный state
    const localState = localStorage.getItem("konvaAppState");
    const localTimestamp = parseInt(
      localStorage.getItem("konvaAppState_timestamp") || "0",
    );

    // Выбрать более свежий
    let newestState;
    if (serverState && serverTimestamp > localTimestamp) {
      newestState = serverState;
      console.log("✅ Using server state (newer)");
    } else if (localState) {
      newestState = localState;
      console.log("✅ Using local state (newer)");
    }

    // Загрузить state (БЕЗ removeAll!)
    if (newestState) {
      await stageFromJson(
        typeof newestState === "string"
          ? newestState
          : JSON.stringify(newestState),
      );
    }
  } catch (error) {
    console.error("Failed to reload state:", error);
    // Fallback к localStorage
    loadKonvaState();
  }
};
```

#### Шаг 5: ВАЖНО - убрать removeAll()!

```javascript
// СТАРЫЙ КОД (УДАЛИТЬ):
const reLoadStateAfterReconnect = () => {
  removeAll(); // ❌ УДАЛЯЕТ ВСЕ!
  loadKonvaState();
};

// НОВЫЙ КОД:
const reLoadStateAfterReconnect = async () => {
  // Загружаем state БЕЗ удаления существующего
  await loadStateFromServerOrLocal();

  // Запрашиваем state у оппонента для синхронизации
  sendEvent({
    event: "requestState",
    requester: clientId,
    timestamp: Date.now(),
  });
};
```

#### Шаг 6: Тестирование

```bash
# 1. Запустить приложение
npm start

# 2. В другом терминале - запустить тесты
npm test

# 3. Проверить что все работает
npm run validate

# 4. Закоммитить изменения
git add .
git commit -m "feat: add server-side state storage for recovery"
git push
```

---

### Приоритет #2: Exponential Backoff

**Проблема:** Фиксированная задержка 2 сек при reconnect может перегрузить сервер

**Решение:** См. детальный код в моем предыдущем анализе (секция "Рекомендации по исправлению")

Файл: `public/javascripts/p2pConnectionGlobalPromise.js`

---

### Приоритет #3: Heartbeat mechanism

**Проблема:** Не всегда ясно когда соединение реально умерло

**Решение:** См. код в секции "Heartbeat для обнаружения разрывов"

---

## 📝 Добавление тестов для новой функциональности

### Пример: Тест для server-side state storage

```javascript
// tests/state-storage.test.js
const assert = require("assert");
const { test } = require("node:test");

test("Session state can be saved to server", async () => {
  const state = { test: "data", timestamp: Date.now() };

  const response = await fetch(
    "http://localhost:3000/session/state/test-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, timestamp: Date.now() }),
    },
  );

  const result = await response.json();
  assert.strictEqual(result.success, true);
});

test("Session state can be retrieved from server", async () => {
  const response = await fetch(
    "http://localhost:3000/session/state/test-session",
  );
  const result = await response.json();

  assert.ok(result.state || result.timestamp >= 0);
});
```

Добавьте в workflow:

```yaml
# .github/workflows/ci-quick-test.yml
- name: Test Server State Storage
  run: |
    npm start &
    sleep 5
    npm run test:integration
    killall node
```

---

## 🎯 План на неделю

### День 1-2: Серверное хранилище

- [x] Тесты работают
- [ ] Добавить таблицу `session_state`
- [ ] Создать API endpoints
- [ ] Обновить client-side код
- [ ] Убрать `removeAll()`
- [ ] Протестировать

### День 3: Exponential Backoff

- [ ] Обновить логику reconnect в `p2pConnectionGlobalPromise.js`
- [ ] Добавить конфигурацию (MAX_ATTEMPTS, BASE_DELAY)
- [ ] Протестировать с отключением Wi-Fi

### День 4: Heartbeat

- [ ] Добавить heartbeat mechanism
- [ ] Добавить timeout detection
- [ ] Протестировать

### День 5: Тестирование

- [ ] Симуляция разрывов
- [ ] Тестирование incognito mode
- [ ] Нагрузочное тестирование
- [ ] Документация

---

## ✅ Checklist перед каждым изменением

```bash
# 1. Создать ветку для изменения
git checkout -b feature/server-state-storage

# 2. Внести изменения

# 3. Запустить тесты
npm test

# 4. Проверить синтаксис
npm run validate

# 5. Закоммитить
git add .
git commit -m "feat: add server state storage"

# 6. Запушить
git push origin feature/server-state-storage

# 7. Создать Pull Request
# 8. Проверить что CI прошел ✅
# 9. Смержить в dev
```

---

## 📚 Дополнительные ресурсы

- [Testing Guide](tests/README.md) - как писать тесты
- [CI Setup](CI-SETUP.md) - детали CI/CD
- [Quick Start](QUICK-START-TESTING.md) - быстрый старт

---

## 🎉 Готово!

Теперь у вас есть:

- ✅ Автоматические тесты на всех ветках
- ✅ Быстрая валидация (< 1 сек)
- ✅ Информативный CI (< 3 мин)
- ✅ Документация

**Можно безопасно улучшать recovery механизм!** 🚀
