const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger')('Backtester');

/**
 * 백테스팅 모듈
 * 과거 데이터를 사용하여 트레이딩 전략 성능 테스트
 */
class Backtester {
  constructor(marketDataManager, config = {}) {
    this.marketDataManager = marketDataManager;
    this.config = {
      initialBalance: 1000000, // 초기 잔고 (KRW)
      tradingFee: 0.0005, // 거래 수수료 (0.05%)
      slippage: 0.001, // 슬리피지 (0.1%)
      ...config
    };
    
    this.results = null;
    this.running = false;
    
    logger.info(`백테스트 모듈 초기화 완료. 초기 잔고: ${this.config.initialBalance.toLocaleString()}원`);
  }

  /**
   * 백테스트 실행
   * @param {Object} strategy - 테스트할 전략 인스턴스
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {String} startDate - 시작 날짜 (YYYY-MM-DD)
   * @param {String} endDate - 종료 날짜 (YYYY-MM-DD)
   * @param {Number} candleUnit - 캔들 분 단위 (1, 3, 5, 15, 30, 60, 240)
   * @returns {Object} - 백테스트 결과
   */
  async runBacktest(strategy, market, startDate, endDate, candleUnit = 60) {
    if (this.running) {
      throw new Error('이미 백테스트가 실행 중입니다.');
    }
    
    this.running = true;
    logger.info(`백테스트 시작: ${strategy.name}, ${market}, ${startDate} ~ ${endDate}, ${candleUnit}분 캔들`);
    
    try {
      // 테스트 기간 내 모든 날짜 생성
      const dates = this._generateDateRange(startDate, endDate);
      
      // 초기 포트폴리오 설정
      const portfolio = {
        cash: this.config.initialBalance,
        assets: {},
        trades: [],
        equityCurve: [{
          timestamp: new Date(`${startDate}T00:00:00Z`).toISOString(),
          equity: this.config.initialBalance
        }]
      };
      
      // 시장 데이터 로드
      let allCandles = [];
      for (const date of dates) {
        const candles = this.marketDataManager.loadDataFromFile('candle', market, date, candleUnit);
        if (candles.length > 0) {
          allCandles = allCandles.concat(candles);
        }
      }
      
      if (allCandles.length === 0) {
        throw new Error(`백테스트 기간 내 데이터가 없습니다: ${market}, ${startDate} ~ ${endDate}`);
      }
      
      // 시간순으로 정렬
      allCandles.sort((a, b) => new Date(a.candle_date_time_utc) - new Date(b.candle_date_time_utc));
      
      // 테스트 컨텍스트 생성
      const context = {
        portfolio,
        currentCandle: null,
        market,
        marketInfo: { 
          korean_name: market.split('-')[1], 
          market: market 
        }
      };
      
      // 전략 초기화
      await strategy.initialize(context);
      
      // 캔들 데이터 순회
      for (const candle of allCandles) {
        context.currentCandle = candle;
        
        // 전략에 데이터 전달
        const signal = await strategy.onData({
          type: 'candle',
          market,
          data: candle
        });
        
        if (signal) {
          // 매매 신호에 따라 주문 실행
          await this._executeOrder(context, signal, candle);
          
          // 포트폴리오 가치 업데이트
          const equity = this._calculatePortfolioValue(context, candle.trade_price);
          context.portfolio.equityCurve.push({
            timestamp: candle.candle_date_time_utc,
            equity
          });
        }
      }
      
      // 백테스트 결과 계산
      this.results = this._calculateResults(context, allCandles);
      
      logger.info(`백테스트 완료: ${strategy.name}, 최종 자산: ${this.results.finalEquity.toLocaleString()}원, 수익률: ${this.results.totalReturn.toFixed(2)}%`);
      return this.results;
    } catch (error) {
      logger.error(`백테스트 오류: ${error.message}`);
      throw error;
    } finally {
      this.running = false;
    }
  }

  /**
   * 주문 실행 시뮬레이션
   * @param {Object} context - 백테스트 컨텍스트
   * @param {String} signal - 매매 신호 (buy, sell)
   * @param {Object} candle - 현재 캔들 데이터
   */
  async _executeOrder(context, signal, candle) {
    const { portfolio, market } = context;
    const price = candle.trade_price;
    const timestamp = candle.candle_date_time_utc;
    const symbol = market.split('-')[1]; // 'KRW-BTC' -> 'BTC'
    
    if (signal === 'buy') {
      // 매수 가능 금액 계산 (현금의 99% 사용)
      const availableCash = portfolio.cash * 0.99;
      
      if (availableCash < 5000) { // 최소 주문 금액
        logger.debug(`매수 무시: 현금 부족 (${availableCash.toFixed(0)}원)`);
        return;
      }
      
      // 슬리피지 적용
      const executionPrice = price * (1 + this.config.slippage);
      
      // 수수료 계산
      const fee = availableCash * this.config.tradingFee;
      
      // 매수 수량 계산
      const quantity = (availableCash - fee) / executionPrice;
      
      // 포트폴리오 업데이트
      portfolio.cash -= (availableCash - fee);
      
      if (!portfolio.assets[symbol]) {
        portfolio.assets[symbol] = { quantity: 0, avgPrice: 0 };
      }
      
      const prevQuantity = portfolio.assets[symbol].quantity;
      const prevAvgPrice = portfolio.assets[symbol].avgPrice;
      
      // 평균 매수가 계산
      portfolio.assets[symbol].quantity += quantity;
      portfolio.assets[symbol].avgPrice = 
        (prevQuantity * prevAvgPrice + quantity * executionPrice) / 
        (prevQuantity + quantity);
      
      // 거래 기록 추가
      portfolio.trades.push({
        type: 'buy',
        market,
        price: executionPrice,
        quantity,
        amount: availableCash,
        fee,
        timestamp
      });
      
      logger.debug(`[백테스트] 매수: ${market}, 가격: ${executionPrice.toFixed(0)}원, 수량: ${quantity.toFixed(8)}, 금액: ${availableCash.toFixed(0)}원`);
    } 
    else if (signal === 'sell') {
      const symbol = market.split('-')[1];
      
      if (!portfolio.assets[symbol] || portfolio.assets[symbol].quantity <= 0) {
        logger.debug(`매도 무시: 보유 자산 없음 (${symbol})`);
        return;
      }
      
      // 보유 수량
      const quantity = portfolio.assets[symbol].quantity;
      
      // 슬리피지 적용
      const executionPrice = price * (1 - this.config.slippage);
      
      // 매도 금액 계산
      const amount = quantity * executionPrice;
      
      // 수수료 계산
      const fee = amount * this.config.tradingFee;
      
      // 포트폴리오 업데이트
      portfolio.cash += (amount - fee);
      portfolio.assets[symbol].quantity = 0;
      
      // 거래 기록 추가
      portfolio.trades.push({
        type: 'sell',
        market,
        price: executionPrice,
        quantity,
        amount,
        fee,
        timestamp
      });
      
      logger.debug(`[백테스트] 매도: ${market}, 가격: ${executionPrice.toFixed(0)}원, 수량: ${quantity.toFixed(8)}, 금액: ${amount.toFixed(0)}원`);
    }
  }

  /**
   * 포트폴리오 가치 계산
   * @param {Object} context - 백테스트 컨텍스트
   * @param {Number} currentPrice - 현재 가격
   * @returns {Number} - 총 포트폴리오 가치
   */
  _calculatePortfolioValue(context, currentPrice) {
    const { portfolio, market } = context;
    const symbol = market.split('-')[1];
    
    let assetValue = 0;
    if (portfolio.assets[symbol] && portfolio.assets[symbol].quantity > 0) {
      assetValue = portfolio.assets[symbol].quantity * currentPrice;
    }
    
    return portfolio.cash + assetValue;
  }

  /**
   * 백테스트 결과 계산
   * @param {Object} context - 백테스트 컨텍스트
   * @param {Array} candles - 캔들 데이터
   * @returns {Object} - 백테스트 결과
   */
  _calculateResults(context, candles) {
    const { portfolio } = context;
    const trades = portfolio.trades;
    const equityCurve = portfolio.equityCurve;
    
    // 최종 자산 가치
    const initialEquity = this.config.initialBalance;
    const finalEquity = equityCurve[equityCurve.length - 1].equity;
    
    // 수익률 계산
    const totalReturn = ((finalEquity / initialEquity) - 1) * 100;
    
    // 연간 수익률 계산
    const startDate = new Date(candles[0].candle_date_time_utc);
    const endDate = new Date(candles[candles.length - 1].candle_date_time_utc);
    const yearFraction = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    const annualizedReturn = (Math.pow((finalEquity / initialEquity), (1 / yearFraction)) - 1) * 100;
    
    // 최대 낙폭 계산
    let maxEquity = initialEquity;
    let maxDrawdown = 0;
    
    for (const point of equityCurve) {
      const equity = point.equity;
      if (equity > maxEquity) {
        maxEquity = equity;
      }
      
      const drawdown = ((maxEquity - equity) / maxEquity) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // 거래 통계
    const buyTrades = trades.filter(trade => trade.type === 'buy');
    const sellTrades = trades.filter(trade => trade.type === 'sell');
    
    let winningTrades = 0;
    let losingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    // 각 매도 거래에 대해 수익/손실 계산
    for (const sellTrade of sellTrades) {
      // 이 매도와 관련된 모든 매수 찾기
      const buyAmount = trades
        .filter(t => t.type === 'buy' && t.market === sellTrade.market && new Date(t.timestamp) < new Date(sellTrade.timestamp))
        .reduce((sum, t) => sum + t.amount, 0);
      
      const profit = sellTrade.amount - buyAmount;
      
      if (profit > 0) {
        winningTrades++;
        totalProfit += profit;
      } else {
        losingTrades++;
        totalLoss += Math.abs(profit);
      }
    }
    
    const winRate = sellTrades.length > 0 ? (winningTrades / sellTrades.length) * 100 : 0;
    const averageProfit = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    return {
      initialEquity,
      finalEquity,
      totalReturn,
      annualizedReturn,
      maxDrawdown,
      tradeCount: trades.length,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      winningTrades,
      losingTrades,
      winRate,
      averageProfit,
      averageLoss,
      profitFactor,
      equityCurve,
      trades
    };
  }

  /**
   * 날짜 범위 생성
   * @param {String} startDate - 시작 날짜 (YYYY-MM-DD)
   * @param {String} endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns {Array} - 날짜 목록
   */
  _generateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  }

  /**
   * 백테스트 결과 보고서 생성
   * @param {String} filePath - 결과 파일 경로
   */
  saveResults(filePath) {
    if (!this.results) {
      throw new Error('백테스트 결과가 없습니다. 먼저 runBacktest()를 실행하세요.');
    }
    
    try {
      // 디렉토리 확인
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 결과 저장
      fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
      logger.info(`백테스트 결과 저장 완료: ${filePath}`);
    } catch (error) {
      logger.error(`백테스트 결과 저장 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 백테스트 결과 불러오기
   * @param {String} filePath - 결과 파일 경로
   * @returns {Object} - 백테스트 결과
   */
  loadResults(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`파일이 존재하지 않음: ${filePath}`);
      }
      
      const rawData = fs.readFileSync(filePath, 'utf8');
      this.results = JSON.parse(rawData);
      
      logger.info(`백테스트 결과 로드 완료: ${filePath}`);
      return this.results;
    } catch (error) {
      logger.error(`백테스트 결과 로드 실패: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Backtester;