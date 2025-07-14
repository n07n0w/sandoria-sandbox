// logger.js
const fs = require('fs');
const util = require('util');
const path = require('path');

// Створюємо потік для запису у файл (наприклад, ./logs/app.log)
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logFile = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });

// Масив методів, які хочемо дублювати
['log', 'error', 'warn', 'info'].forEach(method => {
  const original = console[method];
  console[method] = function (...args) {
    original.apply(console, args); // Вивід у stdout

    const timestamp = new Date().toISOString();
    const message = args.map(arg => util.format(arg)).join(' ');
    logFile.write(`[${timestamp}] [${method.toUpperCase()}] ${message}\n`);
  };
});
