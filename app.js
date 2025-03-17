var createError = require('http-errors');
var express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

//var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/users');

//const logger = require('./logger');
//const pool = require('./dbConnection');

//const doctorService = require('./service/doctorService');


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views/ejs'));
app.set('view engine', 'ejs');
//app.set('view engine', 'pug');

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

app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/register', require('./routes/register'));
app.use('/auth', require('./routes/auth'));
app.use('/image', require('./routes/image'));
app.use('/cabinet', require('./routes/cabinet'));
app.use('/session', require('./routes/session'));
app.use('/s', require('./routes/s'));



// catch 404 and forward to error handler
app.use(function(req, res, next) {
console.log(req);
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
console.log(err);
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
