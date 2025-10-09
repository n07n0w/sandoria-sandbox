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

app.use(logger('dev'));
app.use(express.json());
//app.use(express.urlencoded({ extended: false }));
//app.use(urlencoded({ limit: '10mb', extended: true }));
app.use(bodyParser.urlencoded({
    parameterLimit: 100000,
    limit: '50mb',
    extended: true
}));

const oneHour = 3_600_000 // 3600000msec => 1hour

app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public', { maxAge: oneHour }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
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
        app.use(function(req, res, next) {
            console.log('404 Not Found:', req.path);
            next(createError(404));
        });

        // error handler
        app.use(function(err, req, res, next) {
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
