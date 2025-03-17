const pino = require('pino');

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: `${__dirname}/../logs/sandbox.log` },
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
