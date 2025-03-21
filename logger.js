const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: path.join(logsDir, 'sandbox.log') },
    },
    {
      target: 'pino-pretty',
    },
  ],
});

module.exports = pino(
  {
    level: process.env.PINO_LOG_LEVEL || 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);
