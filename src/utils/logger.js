const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

// 로그 디렉토리 확인 및 생성
const logDir = path.join(__dirname, '../../', config.log.directory);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로그 레벨 정의
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLogLevel = LOG_LEVELS[config.log.level] || LOG_LEVELS.info;

class Logger {
  constructor(module) {
    this.module = module;
  }

  // 로그 파일에 기록
  _writeToFile(level, message) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString();
    const logFile = path.join(logDir, `${date}.log`);
    
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}\n`;
    
    fs.appendFile(logFile, logEntry, (err) => {
      if (err) {
        console.error(`Failed to write to log file: ${err.message}`);
      }
    });
  }

  // 콘솔과 파일에 로그 출력
  _log(level, levelValue, message, ...args) {
    if (levelValue <= currentLogLevel) {
      const formattedMessage = args.length ? `${message} ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}` : message;
      
      console[level](`[${level.toUpperCase()}] [${this.module}] ${formattedMessage}`);
      this._writeToFile(level, formattedMessage);
    }
  }

  error(message, ...args) {
    this._log('error', LOG_LEVELS.error, message, ...args);
  }

  warn(message, ...args) {
    this._log('warn', LOG_LEVELS.warn, message, ...args);
  }

  info(message, ...args) {
    this._log('info', LOG_LEVELS.info, message, ...args);
  }

  debug(message, ...args) {
    this._log('debug', LOG_LEVELS.debug, message, ...args);
  }
}

module.exports = function(module) {
  return new Logger(module);
};