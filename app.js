require('./console-logger');
var createError = require('http-errors');
var express = require('express');
const compression = require('compression');
const http = require('http');
const WebSocket = require('ws');
const session = require('express-session');
const bodyParser = require('body-parser');
const initializeDatabase = require('./init-db');
const constants = require('./constants');
const baseUrl = constants.BASE_URL;
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

console.log('Starting application...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Base URL:', baseUrl);
console.log('Database URL:', process.env.JAWSDB_MARIA_URL ? 'Set' : 'Not set');

// Create express app
var app = express();

//const server = http.createServer(app);
//const wss = new WebSocket.Server({ server }); // WebSocket на тому ж сервері

app.locals.constants = constants;
app.locals.peerserverhost = constants.PEER_SERVER_HOST;
app.locals.peerserverport = constants.PEER_SERVER_PORT;
app.locals.peerserverpath = constants.PEER_SERVER_PATH;
app.locals.peerserversecure = constants.PEER_SERVER_SECURE;

// view engine setup
app.set('views', path.join(__dirname, 'views/ejs'));
app.set('view engine', 'ejs');

app.use(compression({
    level: 6,      // compression level (0–9)
    threshold: 0   // compress everything
}));

app.use(logger('dev'));
app.use(express.json());
//app.use(express.urlencoded({ extended: false }));
//app.use(urlencoded({ limit: '10mb', extended: true }));
app.use(
  bodyParser.urlencoded({
    parameterLimit: 100000,
    limit: '50mb',
    extended: true,
  }),
);

const oneHour = 3_600_000; // 3600000msec => 1hour

app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public', { maxAge: oneHour }));
app.use(
  session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
  }),
);

app.use('/images/svg', express.static('public/images/svg', {
    maxAge: '1d',
    immutable: true
}));

// Don't set up routes until database is initialized
let routesInitialized = false;

async function initializeApp() {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('Attempting to initialize database...');
      await initializeDatabase();
      console.log('Database initialized successfully');
    }

    if (!routesInitialized) {
      console.log('Initializing routes...');
      app.use('/', require('./routes/index'));
      app.use('/users', require('./routes/users'));
      app.use('/register', require('./routes/register'));
      app.use('/auth', require('./routes/auth'));
      app.use('/image', require('./routes/image'));
      app.use('/cabinet', require('./routes/cabinet'));
      app.use('/session', require('./routes/session'));
      app.use('/s', require('./routes/s'));
      routesInitialized = true;
      console.log('Routes initialized successfully');
    }

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
      console.log('404 Not Found:', req.path);
      next(createError(404));
    });

    // error handler
    app.use(function (err, req, res, next) {
      console.error('Error occurred:', err);
      res.locals.message = err.message;
      res.locals.error = req.app.get('env') === 'development' ? err : {};
      res.status(err.status || 500);
      res.render('error');
    });

    console.log('Application initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize application:', error);
    throw error;
  }
}

const clients = new Map(); // clientId → WebSocket

async function initWebSocket(server) {
  console.log('initWebSocket:', server);
  var wss = new WebSocket.Server({ server }); // WebSocket на тому ж сервері
  console.log('WebSocket:', wss);

    function broadcastPresence(sessionId, isOnline) {
        const msg = JSON.stringify({
            type: "presence",
            sessionId,
            status: isOnline ? "online" : "offline"
        });

        for (const ws of clients.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        }
    }

    wss.on('connection', (ws) => {
        console.log("WS connection opened");
        let registeredId = null;

        ws.on('message', (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch (e) {
                console.log("Invalid JSON:", raw);
                return;
            }

            // Client must register after connect        // CHANGED
            if (msg.action === 'register') {
                registeredId = msg.sessionId;

                clients.set(registeredId, ws);
                console.log("Registered:", registeredId);

                // notify others
                broadcastPresence(registeredId, true);   // NEW
                return;
            }

            // Route messages by msg.to                  // CHANGED
            if (msg.to) {
                const target = clients.get(msg.to);
                if (target && target.readyState === WebSocket.OPEN) {
                    target.send(JSON.stringify(msg));
                }
            }
        });

        ws.on('close', () => {
            if (registeredId) {
                clients.delete(registeredId);
                console.log("Disconnected:", registeredId);
                broadcastPresence(registeredId, false);  // NEW
            }
        });
    });

    console.log("WebSocket server attached");
}

// Export both the app and the initialization function
module.exports = { app, initializeApp, initWebSocket };
