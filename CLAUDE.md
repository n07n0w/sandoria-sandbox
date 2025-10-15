# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"MySandbox" is a collaborative real-time web application built with Express.js that enables peer-to-peer (P2P) canvas-based collaboration. Users can create sessions, share links, and interact with each other through WebRTC data channels for low-latency communication and WebSocket signaling.

## Key Technologies

- **Backend**: Node.js 18.x with Express.js
- **Database**: MySQL (via mysql2 with promise support)
- **Real-time Communication**: WebSocket (ws library) for signaling, WebRTC for P2P data channels
- **Canvas**: Konva.js for client-side canvas manipulation
- **Session Management**: express-session
- **Views**: EJS templates

## Development Commands

### Starting the Application
```bash
npm start                 # Start the server (runs bin/www)
```
Server runs on port 3000 by default (configurable via PORT env var).

### Database Setup
```bash
npm run db:init          # Initialize/reset database from DB/sandbox.sql
```
Note: In production (NODE_ENV=production), database initialization happens automatically on server start.

### Docker
```bash
docker build -t mysandbox .
docker run -p 3000:3000 mysandbox
```

## Architecture

### Application Lifecycle

1. **Server Start** (bin/www):
   - Creates HTTP server
   - Calls `initializeApp()` to set up routes and optionally initialize database
   - Calls `initWebSocket(server)` to attach WebSocket server to HTTP server
   - Starts listening on configured port

2. **Database Initialization** (init-db.js):
   - Only runs automatically in production
   - Retries connection up to 5 times with 5s delays
   - Creates database if not exists
   - Executes DB/sandbox.sql to set up schema

3. **Route Initialization** (app.js):
   - Routes are only initialized after database is ready
   - Prevents race conditions during startup

### Communication Architecture

**WebSocket Signaling Server** (app.js:109-166):
- Maintains a Map of clientId → WebSocket connections
- Handles client registration (`register` type messages)
- Routes WebRTC signaling messages (offer/answer/ice) between peers
- Each client must register with a unique clientId before sending signaling messages

**P2P Data Channel** (public/p2pConnection.js):
- Uses WebRTC RTCDataChannel for direct peer-to-peer communication
- WebSocket is only used for initial WebRTC handshake (signaling)
- Auto-reconnection logic for both WebSocket and peer connections
- Message queuing when channel is not ready
- Initiator determination: client with lower clientId creates the data channel

**Session Management**:
- Each sandbox has two UUIDs: `sessionUuid` and `uuid` (opponent session ID)
- Sessions created via POST /session/init return both IDs
- Route `/s/:opponentSessionId` looks up the corresponding `sessionUuid` to connect peers

### Directory Structure

```
├── app.js                      # Main Express app, WebSocket setup
├── bin/www                     # Server entry point
├── routes/                     # Express route handlers
│   ├── session.js             # Session creation and management
│   ├── s.js                   # Session access by opponent ID
│   ├── cabinet.js             # User cabinet/dashboard
│   ├── auth.js                # Authentication
│   └── register.js            # User registration
├── controllers/               # Business logic layer
├── repository/                # Database access layer
│   ├── sandboxRepository.js   # Sandbox/session CRUD
│   └── categoryRepository.js  # Category CRUD
├── service/                   # Service layer (doctor service for data processing)
├── model/                     # JSON-based model data/fixtures
├── DB/                        # SQL schema files
├── public/                    # Static assets
│   ├── javascripts/           # Client-side JS (jQuery, Konva, PeerJS)
│   └── p2pConnection.js       # WebRTC P2P connection module (ES6 export)
└── views/ejs/                 # EJS templates
```

### Configuration

**Environment Variables** (.env):
```
# Database - either use JAWSDB_MARIA_URL (parsed automatically) or individual vars:
JAWSDB_MARIA_URL=mysql://user:pass@host:port/dbname
# OR
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=sandbox

# Application URLs
BASE_URL=http://localhost:3000
MAIN_SITE_URL=https://sandoria.org/

# PeerJS server configuration (for fallback/turn server)
PEER_SERVER_HOST=peer-server.sandoria.org
PEER_SERVER_PORT=80
PEER_SERVER_PATH=/
PEER_SERVER_SECURE=false

# Server
PORT=3000
NODE_ENV=development
```

**Database Configuration** (dbConfig.js):
- Prioritizes JAWSDB_MARIA_URL (Heroku MySQL addon format)
- Falls back to individual DB_* environment variables
- Automatically enables SSL for AWS RDS hosts
- Validates required fields (host, user, database)

**Application Constants** (constants.js):
- BASE_URL: Used to generate session share links
- PEER_SERVER_*: Configuration passed to client-side PeerJS (if used)

### Database Layer

**Connection Management**:
- `dbConnection.js`: Exports a mysql2 promise pool
- `init-db.js`: Database initialization with retry logic

**Repositories**:
- `sandboxRepository.js`: Manages session/sandbox records (insertNewSandbox, getSandboxById, etc.)
- `categoryRepository.js`: Manages categories (getCategories)

Both repositories use the pool from dbConnection.js and return promises.

### Client-Side Architecture

**P2P Connection Module** (public/p2pConnection.js):
- Exports `startP2PConnection(clientId, targetId, onMessageCallback, onStatusChange)`
- Returns object with `send()`, `isConnected()`, `close()` methods
- Handles message queuing and auto-reconnection
- Status callbacks: "ws-closed", "ws-reconnecting", "reconnecting", "connected", "disconnected", "closed"

**Konva.js Integration**:
- Used for interactive canvas manipulation
- Files located in public/javascripts/konva.js

## Common Development Patterns

### Adding a New Route
1. Create route file in `routes/` directory
2. Define handlers (can import from controllers/)
3. Register in `app.js` inside `initializeApp()` function after database initialization

### Database Queries
Always use the connection pool from `dbConnection.js`:
```javascript
const pool = require('./dbConnection');
const [results, fields] = await pool.execute(sql, values);
```

### Session Creation Flow
1. Client calls POST /session/init
2. Server creates new sandbox record with two UUIDs
3. Server returns sessionId (for initiator) and opponentSessionId (for link sharing)
4. Share link format: `{BASE_URL}/s/{opponentSessionId}`
5. Opponent visits link, server looks up sessionUuid from opponentSessionId
6. Both peers establish WebSocket connection and register their clientIds
7. WebRTC signaling occurs through WebSocket server
8. P2P data channel established for direct communication

### WebRTC Signaling Flow
1. Both clients connect to WebSocket server and send `{type: "register", clientId}`
2. Client with lower ID initiates: creates offer, sends via WebSocket with targetId
3. Target receives offer via WebSocket, creates answer, sends back
4. ICE candidates exchanged via WebSocket
5. Once connected, all data flows through RTCDataChannel (bypassing server)

## Important Notes

- **Production Database**: Database auto-initializes only when NODE_ENV=production
- **Session Management**: The app uses express-session with a hardcoded secret ('secret-key') - should be changed for production
- **WebSocket Hostname**: Client WebSocket connects to same host as HTTP (location.host)
- **Peer Connection State**: Monitor `connectionState` on RTCPeerConnection for disconnections
- **STUN Server**: Uses Google's public STUN server (stun.l.google.com:19302)
- **File Uploads**: Multer is installed but usage depends on specific routes
- **Static Assets**: Cached for 1 hour (maxAge: 3600000ms)

## Logging

- Console logging via custom console-logger.js (loaded first in app.js)
- Pino logger available via logger.js (with pino-pretty for development)
- Morgan middleware logs HTTP requests in 'dev' format

## Deployment

### GitHub Actions CI/CD

The repository includes automated deployment to EC2 via GitHub Actions (`.github/workflows/deploy.yml`).

**Required GitHub Secrets**:
- `EC2_HOST`: Your EC2 instance public IP or hostname
- `EC2_USER`: SSH username (typically `ubuntu` for Ubuntu servers)
- `EC2_PASSWORD`: SSH password for the user

**Deployment Trigger**:
- Automatic: Push to `master` or `main` branch
- Manual: Use "Actions" tab → "Deploy to EC2" → "Run workflow"

**What the Pipeline Does**:
1. Checks out the code
2. Connects to EC2 via SSH (using sshpass for password authentication)
3. Installs system dependencies (Node.js 18, Git, MySQL, PM2)
4. Clones/updates the repository on the server
5. Installs npm dependencies
6. **Creates MySQL database and user automatically** with secure credentials
7. **Imports database backup from `DB/timeweb.sandbox.sql`** (or fallback to `DB/sandbox.sql`)
8. Creates `.env` file with auto-generated database credentials
9. Starts/restarts the application using PM2
10. Sets up PM2 to run on system startup

**Post-Deployment**:
- Application runs via PM2 process manager (process name: `sandoria-sandbox`)
- Access at: `http://<EC2_PUBLIC_IP>:3000`
- Logs available via: `pm2 logs sandoria-sandbox`

### Manual Deployment

For manual deployment to a fresh Ubuntu server, use the `scripts/manual-deploy.sh` script:

```bash
# On your EC2 server:
wget https://raw.githubusercontent.com/yourusername/sandoria-sandbox/master/scripts/manual-deploy.sh
chmod +x manual-deploy.sh
./manual-deploy.sh
```

Or SSH into your server and run:
```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/sandoria-sandbox/master/scripts/manual-deploy.sh | bash
```

**Manual Setup Steps**:
1. Update repository URL in `scripts/manual-deploy.sh`
2. Script will install all dependencies (Node.js, MySQL, PM2)
3. Clone the repository to `~/sandoria-sandbox`
4. **Automatically creates MySQL database `sandbox` and user `sandboxuser`** with secure password
5. **Imports database from `DB/timeweb.sandbox.sql`** (primary) or `DB/sandbox.sql` (fallback)
6. Creates `.env` file with auto-generated credentials (displayed at end of script)
7. Start application with PM2

### Server Requirements

**Minimum Specs**:
- Ubuntu 18.04+ or similar Debian-based Linux
- 1GB RAM (2GB recommended)
- 10GB disk space
- Open ports: 22 (SSH), 3000 (Application)

**Installed Software** (via deployment scripts):
- Node.js 18.x
- MySQL Server 5.7+
- PM2 (process manager)
- Git

### Database Setup on Server

**The deployment scripts handle database setup automatically:**

1. **Installs MySQL Server** (if not present)
2. **Creates database** `sandbox`
3. **Creates user** `sandboxuser` with auto-generated secure password
4. **Grants privileges** to the user on the database
5. **Imports backup** from `DB/timeweb.sandbox.sql` (or `DB/sandbox.sql` as fallback)
6. **Creates `.env`** file with the generated credentials

**Important**: Make sure you have `DB/timeweb.sandbox.sql` in your repository - this is the primary database backup that will be imported.

**Manual database access** (if needed):
```bash
# View current database credentials
cat ~/sandoria-sandbox/.env | grep DB_

# Access MySQL with the created user
mysql -u sandboxuser -p sandbox
# (password is in .env file)

# Or use root access
sudo mysql sandbox
```

### PM2 Management Commands

```bash
pm2 status                    # Check application status
pm2 logs sandoria-sandbox     # View real-time logs
pm2 restart sandoria-sandbox  # Restart application
pm2 stop sandoria-sandbox     # Stop application
pm2 start sandoria-sandbox    # Start application
pm2 monit                     # Monitor CPU/memory usage
pm2 save                      # Save PM2 process list
```

### Troubleshooting Deployment

**Database connection errors**:
- Check `.env` file has correct DB credentials: `cat ~/sandoria-sandbox/.env | grep DB_`
- Verify MySQL is running: `sudo systemctl status mysql`
- Test connection: `mysql -u sandboxuser -p sandbox` (password from .env)
- Check if database was imported: `sudo mysql -e "USE sandbox; SHOW TABLES;"`

**Port already in use**:
- Check if app is already running: `pm2 status`
- Kill existing process: `pm2 delete sandoria-sandbox`
- Check for other processes: `sudo lsof -i :3000`

**Application won't start**:
- Check logs: `pm2 logs sandoria-sandbox --lines 100`
- Verify Node.js version: `node --version` (should be 18.x)
- Check file permissions in app directory

**Can't access application**:
- Verify EC2 security group allows inbound traffic on port 3000
- Check firewall: `sudo ufw status`
- Verify app is running: `pm2 status`
