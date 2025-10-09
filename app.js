require('./console-logger');
var createError = require('http-errors');
var express = require('express');
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
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Base URL:', baseUrl);
console.log('Database URL configured:', process.env.JAWSDB_MARIA_URL ? 'Yes (JAWSDB_MARIA_URL)' : process.env.JAWSDB_URL ? 'Yes (JAWSDB_URL)' : 'No (using env vars)');

// Create express app
var app = express();

app.locals.constants = constants;
app.locals.peerserverhost = constants.PEER_SERVER_HOST;
app.locals.peerserverport = constants.PEER_SERVER_PORT;
app.locals.peerserverpath = constants.PEER_SERVER_PATH;
app.locals.peerserversecure = constants.PEER_SERVER_SECURE;


// view engine setup
app.set('views', path.join(__dirname, 'views/ejs'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));

app.use(bodyParser.urlencoded({
    parameterLimit: 100000,
    limit: '50mb',
    extended: true
}));

const oneHour = 3_600_000 // 3600000msec => 1hour

app.use(cookieParser());
app.use(express.static('public', { maxAge: oneHour }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    maxAge: oneHour
  }
}));

// Don't set up routes until database is initialized
let routesInitialized = false;

async function initializeApp() {
    try {
        console.log('Initializing application...');

        // Only initialize database in production or if explicitly requested
        if (process.env.NODE_ENV === 'production' || process.env.INIT_DB === 'true') {
            console.log('Attempting to initialize database...');
            try {
                await initializeDatabase();
                console.log('Database initialized successfully');
            } catch (dbError) {
                console.error('Database initialization failed:', dbError.message);
                // Don't fail the entire app if database init fails
                // The app might still work with external database
                console.log('Continuing without database initialization...');
            }
        } else {
            console.log('Skipping database initialization (not in production mode)');
        }

        if (!routesInitialized) {
            console.log('Initializing routes...');

            try {
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
            } catch (routeError) {
                console.error('Error initializing routes:', routeError);
                throw routeError;
            }
        }

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                env: process.env.NODE_ENV || 'development'
            });
        });

        // catch 404 and forward to error handler
        app.use(function(req, res, next) {
            console.log('404 Not Found:', req.method, req.path);
            next(createError(404));
        });

        // error handler
        app.use(function(err, req, res, next) {
            console.error('Error occurred:', err.message);
            console.error('Stack:', err.stack);

            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};

            const status = err.status || 500;
            res.status(status);

            // Try to render error page, fallback to JSON
            try {
                res.render('error');
            } catch (renderError) {
                console.error('Error rendering error page:', renderError);
                res.json({
                    error: res.locals.message,
                    status: status
                });
            }
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

    wss.on('connection', ws => {
        console.log('New client connected');
        let clientId = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('New message', data);

                // 1. Перше повідомлення від клієнта: реєстрація ID
                if (data.type === 'register') {
                    clientId = data.clientId;
                    clients.set(clientId, ws);
                    console.log(`🟢 Client registered: ${clientId}`);
                    return;
                }

                // 2. Інші типи — signaling (offer/answer/ice)
                if (!clientId) {
                    console.warn('Received signaling message from unregistered client');
                    return;
                }

                if (!data.targetId) {
                    console.warn('Received signaling message without targetId');
                    return;
                }

                const targetSocket = clients.get(data.targetId);
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        type: data.type,
                        sdp: data.sdp,
                        candidate: data.candidate,
                        fromId: clientId
                    }));
                } else {
                    console.warn(`Target client ${data.targetId} not found or not connected`);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                // Don't crash the connection, just log the error
            }
        });

        ws.on('close', () => {
            if (clientId) {
                clients.delete(clientId);
                console.log(`🔴 Client disconnected: ${clientId}`);
            }
        });
    });
}


// Export both the app and the initialization function
module.exports = { app, initializeApp, initWebSocket };
