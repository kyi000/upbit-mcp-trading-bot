require('dotenv').config();

const config = {
  upbit: {
    accessKey: process.env.ACCESS_KEY,
    secretKey: process.env.SECRET_KEY,
    baseUrl: 'https://api.upbit.com',
    websocketUrl: 'wss://api.upbit.com/websocket/v1'
  },
  server: {
    port: process.env.SERVER_PORT || 3000
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    directory: 'logs'
  }
};

module.exports = config;