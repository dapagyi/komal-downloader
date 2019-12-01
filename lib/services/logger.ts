'use strict';
import { createLogger, format, transports } from 'winston';
import fs from 'fs';
import path from 'path';

const env = process.env.NODE_ENV || 'development';
const logDir = 'log';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const filename = path.join(logDir, 'results.log');

var level;
if (env == 'development') level = 'debug';
else if (env == 'test') level = 'warn';
else level = 'info';

const appName = require(path.join(__dirname, '..', '..', 'package.json')).name;

const logger = createLogger({
  // levels: config.npm.levels,
  // change level if in dev environment versus production
  level: level,
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
  ),
  transports: [
    new transports.Console({
      level: level,
      format: format.combine(
        format.colorize(),
        format.printf(info => `${info.timestamp} (${appName}) ${info.level}: ${info.message}`),
      ),
    }),
    new transports.File({ filename }),
  ],
});

logger.stream = {
  // @ts-ignore
  write: message => {
    logger.info(message.substring(0, message.lastIndexOf('\n')));
  },
};

logger.info(`Logging on level ${level}`);

// logger.info('Hello world');
// logger.warn('Warning message');
// logger.debug('Debugging info');

export default logger;
