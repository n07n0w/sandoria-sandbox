# GitHub Actions Badge

После того как вы запушите код, добавьте этот badge в ваш README.md:

## Badge для статуса тестов:

```markdown
![CI Tests](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml/badge.svg)
```

## Или с ссылкой:

```markdown
[![CI Tests](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml/badge.svg)](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml)
```

## Пример использования в README:

```markdown
# MySandbox

[![CI Tests](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml/badge.svg)](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml)

Online sand therapy application for psychologists and clients.

## Quick Start

...
```

---

## После первого push:

1. Перейдите на https://github.com/n07n0w/sandoria-sandbox/actions
2. Проверьте что workflow "Quick CI Tests" запустился
3. Убедитесь что все зеленое ✅
4. Добавьте badge в README.md

Badge будет показывать:

- ✅ Зеленый (passing) - все тесты прошли
- ❌ Красный (failing) - есть ошибки
- 🟡 Желтый (running) - тесты выполняются

---

## Дополнительные badges (опционально):

### Node.js версия:

```markdown
![Node.js Version](https://img.shields.io/badge/node-18.x-brightgreen)
```

### License:

```markdown
![License](https://img.shields.io/badge/license-MIT-blue)
```

### Status:

```markdown
![Status](https://img.shields.io/badge/status-active-success)
```

---

## Полный пример:

```markdown
# MySandbox - Online Sand Therapy

[![CI Tests](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml/badge.svg)](https://github.com/n07n0w/sandoria-sandbox/actions/workflows/ci-quick-test.yml)
![Node.js Version](https://img.shields.io/badge/node-18.x-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

Collaborative real-time web application for online sand therapy sessions.

## Features

- 🎨 Real-time canvas collaboration
- 🔄 P2P WebRTC connections
- 💾 Session persistence
- 🔐 Secure authentication

## Quick Start

\`\`\`bash
npm install
npm start
\`\`\`

## Testing

\`\`\`bash

# Run all tests

npm test

# Quick validation

npm run validate
\`\`\`

## Documentation

- [Testing Guide](tests/README.md)
- [CI/CD Setup](CI-SETUP.md)
- [Quick Start](QUICK-START-TESTING.md)
```
