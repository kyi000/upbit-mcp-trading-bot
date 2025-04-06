const TradingStrategy = require('./TradingStrategy');

/**
 * RSI 오버솔드/오버바웃 전략
 * RSI가 과매수 영역(70 이상)에 진입하면 매도
 * RSI가 과매도 영역(30 이하)에 진입하면 매수
 */
class RSIStrategy extends TradingStrategy {
  constructor() {
    super(
      'RSI',
      'RSI 오버솔드/오버바웃 전략',
      {
        period: 14,        // RSI 계산 기간
        overbought: 70,    // 과매수 기준
        oversold: 30,      // 과매도 기준
        tradeAmount: 10000, // 매매 금액 (KRW)
      }
    );
    
    this.candles = {};
    this.position = {};
    this.rsiValues = {};
  }

  /**
   * 전략 초기화
   * @param {Object} context - 전략 컨텍스트
   */
  async initialize(context) {
    await super.initialize(context);
    
    // 초기화 작업
    this.orderExecutor = context.orderExecutor;
    this.dataManager = context.dataManager;
    this.markets = context.markets;
    
    // 각 마켓 별 캔들 데이터 저장소 초기화
    for (const market of this.markets) {
      this.candles[market] = [];
      this.position[market] = 'none'; // 'none', 'long'
      this.rsiValues[market] = [];
    }
    
    this.logger.info(`${this.name} 전략 초기화 완료. 마켓: ${this.markets.join(', ')}`);
  }

  /**
   * 새로운 데이터 처리
   * @param {Object} data - 시장 데이터
   * @returns {String|null} - 매매 신호 (buy, sell, null)
   */
  async onData(data) {
    // 캔들 데이터만 처리
    if (data.type !== 'candle') {
      return null;
    }
    
    const market = data.market;
    const candleData = data.data;
    
    // 캔들 데이터 저장
    this.candles[market].push({
      timestamp: candleData.candle_date_time_utc,
      open: candleData.opening_price,
      high: candleData.high_price,
      low: candleData.low_price,
      close: candleData.trade_price,
      volume: candleData.candle_acc_trade_volume
    });
    
    // 최대 300개 캔들만 유지
    if (this.candles[market].length > 300) {
      this.candles[market].shift();
    }
    
    // 필요한 캔들 수 확인 (RSI 계산에는 최소 period+1 개의 캔들이 필요)
    if (this.candles[market].length <= this.params.period) {
      this.logger.debug(`${market}: 충분한 캔들 데이터 없음 (${this.candles[market].length}/${this.params.period+1})`);
      return null;
    }
    
    // RSI 계산
    const closeValues = this.candles[market].map(candle => candle.close);
    const currentRSI = this._calculateRSI(closeValues, this.params.period);
    
    // RSI 값 저장
    this.rsiValues[market].push(currentRSI);
    
    // 최대 10개 RSI 값만 유지
    if (this.rsiValues[market].length > 10) {
      this.rsiValues[market].shift();
    }
    
    // 이전 RSI 값
    const prevRSI = this.rsiValues[market].length > 1 ? 
      this.rsiValues[market][this.rsiValues[market].length - 2] : currentRSI;
    
    // 신호 생성
    let signal = null;
    
    // 과매도 영역에서 회복 시 매수
    if (prevRSI <= this.params.oversold && currentRSI > this.params.oversold) {
      if (this.position[market] !== 'long') {
        signal = 'buy';
        this.position[market] = 'long';
      }
    }
    // 과매수 영역에서 하락 시 매도
    else if (prevRSI >= this.params.overbought && currentRSI < this.params.overbought) {
      if (this.position[market] === 'long') {
        signal = 'sell';
        this.position[market] = 'none';
      }
    }
    
    if (signal) {
      this.logger.info(`${market} 신호 발생: ${signal}, RSI: ${currentRSI.toFixed(2)}`);
    }
    
    return signal;
  }

  /**
   * 매매 신호 처리
   * @param {String} signal - 매매 신호 (buy, sell)
   * @param {Object} data - 신호가 발생한 데이터
   */
  async onSignal(signal, data) {
    await super.onSignal(signal, data);
    
    const market = data.market || data.code;
    const price = data.trade_price;
    
    try {
      if (signal === 'buy') {
        // 매수 주문
        await this.orderExecutor.buy(
          market,
          price,
          this.params.tradeAmount,
          `${this.name} 매수 신호 (RSI: ${this.rsiValues[market][this.rsiValues[market].length - 1].toFixed(2)})`
        );
      } else if (signal === 'sell') {
        // 계좌 정보 조회
        const accounts = await upbitClient.getAccounts();
        
        // 마켓에 해당하는 자산 찾기
        const currency = market.split('-')[1]; // 'KRW-BTC' -> 'BTC'
        const asset = accounts.find(a => a.currency === currency);
        
        if (asset && parseFloat(asset.balance) > 0) {
          // 보유 자산이 있으면 매도
          await this.orderExecutor.sell(
            market,
            price,
            parseFloat(asset.balance),
            `${this.name} 매도 신호 (RSI: ${this.rsiValues[market][this.rsiValues[market].length - 1].toFixed(2)})`
          );
        }
      }
    } catch (error) {
      this.logger.error(`주문 실행 실패: ${error.message}`);
    }
  }

  /**
   * RSI 계산
   * @param {Array} prices - 가격 배열
   * @param {Number} period - 기간
   * @returns {Number} - RSI 값 (0-100)
   */
  _calculateRSI(prices, period) {
    if (prices.length <= period) {
      return 50; // 기본값
    }
    
    // 가격 변동 계산
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    // period 동안의 변동만 사용
    const recentChanges = changes.slice(-period);
    
    // 상승/하락 계산
    let gains = 0;
    let losses = 0;
    
    for (const change of recentChanges) {
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    // 평균 상승/하락
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    // 상대강도(RS) 계산
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    
    // RSI 계산
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
}

module.exports = RSIStrategy;