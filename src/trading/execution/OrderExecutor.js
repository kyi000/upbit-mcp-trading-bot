const upbitClient = require('../../upbitClient');
const logger = require('../../utils/logger')('OrderExecutor');

/**
 * 주문 실행 모듈
 * 트레이딩 전략에서 생성된 신호를 실제 주문으로 변환
 */
class OrderExecutor {
  constructor(config = {}) {
    this.config = {
      maxOrderAmount: 100000, // 최대 주문 금액 (KRW)
      defaultOrderAmount: 10000, // 기본 주문 금액 (KRW)
      slippageTolerance: 0.005, // 슬리피지 허용 범위 (0.5%)
      enableRealTrading: false, // 실제 거래 활성화 여부 (기본값: 비활성화)
      ...config
    };
    
    this.orderHistory = [];
    this.activeOrders = new Map();
    
    logger.info(`주문 실행기 초기화됨. 실제 거래: ${this.config.enableRealTrading ? '활성화' : '비활성화'}`);
  }

  /**
   * 매수 주문 실행
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {Number} price - 주문 가격
   * @param {Number} amount - 주문 금액 (KRW)
   * @param {String} reason - 주문 사유
   * @returns {Object} - 주문 결과
   */
  async buy(market, price, amount = null, reason = '') {
    const orderAmount = amount || this.config.defaultOrderAmount;
    
    // 최대 주문 금액 확인
    if (orderAmount > this.config.maxOrderAmount) {
      logger.warn(`주문 금액(${orderAmount})이 최대 허용 금액(${this.config.maxOrderAmount})을 초과합니다. 금액이 조정됩니다.`);
    }
    
    const finalAmount = Math.min(orderAmount, this.config.maxOrderAmount);
    const volume = parseFloat((finalAmount / price).toFixed(8)); // 주문 수량 계산
    
    logger.info(`매수 주문 시도: ${market}, 가격: ${price}, 수량: ${volume}, 금액: ${finalAmount}, 사유: ${reason}`);
    
    try {
      if (this.config.enableRealTrading) {
        // 실제 거래 실행
        const order = await upbitClient.createOrder(market, 'bid', volume, price, 'limit');
        this.activeOrders.set(order.uuid, {
          ...order,
          strategy: reason
        });
        
        logger.info(`매수 주문 성공: ${order.uuid}`);
        this.orderHistory.push({
          type: 'buy',
          market,
          price,
          volume,
          amount: finalAmount,
          timestamp: new Date().toISOString(),
          reason,
          orderId: order.uuid,
          status: 'submitted'
        });
        
        return order;
      } else {
        // 테스트 모드 (실제 거래 X)
        const mockOrder = {
          uuid: `mock-${Date.now()}`,
          market,
          side: 'bid',
          price: price.toString(),
          volume: volume.toString(),
          created_at: new Date().toISOString(),
          status: 'wait',
        };
        
        logger.info(`[테스트 모드] 매수 주문 시뮬레이션: ${mockOrder.uuid}`);
        this.orderHistory.push({
          type: 'buy',
          market,
          price,
          volume,
          amount: finalAmount,
          timestamp: new Date().toISOString(),
          reason,
          orderId: mockOrder.uuid,
          status: 'simulated'
        });
        
        return mockOrder;
      }
    } catch (error) {
      logger.error(`매수 주문 실패: ${error.message}`);
      this.orderHistory.push({
        type: 'buy',
        market,
        price,
        volume,
        amount: finalAmount,
        timestamp: new Date().toISOString(),
        reason,
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * 매도 주문 실행
   * @param {String} market - 마켓 코드 (예: KRW-BTC)
   * @param {Number} price - 주문 가격
   * @param {Number} volume - 주문 수량
   * @param {String} reason - 주문 사유
   * @returns {Object} - 주문 결과
   */
  async sell(market, price, volume, reason = '') {
    logger.info(`매도 주문 시도: ${market}, 가격: ${price}, 수량: ${volume}, 사유: ${reason}`);
    
    try {
      if (this.config.enableRealTrading) {
        // 실제 거래 실행
        const order = await upbitClient.createOrder(market, 'ask', volume, price, 'limit');
        this.activeOrders.set(order.uuid, {
          ...order,
          strategy: reason
        });
        
        logger.info(`매도 주문 성공: ${order.uuid}`);
        this.orderHistory.push({
          type: 'sell',
          market,
          price,
          volume,
          amount: price * volume,
          timestamp: new Date().toISOString(),
          reason,
          orderId: order.uuid,
          status: 'submitted'
        });
        
        return order;
      } else {
        // 테스트 모드 (실제 거래 X)
        const mockOrder = {
          uuid: `mock-${Date.now()}`,
          market,
          side: 'ask',
          price: price.toString(),
          volume: volume.toString(),
          created_at: new Date().toISOString(),
          status: 'wait',
        };
        
        logger.info(`[테스트 모드] 매도 주문 시뮬레이션: ${mockOrder.uuid}`);
        this.orderHistory.push({
          type: 'sell',
          market,
          price,
          volume,
          amount: price * volume,
          timestamp: new Date().toISOString(),
          reason,
          orderId: mockOrder.uuid,
          status: 'simulated'
        });
        
        return mockOrder;
      }
    } catch (error) {
      logger.error(`매도 주문 실패: ${error.message}`);
      this.orderHistory.push({
        type: 'sell',
        market,
        price,
        volume,
        amount: price * volume,
        timestamp: new Date().toISOString(),
        reason,
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * 주문 취소
   * @param {String} uuid - 주문 UUID
   * @returns {Object} - 취소 결과
   */
  async cancelOrder(uuid) {
    logger.info(`주문 취소 시도: ${uuid}`);
    
    try {
      if (this.config.enableRealTrading) {
        const result = await upbitClient.cancelOrder(uuid);
        logger.info(`주문 취소 성공: ${uuid}`);
        
        // 주문 이력 업데이트
        this.orderHistory = this.orderHistory.map(order => {
          if (order.orderId === uuid) {
            return { ...order, status: 'cancelled' };
          }
          return order;
        });
        
        // 활성 주문에서 제거
        this.activeOrders.delete(uuid);
        
        return result;
      } else {
        // 테스트 모드
        logger.info(`[테스트 모드] 주문 취소 시뮬레이션: ${uuid}`);
        
        // 주문 이력 업데이트
        this.orderHistory = this.orderHistory.map(order => {
          if (order.orderId === uuid) {
            return { ...order, status: 'cancelled' };
          }
          return order;
        });
        
        return { uuid, status: 'cancelled' };
      }
    } catch (error) {
      logger.error(`주문 취소 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 주문 상태 확인
   * @param {String} uuid - 주문 UUID
   * @returns {Object} - 주문 상태
   */
  async getOrderStatus(uuid) {
    try {
      if (this.config.enableRealTrading) {
        const order = await upbitClient.getOrder(uuid);
        return order;
      } else {
        // 테스트 모드
        const mockOrder = this.orderHistory.find(order => order.orderId === uuid);
        if (!mockOrder) {
          throw new Error(`주문을 찾을 수 없음: ${uuid}`);
        }
        
        return {
          uuid,
          status: mockOrder.status,
          ...mockOrder
        };
      }
    } catch (error) {
      logger.error(`주문 상태 확인 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 모든 활성 주문 확인
   */
  async updateActiveOrders() {
    if (!this.config.enableRealTrading || this.activeOrders.size === 0) {
      return;
    }
    
    try {
      for (const [uuid, orderInfo] of this.activeOrders.entries()) {
        const order = await upbitClient.getOrder(uuid);
        
        if (order.state === 'done' || order.state === 'cancel') {
          logger.info(`주문 완료: ${uuid}, 상태: ${order.state}`);
          
          // 주문 이력 업데이트
          this.orderHistory = this.orderHistory.map(o => {
            if (o.orderId === uuid) {
              return { ...o, status: order.state === 'done' ? 'filled' : 'cancelled' };
            }
            return o;
          });
          
          // 활성 주문에서 제거
          this.activeOrders.delete(uuid);
        }
      }
    } catch (error) {
      logger.error(`활성 주문 업데이트 실패: ${error.message}`);
    }
  }

  /**
   * 주문 이력 가져오기
   */
  getOrderHistory() {
    return this.orderHistory;
  }

  /**
   * 활성 주문 목록 가져오기
   */
  getActiveOrders() {
    return Array.from(this.activeOrders.values());
  }
}

module.exports = OrderExecutor;