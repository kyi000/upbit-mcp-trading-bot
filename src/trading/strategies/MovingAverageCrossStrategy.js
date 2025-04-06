const TradingStrategy = require('./TradingStrategy');

/**
 * 이동평균선 교차 전략
 * 단기 이동평균선이 장기 이동평균선을 상향 돌파하면 매수
 * 단기 이동평균선이 장기 이동평균선을 하향 돌파하면 매도
 */
class MovingAverageCrossStrategy extends TradingStrategy {
  constructor() {
    super(
      'MovingAverageCross', 
      '이동평균선 교차 전략', 
      {
        shortPeriod: 5,   // 단기 이동평균선 기간
        longPeriod: 20,   // 장기 이동평균선 기간
        tradeAmount: 10000, // 매매 금액 (KRW)
      }
    );
    
    this.candles = {};
    this.position = {};
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
    
    // 최대 100개 캔들만 유지
    if (this.candles[market].length > 100) {
      this.candles[market].shift();
    }
    
    // 필요한 캔들 수 확인
    if (this.candles[market].length < this.params.longPeriod) {
      this.logger.debug(`${market}: 충분한 캔들 데이터 없음 (${this.candles[market].length}/${this.params.longPeriod})`);
      return null;
    }
    
    // 이동평균 계산
    const closeValues = this.candles[market].map(candle => candle.close);
    const shortMA = this._calculateSMA(closeValues, this.params.shortPeriod);
    const longMA = this._calculateSMA(closeValues, this.params.longPeriod);
    
    // 이전 캔들의 이동평균
    const prevCloseValues = closeValues.slice(0, -1);
    const prevShortMA = this._calculateSMA(prevCloseValues, this.params.shortPeriod);
    const prevLongMA = this._calculateSMA(prevCloseValues, this.params.longPeriod);
    
    // 신호 생성
    let signal = null;
    
    // 골든 크로스 (단기선이 장기선을 상향 돌파)
    if (prevShortMA < prevLongMA && shortMA > longMA) {
      if (this.position[market] !== 'long') {
        signal = 'buy';
        this.position[market] = 'long';
      }
    }
    // 데드 크로스 (단기선이 장기선을 하향 돌파)
    else if (prevShortMA > prevLongMA && shortMA < longMA) {
      if (this.position[market] === 'long') {
        signal = 'sell';
        this.position[market] = 'none';
      }
    }
    
    if (signal) {
      this.logger.info(`${market} 신호 발생: ${signal}, 단기MA: ${shortMA.toFixed(2)}, 장기MA: ${longMA.toFixed(2)}`);
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
          `${this.name} 매수 신호`
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
            `${this.name} 매도 신호`
          );
        }
      }
    } catch (error) {
      this.logger.error(`주문 실행 실패: ${error.message}`);
    }
  }

  /**
   * 단순 이동평균 계산
   * @param {Array} values - 가격 배열
   * @param {Number} period - 기간
   * @returns {Number} - 이동평균값
   */
  _calculateSMA(values, period) {
    if (values.length < period) {
      return 0;
    }
    
    const sliced = values.slice(-period);
    const sum = sliced.reduce((acc, val) => acc + val, 0);
    return sum / period;
  }
}

module.exports = MovingAverageCrossStrategy;