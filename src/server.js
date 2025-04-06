const express = require('express');
const cors = require('cors');
const upbitClient = require('./upbitClient');
const tradingRouter = require('./tradingRouter');
const config = require('../config/config');
const logger = require('./utils/logger')('Server');

// Express 서버 초기화
const app = express();
app.use(express.json());
app.use(cors());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 상태 확인 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 계정 정보 조회 엔드포인트
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await upbitClient.getAccounts();
    res.json(accounts);
  } catch (error) {
    logger.error('Error getting accounts:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 마켓 정보 조회 엔드포인트
app.get('/api/markets', async (req, res) => {
  try {
    const markets = await upbitClient.getMarkets();
    res.json(markets);
  } catch (error) {
    logger.error('Error getting markets:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 시세 조회 엔드포인트
app.get('/api/ticker', async (req, res) => {
  try {
    const { markets } = req.query;
    if (!markets) {
      return res.status(400).json({ error: 'markets parameter is required' });
    }
    const ticker = await upbitClient.getTicker(markets);
    res.json(ticker);
  } catch (error) {
    logger.error('Error getting ticker:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 호가 정보 조회 엔드포인트
app.get('/api/orderbook', async (req, res) => {
  try {
    const { markets } = req.query;
    if (!markets) {
      return res.status(400).json({ error: 'markets parameter is required' });
    }
    const orderbook = await upbitClient.getOrderbook(markets);
    res.json(orderbook);
  } catch (error) {
    logger.error('Error getting orderbook:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 캔들 데이터 조회 엔드포인트
app.get('/api/candles', async (req, res) => {
  try {
    const { market, unit, count } = req.query;
    if (!market || !unit) {
      return res.status(400).json({ error: 'market and unit parameters are required' });
    }
    const candles = await upbitClient.getCandles(market, unit, count || 200);
    res.json(candles);
  } catch (error) {
    logger.error('Error getting candles:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 주문 생성 엔드포인트
app.post('/api/orders', async (req, res) => {
  try {
    const { market, side, volume, price, ord_type } = req.body;
    if (!market || !side || !ord_type) {
      return res.status(400).json({ error: 'market, side, and ord_type are required' });
    }
    logger.info(`Creating order: ${market} ${side} ${volume} ${price} ${ord_type}`);
    const order = await upbitClient.createOrder(market, side, volume, price, ord_type);
    res.json(order);
  } catch (error) {
    logger.error('Error creating order:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 주문 취소 엔드포인트
app.delete('/api/orders/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    if (!uuid) {
      return res.status(400).json({ error: 'uuid parameter is required' });
    }
    logger.info(`Cancelling order: ${uuid}`);
    const result = await upbitClient.cancelOrder(uuid);
    res.json(result);
  } catch (error) {
    logger.error('Error cancelling order:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 주문 조회 엔드포인트
app.get('/api/orders/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    if (!uuid) {
      return res.status(400).json({ error: 'uuid parameter is required' });
    }
    const order = await upbitClient.getOrder(uuid);
    res.json(order);
  } catch (error) {
    logger.error('Error getting order:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 트레이딩 라우터 추가 (트레이딩 봇 API)
app.use('/api/trading', tradingRouter);

// 정적 파일 제공 (대시보드 UI)
app.use(express.static('public'));

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 서버 시작
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Upbit MCP Server is listening on port ${PORT}`);
});

module.exports = app;