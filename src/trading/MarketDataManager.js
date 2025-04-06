const fs = require('fs');
const path = require('path');
const upbitClient = require('../upbitClient');
const logger = require('../utils/logger')('MarketDataManager');

/**
 * 시장 데이터 관리 모듈
 * 실시간 데이터 및 히스토리 데이터 관리
 */
class MarketDataManager {
  constructor(config = {}) {
    this.config = {
      dataDir: path.join(__dirname, '../../data'),
      keepDays: 30, // 데이터 보관 기간 (일)
      collectInterval: 60, // 데이터 수집 간격 (초)
      ...config
    };
    
    // 저장된 데이터 캐시
    this.tickerCache = new Map();
    this.candleCache = new Map();
    this.orderbookCache = new Map();
    
    // 구독 관리
    this.subscribers = {
      ticker: new Map(),
      orderbook: new Map(),
      candle: new Map()
    };
    
    // 초기화
    this._initializeDataDirectory();
    
    logger.info(`시장 데이터 관리자 초기화 완료. 데이터 디렉토리: ${this.config.dataDir}`);
  }

  /**
   * 데이터 디렉토리 초기화
   */
  _initializeDataDirectory() {
    const dirs = [
      this.config.dataDir,
      path.join(this.config.dataDir, 'ticker'),
      path.join(this.config.dataDir, 'candle'),
      path.join(this.config.dataDir, 'orderbook')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`디렉토리 생성됨: ${dir}`);
      }
    });
  }

  /**
   * 마켓 정보 가져오기
   * @returns {Array} - 마켓 목록
   */
  async getMarkets() {
    try {
      const markets = await upbitClient.getMarkets();
      // KRW 마켓만 필터링
      const krwMarkets = markets.filter(market => market.market.startsWith('KRW-'));
      return krwMarkets;
    } catch (error) {
      logger.error(`마켓 정보 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 현재가 정보 가져오기
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @returns {Object} - 현재가 정보
   */
  async getTicker(market) {
    try {
      const ticker = await upbitClient.getTicker(market);
      
      // 캐시 업데이트
      this.tickerCache.set(market, {
        data: ticker[0],
        timestamp: Date.now()
      });
      
      // 구독자에게 알림
      if (this.subscribers.ticker.has(market)) {
        this.subscribers.ticker.get(market).forEach(callback => {
          try {
            callback(ticker[0]);
          } catch (err) {
            logger.error(`구독자 콜백 실행 오류: ${err.message}`);
          }
        });
      }
      
      return ticker[0];
    } catch (error) {
      logger.error(`현재가 정보 조회 실패 (${market}): ${error.message}`);
      
      // 캐시 데이터 반환 (있는 경우)
      if (this.tickerCache.has(market)) {
        logger.info(`${market} 캐시 데이터 반환 (${Date.now() - this.tickerCache.get(market).timestamp}ms 이전)`);
        return this.tickerCache.get(market).data;
      }
      
      throw error;
    }
  }

  /**
   * 여러 마켓의 현재가 정보 가져오기
   * @param {Array} markets - 마켓 코드 목록
   * @returns {Array} - 현재가 정보 목록
   */
  async getMultipleTickers(markets) {
    try {
      // API 호출 제한 고려: 최대 100개씩 나누어 요청
      const chunkSize = 100;
      const results = [];
      
      for (let i = 0; i < markets.length; i += chunkSize) {
        const chunk = markets.slice(i, i + chunkSize);
        const marketCodes = chunk.join(',');
        const tickers = await upbitClient.getTicker(marketCodes);
        results.push(...tickers);
        
        // API 호출 제한 방지를 위한 딜레이
        if (i + chunkSize < markets.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // 캐시 및 구독자 처리
      results.forEach(ticker => {
        const market = ticker.market;
        
        // 캐시 업데이트
        this.tickerCache.set(market, {
          data: ticker,
          timestamp: Date.now()
        });
        
        // 구독자에게 알림
        if (this.subscribers.ticker.has(market)) {
          this.subscribers.ticker.get(market).forEach(callback => {
            try {
              callback(ticker);
            } catch (err) {
              logger.error(`구독자 콜백 실행 오류: ${err.message}`);
            }
          });
        }
      });
      
      return results;
    } catch (error) {
      logger.error(`다중 현재가 정보 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 캔들 데이터 가져오기
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {Number} unit - 분 단위 (1, 3, 5, 15, 30, 60, 240)
   * @param {Number} count - 캔들 개수 (최대 200)
   * @returns {Array} - 캔들 데이터
   */
  async getCandles(market, unit = 60, count = 200) {
    const cacheKey = `${market}-${unit}`;
    
    try {
      const candles = await upbitClient.getCandles(market, unit, count);
      
      // 캐시 업데이트
      this.candleCache.set(cacheKey, {
        data: candles,
        timestamp: Date.now()
      });
      
      // 구독자에게 알림
      if (this.subscribers.candle.has(cacheKey)) {
        this.subscribers.candle.get(cacheKey).forEach(callback => {
          try {
            callback(candles);
          } catch (err) {
            logger.error(`구독자 콜백 실행 오류: ${err.message}`);
          }
        });
      }
      
      return candles;
    } catch (error) {
      logger.error(`캔들 데이터 조회 실패 (${market}, ${unit}분): ${error.message}`);
      
      // 캐시 데이터 반환 (있는 경우)
      if (this.candleCache.has(cacheKey)) {
        logger.info(`${cacheKey} 캐시 데이터 반환 (${Date.now() - this.candleCache.get(cacheKey).timestamp}ms 이전)`);
        return this.candleCache.get(cacheKey).data;
      }
      
      throw error;
    }
  }

  /**
   * 호가 정보 가져오기
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @returns {Object} - 호가 정보
   */
  async getOrderbook(market) {
    try {
      const orderbook = await upbitClient.getOrderbook(market);
      
      // 캐시 업데이트
      this.orderbookCache.set(market, {
        data: orderbook[0],
        timestamp: Date.now()
      });
      
      // 구독자에게 알림
      if (this.subscribers.orderbook.has(market)) {
        this.subscribers.orderbook.get(market).forEach(callback => {
          try {
            callback(orderbook[0]);
          } catch (err) {
            logger.error(`구독자 콜백 실행 오류: ${err.message}`);
          }
        });
      }
      
      return orderbook[0];
    } catch (error) {
      logger.error(`호가 정보 조회 실패 (${market}): ${error.message}`);
      
      // 캐시 데이터 반환 (있는 경우)
      if (this.orderbookCache.has(market)) {
        logger.info(`${market} 캐시 데이터 반환 (${Date.now() - this.orderbookCache.get(market).timestamp}ms 이전)`);
        return this.orderbookCache.get(market).data;
      }
      
      throw error;
    }
  }

  /**
   * 데이터 구독하기
   * @param {String} type - 데이터 타입 (ticker, candle, orderbook)
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {Function} callback - 데이터 수신 시 호출할 콜백 함수
   * @param {Number} unit - 캔들 분 단위 (캔들 데이터인 경우만)
   * @returns {Function} - 구독 취소 함수
   */
  subscribe(type, market, callback, unit = null) {
    let key = market;
    
    if (type === 'candle' && unit !== null) {
      key = `${market}-${unit}`;
    }
    
    if (!this.subscribers[type].has(key)) {
      this.subscribers[type].set(key, []);
    }
    
    this.subscribers[type].get(key).push(callback);
    logger.info(`${type} 데이터 구독 추가: ${key}`);
    
    // 구독 취소 함수 반환
    return () => {
      if (this.subscribers[type].has(key)) {
        const callbacks = this.subscribers[type].get(key).filter(cb => cb !== callback);
        
        if (callbacks.length === 0) {
          this.subscribers[type].delete(key);
          logger.info(`${type} 데이터 구독 전체 취소: ${key}`);
        } else {
          this.subscribers[type].set(key, callbacks);
          logger.info(`${type} 데이터 단일 구독 취소: ${key}`);
        }
      }
    };
  }

  /**
   * 데이터를 파일로 저장
   * @param {String} type - 데이터 타입 (ticker, candle, orderbook)
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {Object|Array} data - 저장할 데이터
   * @param {Number} unit - 캔들 분 단위 (캔들 데이터인 경우만)
   */
  saveDataToFile(type, market, data, unit = null) {
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    let filePath;
    if (type === 'candle' && unit !== null) {
      filePath = path.join(this.config.dataDir, type, `${market}-${unit}-${dateString}.json`);
    } else {
      filePath = path.join(this.config.dataDir, type, `${market}-${dateString}.json`);
    }
    
    let fileData = [];
    
    // 기존 파일이 있으면 읽기
    if (fs.existsSync(filePath)) {
      try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        fileData = JSON.parse(rawData);
      } catch (error) {
        logger.error(`파일 읽기 실패: ${filePath}, ${error.message}`);
      }
    }
    
    // 데이터 추가
    if (Array.isArray(data)) {
      fileData.push(...data);
    } else {
      fileData.push({
        ...data,
        timestamp: now.toISOString()
      });
    }
    
    // 파일 저장
    try {
      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
      logger.debug(`데이터 저장 완료: ${filePath}`);
    } catch (error) {
      logger.error(`파일 저장 실패: ${filePath}, ${error.message}`);
    }
  }

  /**
   * 저장된 데이터 불러오기
   * @param {String} type - 데이터 타입 (ticker, candle, orderbook)
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {String} date - 날짜 (YYYY-MM-DD)
   * @param {Number} unit - 캔들 분 단위 (캔들 데이터인 경우만)
   * @returns {Array} - 불러온 데이터
   */
  loadDataFromFile(type, market, date, unit = null) {
    let filePath;
    if (type === 'candle' && unit !== null) {
      filePath = path.join(this.config.dataDir, type, `${market}-${unit}-${date}.json`);
    } else {
      filePath = path.join(this.config.dataDir, type, `${market}-${date}.json`);
    }
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`파일이 존재하지 않음: ${filePath}`);
      return [];
    }
    
    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      logger.error(`파일 읽기 실패: ${filePath}, ${error.message}`);
      return [];
    }
  }

  /**
   * 오래된 데이터 정리
   */
  cleanupOldData() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - this.config.keepDays * 24 * 60 * 60 * 1000);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const types = ['ticker', 'candle', 'orderbook'];
    
    types.forEach(type => {
      const dirPath = path.join(this.config.dataDir, type);
      
      if (!fs.existsSync(dirPath)) {
        return;
      }
      
      fs.readdirSync(dirPath).forEach(file => {
        const filePath = path.join(dirPath, file);
        
        // 파일 이름에서 날짜 추출 (예: KRW-BTC-2023-01-01.json)
        const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/);
        if (!dateMatch) {
          return;
        }
        
        const fileDate = dateMatch[0];
        
        if (fileDate < cutoffDateString) {
          try {
            fs.unlinkSync(filePath);
            logger.info(`오래된 데이터 파일 삭제: ${filePath}`);
          } catch (error) {
            logger.error(`파일 삭제 실패: ${filePath}, ${error.message}`);
          }
        }
      });
    });
  }

  /**
   * 데이터 수집 시작
   * @param {Array} markets - 수집할 마켓 코드 목록
   */
  startDataCollection(markets) {
    this.stopDataCollection(); // 기존 수집 중단
    
    this.collectionInterval = setInterval(async () => {
      try {
        // 현재가 데이터 수집
        const tickers = await this.getMultipleTickers(markets);
        
        // 파일로 저장
        tickers.forEach(ticker => {
          this.saveDataToFile('ticker', ticker.market, ticker);
        });
        
        logger.info(`${markets.length}개 마켓의 현재가 데이터 수집 완료`);
      } catch (error) {
        logger.error(`데이터 수집 오류: ${error.message}`);
      }
    }, this.config.collectInterval * 1000);
    
    // 오래된 데이터 정리 (매일 자정)
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msToMidnight = midnight.getTime() - Date.now();
    
    setTimeout(() => {
      this.cleanupOldData();
      
      // 매일 반복
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldData();
      }, 24 * 60 * 60 * 1000);
    }, msToMidnight);
    
    logger.info(`데이터 수집 시작: ${markets.length}개 마켓, ${this.config.collectInterval}초 간격`);
  }

  /**
   * 데이터 수집 중단
   */
  stopDataCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      logger.info('데이터 수집 중단');
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = MarketDataManager;