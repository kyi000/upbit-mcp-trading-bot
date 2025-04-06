/**
 * 트레이딩 관련 API 라우터
 * 이 파일은 트레이딩 봇 기능에 접근하기 위한 API 엔드포인트를 제공합니다.
 */
const express = require('express');
const logger = require('./utils/logger')('TradingRouter');

// 임시 응답을 위한 라우터
const router = express.Router();

/**
 * 실제 구현을 위해선 다음 모듈을 불러와야 합니다:
 * const TradingManager = require('./trading/TradingManager');
 * 
 * // 트레이딩 매니저 인스턴스 생성
 * const tradingManager = new TradingManager({
 *   enableTrading: false // 기본적으로 실제 거래는 비활성화
 * });
 * 
 * // 초기화
 * (async () => {
 *   try {
 *     await tradingManager.initialize();
 *     logger.info('트레이딩 매니저 초기화 완료');
 *   } catch (error) {
 *     logger.error(`트레이딩 매니저 초기화 실패: ${error.message}`);
 *   }
 * })();
 */

/**
 * 전략 목록 조회
 */
router.get('/strategies', (req, res) => {
  logger.info('전략 목록 조회 요청');
  
  // 샘플 응답
  const strategies = [
    'MovingAverageCross',
    'RSI'
  ];
  
  res.json({ strategies });
});

/**
 * 활성화된 전략 조회
 */
router.get('/strategies/active', (req, res) => {
  logger.info('활성 전략 조회 요청');
  
  // 샘플 응답
  const activeStrategies = [];
  
  res.json({ activeStrategies });
});

/**
 * 전략 활성화
 */
router.post('/strategies/:name/activate', async (req, res) => {
  const { name } = req.params;
  const { markets, params } = req.body;
  
  logger.info(`전략 활성화 요청: ${name}, 마켓: ${markets?.join(', ') || '없음'}`);
  
  if (!markets || !Array.isArray(markets) || markets.length === 0) {
    return res.status(400).json({ error: 'markets는 필수 항목이며 배열 형태여야 합니다.' });
  }
  
  // 샘플 응답
  res.json({ 
    success: true, 
    message: `${name} 전략이 활성화되었습니다. 구현 시 tradingManager.activateStrategy(name, markets, params)를 호출하세요.` 
  });
});

/**
 * 전략 비활성화
 */
router.post('/strategies/:name/deactivate', (req, res) => {
  const { name } = req.params;
  
  logger.info(`전략 비활성화 요청: ${name}`);
  
  // 샘플 응답
  res.json({ 
    success: true, 
    message: `${name} 전략이 비활성화되었습니다. 구현 시 tradingManager.deactivateStrategy(name)를 호출하세요.` 
  });
});

/**
 * 백테스트 실행
 */
router.post('/backtest', async (req, res) => {
  const { strategyName, market, startDate, endDate, candleUnit, params } = req.body;
  
  logger.info(`백테스트 요청: ${strategyName}, 마켓: ${market}, 기간: ${startDate} ~ ${endDate}`);
  
  if (!strategyName || !market || !startDate || !endDate) {
    return res.status(400).json({ 
      error: 'strategyName, market, startDate, endDate는 필수 항목입니다.' 
    });
  }
  
  // 샘플 응답 (진짜 백테스트 결과는 tradingManager.runBacktest()로 생성해야 합니다)
  const results = {
    initialEquity: 1000000,
    finalEquity: 1120000,
    totalReturn: 12.0,
    annualizedReturn: 35.6,
    maxDrawdown: 8.2,
    tradeCount: 48,
    winRate: 62.5,
    equityCurve: [
      { timestamp: startDate + 'T00:00:00Z', equity: 1000000 },
      { timestamp: endDate + 'T00:00:00Z', equity: 1120000 }
    ],
    trades: []
  };
  
  res.json({ results });
});

/**
 * 주문 이력 조회
 */
router.get('/orders/history', (req, res) => {
  logger.info('주문 이력 조회 요청');
  
  // 샘플 응답
  const orderHistory = [];
  
  res.json({ orderHistory });
});

/**
 * 트레이딩 설정 조회
 */
router.get('/config', (req, res) => {
  logger.info('트레이딩 설정 조회 요청');
  
  // 샘플 응답
  res.json({ 
    enableTrading: false,
    dataDir: 'data'
  });
});

/**
 * 트레이딩 설정 업데이트
 */
router.put('/config', (req, res) => {
  const { enableTrading } = req.body;
  
  logger.info(`트레이딩 설정 업데이트 요청: enableTrading=${enableTrading}`);
  
  // 샘플 응답
  res.json({ 
    success: true, 
    message: `트레이딩 설정이 업데이트되었습니다.`,
    enableTrading: enableTrading === true
  });
});

/**
 * 데이터 수집 시작
 */
router.post('/data/start', async (req, res) => {
  const { markets } = req.body;
  
  logger.info(`데이터 수집 시작 요청: 마켓=${markets?.join(', ') || '없음'}`);
  
  if (!markets || !Array.isArray(markets) || markets.length === 0) {
    return res.status(400).json({ error: 'markets는 필수 항목이며 배열 형태여야 합니다.' });
  }
  
  // 샘플 응답
  res.json({ 
    success: true, 
    message: `${markets.length}개 마켓의 데이터 수집이 시작되었습니다.` 
  });
});

/**
 * 데이터 수집 중단
 */
router.post('/data/stop', (req, res) => {
  logger.info('데이터 수집 중단 요청');
  
  // 샘플 응답
  res.json({ success: true, message: '데이터 수집이 중단되었습니다.' });
});

module.exports = router;