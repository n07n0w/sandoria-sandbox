# Security Policy

## Supported Versions

We aim to keep the `main` (or `master`) branch updated with the latest security patches. Use the latest released commit for production deployments.

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do not** create a public issue with exploit details.
2. Email: (add your security contact email here) with a description, impact, and reproduction steps.
3. You will receive an acknowledgment within 3 business days.
4. We will provide an initial assessment and an ETA for a fix after triage.

If you need encrypted communication, include a request for a PGP key in your initial email.

## Scope

Issues in custom application code (Express routes, controllers, repository layer, WebSocket / P2P logic, client JS) are in-scope. Third‑party package vulnerabilities should generally be reported upstream; Dependabot and `npm audit` run automatically to surface these.

## Coordinated Disclosure

We prefer a 90‑day disclosure window, shortened if the issue is actively exploited or trivial to reproduce.

## Hardening & Best Practices Implemented

- ESLint with `eslint:recommended` + `plugin:security/recommended`
- GitHub Actions CI (lint + audit) on pushes and PRs
- CodeQL analysis scheduled weekly + on PRs
- Dependency Review action for PR risk visibility
- Dependabot for npm & GitHub Actions updates

## Additional Recommendations (Future Work)

- Add runtime security headers (helmet) middleware
- Implement rate limiting & brute force protection on auth endpoints
- Add unit/integration tests for critical auth & session flows
- Consider a Web Application Firewall (WAF) in front of production
- Periodic manual review of WebRTC signaling sanitization
name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

permissions:
  contents: read
  security-events: write
  actions: read

jobs:
  build-and-lint:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint (ESLint + security plugin)
        run: |
          npx eslint . --ext .js,.cjs,.mjs || (echo 'ESLint found issues (errors only cause failure). Fix or run npm run lint:fix' && exit 1)

      - name: Run security audit (production, high severity and above)
        run: npm audit --omit=dev --audit-level=high || true

      - name: Show outdated (informational)
        run: npm outdated || true

      - name: Archive logs (if present)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: app-logs
          path: logs/*.log
          if-no-files-found: ignore

