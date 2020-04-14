'use strict';
const winston = require('winston');

let logger = winston.createLogger({
  level: (process.env.LOG_LEVEL || 'info'),
  format: winston.format.simple(),
  transports: [
    new (winston.transports.File)({
      filename: 'fee-report.log',
      dirname: 'logs',
      timestamp: true,
      colorize:  false
    }),
  ]
});

// Add console logger
logger.add(new winston.transports.Console({
  format: winston.format.simple(),
  colorize: winston.format.colorize()
}));

module.exports = logger;
