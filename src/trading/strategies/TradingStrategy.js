/**
 * 트레이딩 전략 인터페이스
 * 모든 트레이딩 전략은 이 클래스를 상속받아 구현해야 합니다.
 */
class TradingStrategy {
  constructor(name, description, params = {}) {
    this.name = name;
    this.description = description;
    this.params = params;
    this.isActive = false;
    this.logger = require('../../utils/logger')(`Strategy-${name}`);
  }

  /**
   * 전략 초기화 함수
   * @param {Object} context - 전략 실행 컨텍스트 (API 클라이언트, 설정 등)
   */
  async initialize(context) {
    this.context = context;
    this.logger.info(`${this.name} 전략 초기화 완료`);
  }

  /**
   * 새로운 데이터가 들어올 때마다 호출되는 함수
   * @param {Object} data - 시장 데이터 (캔들, 틱, 호가창 등)
   * @returns {Object|null} - 매매 신호 (buy, sell, hold)
   */
  async onData(data) {
    // 기본 구현은 아무것도 하지 않음 (자식 클래스에서 재정의)
    throw new Error('onData method must be implemented by subclass');
  }

  /**
   * 매매 신호 발생 시 호출되는 함수
   * @param {String} signal - 매매 신호 (buy, sell, hold)
   * @param {Object} data - 신호가 발생한 데이터
   */
  async onSignal(signal, data) {
    this.logger.info(`${this.name} 전략 신호 발생: ${signal}`);
    // 기본 구현은 아무것도 하지 않음 (자식 클래스에서 재정의)
  }

  /**
   * 주문 체결 시 호출되는 함수
   * @param {Object} order - 체결된 주문 정보
   */
  async onOrderFilled(order) {
    this.logger.info(`주문 체결: ${JSON.stringify(order)}`);
  }

  /**
   * 전략 파라미터 설정
   * @param {Object} params - 전략 파라미터
   */
  setParams(params) {
    this.params = { ...this.params, ...params };
    this.logger.info(`전략 파라미터 업데이트: ${JSON.stringify(this.params)}`);
  }

  /**
   * 전략 활성화/비활성화
   * @param {Boolean} active - 활성화 여부
   */
  setActive(active) {
    this.isActive = active;
    this.logger.info(`전략 ${active ? '활성화' : '비활성화'} 됨`);
  }
}

module.exports = TradingStrategy;