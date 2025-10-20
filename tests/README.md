# Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Quick syntax check (very fast, ~1 second)
npm run test:quick

# Run linting (informational)
npm run lint:check

# Run everything (validate before commit)
npm run validate
```

## Test Structure

### Smoke Tests (`smoke.test.js`)
Fast basic tests that check:
- Core modules can load
- Express app structure is correct
- Constants are defined
- Dependencies work (UUID, bcrypt, WebSocket)

**Runtime:** ~600ms

### P2P Tests (`p2p.test.js`)
Tests for P2P connection logic:
- P2P modules exist
- Valid JavaScript syntax
- Reconnection logic present
- Message queuing present

**Runtime:** ~50ms

## CI/CD

### GitHub Actions Workflow
File: `.github/workflows/ci-quick-test.yml`

**Runs on:**
- Every push to any branch
- Every pull request
- Manual trigger (workflow_dispatch)

**What it does:**
1. ✅ Syntax checks (all .js files)
2. ✅ Structure validation (directories and files exist)
3. ✅ Smoke tests
4. ✅ P2P tests
5. 📊 Code size analysis (informational)
6. 🔍 ESLint (informational, non-blocking)

**Runtime:** < 3 minutes total

## Adding New Tests

### Example: Add a new smoke test

```javascript
// tests/smoke.test.js
const assert = require('assert');
const { test } = require('node:test');

test('Your test description', async () => {
  // Test logic here
  assert.ok(true, 'Should pass');
});
```

### Example: Add a new test file

```javascript
// tests/myfeature.test.js
const assert = require('assert');
const { test } = require('node:test');

test('My feature works', async () => {
  const result = myFunction();
  assert.strictEqual(result, expectedValue);
});
```

## Local Testing Tips

### Run tests before commit
```bash
npm run validate
```

### Check specific file syntax
```bash
node --check path/to/file.js
```

### Run linter
```bash
npm run lint:check
```

## Troubleshooting

### "Cannot find module" error
```bash
# Install dependencies
npm install
```

### Tests fail locally but pass in CI
```bash
# Set environment variables
export DB_HOST=localhost
export DB_USER=test
export DB_PASSWORD=test
export DB_NAME=test_db

npm test
```

### ESLint errors
```bash
# See full report
npx eslint . --ext .js

# Auto-fix some issues
npx eslint . --ext .js --fix
```

## Future Improvements

- [ ] Add integration tests with real database
- [ ] Add E2E tests for P2P connection
- [ ] Add code coverage reporting
- [ ] Add performance benchmarks
- [ ] Add mutation testing
