  1. КОНЦЕПЦИЯ И НАЗНАЧЕНИЕ

  MySandbox - это веб-приложение для проведения онлайн сеансов песочной терапии между психологом и клиентом в режиме реального времени. Приложение
  реализует совместную работу на виртуальном холсте с библиотекой терапевтических изображений.

  Целевая аудитория:
  - Психологи-терапевты (инициаторы сессий)
  - Клиенты (участники по ссылке-приглашению)

  ---
  2. АРХИТЕКТУРА И ТЕХНОЛОГИЧЕСКИЙ СТЕК

  Backend (Node.js 18.x):

  - Express.js - веб-фреймворк
  - WebSocket (ws) - сигнальный сервер для WebRTC
  - MySQL - база данных (mysql2 с промисами)
  - Session management - express-session
  - Authentication - bcrypt для хеширования паролей

  Frontend:

  - Konva.js - манипуляции с canvas (drag-and-drop, transformations)
  - jQuery + jQuery UI - DOM-манипуляции и UI компоненты
  - WebRTC - P2P соединение для обмена данными
  - EJS - шаблонизатор

  Communication Stack:

  Психолог ←→ WebSocket Server ←→ Клиент
       ↓         (signaling)        ↓
       ←─────── WebRTC P2P ─────────→
             (data channel)

  ---
  3. МЕХАНИЗМ РАБОТЫ СЕССИЙ

  A. Создание сессии (routes/session.js:42-52)

  POST /session/init
  → Создает запись в БД с двумя UUID:
    - sessionUuid (для психолога)
    - uuid (opponent ID для клиента)
  → Возвращает ссылку: BASE_URL/s/{opponentId}

  B. Подключение клиента (routes/s.js:25-38)

  GET /s/:opponentSessionId
  → Находит sessionUuid по opponent ID
  → Рендерит canvas с категориями изображений

  C. Установка P2P соединения (public/p2pConnection.js)

  Этапы подключения:

  1. WebSocket Registration (строки 25-32)
    - Оба участника открывают WS-соединение к серверу
    - Регистрируются с уникальными clientId
  2. WebRTC Signaling (строки 64-108)
    - Инициатор (с меньшим clientId) создает offer
    - Получатель создает answer
    - Обмен ICE-кандидатами через WebSocket
  3. DataChannel Establishment (строки 110-130)
    - Прямой P2P канал для обмена данными о холсте
    - Очередь сообщений (pendingMessages) для надежности
  4. Auto-Reconnection (строки 84-94)
    - Отслеживание состояния connectionState
    - Переподключение каждые 3 секунды при обрыве

  ---
  4. СТРУКТУРА БАЗЫ ДАННЫХ

  Таблица sandboxes (DB/sandbox.sql:80-89)

  - id (PK)
  - name, ownerId
  - sessionUuid (UUID для психолога)
  - uuid (UUID для клиента/оппонента)
  - createdt (timestamp)

  Таблица categories (DB/sandbox.sql:25-32)

  15 категорий терапевтических изображений:
  - Люди, Мебель, Архитектура, Транспорт, Военные
  - Медицина, Животные, Волшебные существа, Динозавры
  - Смерть, Стихии, Природа, Соединения, Стройка, Еда

  Таблица categoryimage (DB/sandbox.sql:52-60)

  483 SVG-изображения для терапевтической работы

  Таблица sessionimage (DB/sandbox.sql:109-114)

  Снимки состояния canvas для каждой сессии

  Таблица users (DB/sandbox.sql:134-141)

  Пользователи с bcrypt-паролями

  ---
  5. ОСНОВНЫЕ КОМПОНЕНТЫ

  A. WebSocket Signaling Server (app.js:109-166)

  const clients = new Map(); // clientId → WebSocket

  Обработка сообщений:
  - "register" → регистрация клиента
  - "offer/answer/ice" → проброс между пирами

  B. P2P Connection Module (public/p2pConnection.js)

  Экспортируемый API:
  startP2PConnection(clientId, targetId, onMessageCallback, onStatusChange)
  → returns { send(), isConnected(), close() }

  Статусы подключения:
  - ws-closed - WebSocket разорван
  - ws-reconnecting - переподключение WS
  - reconnecting - переподключение peer
  - connected - канал открыт
  - disconnected - канал закрыт
  - closed - вручную закрыто

  C. Repository Layer

  sandboxRepository.js (repository/sandboxRepository.js)
  - insertNewSandbox() - создание сессии
  - getSandboxBySessionUuid() - поиск по UUID психолога
  - getSandboxByUuid() - поиск по UUID клиента

  categoryRepository.js
  - getCategories() - загрузка категорий изображений

  ---
  6. БЕЗОПАСНОСТЬ И КОНФИГУРАЦИЯ

  ⚠️ Критические проблемы безопасности:

  1. Hardcoded Session Secret (app.js:54)
  app.use(session({
    secret: 'secret-key', // ❌ НЕ БЕЗОПАСНО!
  1. Рекомендация: Использовать переменную окружения
  2. SSL Configuration
    - JAWSDB: rejectUnauthorized: false (dbConfig.js:14)
    - Необходимо для некоторых провайдеров, но снижает безопасность
  3. WebSocket без шифрования (p2pConnection.js:26)
  ws = new WebSocket(`ws://${location.host}`);
  3. Рекомендация: Использовать wss:// в продакшене
  4. CORS и Origin Validation
    - Отсутствует проверка origin для WebSocket соединений
    - Уязвимость к CSRF-атакам

  Database Configuration (dbConfig.js)

  - Приоритет JAWSDB_MARIA_URL (Heroku addon)
  - Fallback на индивидуальные переменные
  - Auto-SSL для AWS RDS

  ---
  7. DEPLOYMENT И CI/CD

  GitHub Actions (.github/workflows/deploy.yml)

  - Триггеры: push в master/main или вручную
  - Целевая платформа: Ubuntu EC2 instance
  - Процесс:
    a. SSH-подключение с паролем
    b. Установка зависимостей (Node 18, MySQL, PM2)
    c. Клонирование репозитория
    d. Автоматическое создание БД с безопасными credentials
    e. Импорт DB/timeweb.sandbox.sql (primary) или DB/sandbox.sql
    f. Запуск через PM2

  Manual Deployment Script

  scripts/manual-deploy.sh
  - Полный bootstrap-скрипт для новой Ubuntu-машины
  - Автогенерация паролей MySQL
  - PM2 autostart configuration

  ---
  8. ОСОБЕННОСТИ РЕАЛИЗАЦИИ

  Плюсы:

  1. P2P Architecture
    - Минимальная нагрузка на сервер после handshake
    - Низкая латентность между участниками
    - WebSocket только для signaling
  2. Auto-Reconnection
    - Устойчивость к временным обрывам связи
    - Очередь сообщений при недоступности канала
  3. Модульная структура
    - Разделение на Repository/Service/Controller
    - Возможность расширения
  4. Терапевтический контент
    - 15 категорий, 483 изображения
    - SVG-формат для масштабируемости

  Минусы:

  1. Security Issues
    - Hardcoded secrets
    - Нет HTTPS enforcement
    - Отсутствие rate limiting
  2. No Session Persistence
    - Состояние canvas теряется при обрыве
    - Нет автосохранения композиций
  3. Scaling Limitations
    - In-memory clients Map (app.js:107)
    - Не подходит для horizontal scaling без Redis
  4. Error Handling
    - Недостаточная обработка edge cases
    - Нет graceful degradation

  ---
  9. РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ

  Критичные (Безопасность):

  1. Переместить secret в .env:
     SESSION_SECRET=<криптостойкий рандомный ключ>

  2. Enforce HTTPS/WSS:
     if (process.env.NODE_ENV === 'production') {
       require('express-sslify').HTTPS({ trustProtoHeader: true })
     }

  3. Добавить CORS middleware для WebSocket

  4. Rate limiting (express-rate-limit)

  Средний приоритет (Надежность):

  1. Сохранение состояния canvas:
     - Auto-save каждые 30 сек
     - Recovery после reconnect

  2. Redis для clients Map:
     - Горизонтальное масштабирование
     - Shared state между инстансами

  3. Логирование и мониторинг:
     - Pino для structured logging
     - Metrics для Prometheus/Grafana

  Низкий приоритет (UX):

  1. Мобильная оптимизация (mobile.css существует, но требует доработки)
  2. История сессий для психолога
  3. Экспорт композиции в PNG/PDF
  4. Аудио/видео чат для сопровождения терапии

  ---
  10. ВЫВОДЫ

  MySandbox - это специализированное приложение с четко определенной domain-моделью для онлайн песочной терапии.

  Сильные стороны:
  - Правильно выбранный WebRTC для real-time collaboration
  - Простая и понятная архитектура
  - Готовая библиотека терапевтических изображений

  Требует внимания:
  - Безопасность (критично для медицинских данных!)
  - Persistence (восстановление сессий)
  - Масштабируемость (если планируется рост пользователей)

  Готовность к продакшену: 70%
  - Функционал работает ✅
  - Deployment автоматизирован ✅
  - Безопасность требует доработки ⚠️
  - Мониторинг отсутствует ⚠️
