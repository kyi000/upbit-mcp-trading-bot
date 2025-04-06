const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const querystring = require('querystring');
const WebSocket = require('websocket').w3cwebsocket;
const config = require('../config/config');

class UpbitClient {
  constructor() {
    this.accessKey = config.upbit.accessKey;
    this.secretKey = config.upbit.secretKey;
    this.baseUrl = config.upbit.baseUrl;
    this.websocketUrl = config.upbit.websocketUrl;
    this.websocket = null;
    this.websocketCallbacks = {};
  }

  // API 요청 서명 생성
  generateAuthToken(query = null) {
    const payload = {
      access_key: this.accessKey,
      nonce: uuidv4(),
    };

    if (query) {
      const queryString = querystring.encode(query);
      const hash = crypto.createHash('sha512');
      const queryHash = hash.update(queryString, 'utf-8').digest('hex');
      payload.query_hash = queryHash;
      payload.query_hash_alg = 'SHA512';
    }

    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `Bearer ${token}`;
  }

  // REST API 요청 함수
  async request(method, endpoint, params = {}) {
    try {
      const options = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.generateAuthToken(method === 'GET' ? params : null),
        }
      };

      if (method === 'GET' && Object.keys(params).length > 0) {
        options.url += `?${querystring.encode(params)}`;
      } else if (method !== 'GET' && Object.keys(params).length > 0) {
        options.data = params;
      }

      const response = await axios(options);
      return response.data;
    } catch (error) {
      console.error(`API Request Error: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // 계좌 정보 조회
  async getAccounts() {
    return this.request('GET', '/v1/accounts');
  }

  // 시장 코인 목록 조회
  async getMarkets() {
    return this.request('GET', '/v1/market/all');
  }

  // 현재 시세 조회
  async getTicker(markets) {
    return this.request('GET', '/v1/ticker', { markets });
  }

  // 호가 정보 조회
  async getOrderbook(markets) {
    return this.request('GET', '/v1/orderbook', { markets });
  }

  // 캔들 데이터 조회
  async getCandles(market, unit, count) {
    return this.request('GET', `/v1/candles/minutes/${unit}`, { market, count });
  }

  // 주문하기
  async createOrder(market, side, volume, price, orderType) {
    const params = {
      market,
      side, // bid(매수), ask(매도)
      ord_type: orderType, // limit(지정가), price(시장가 매수), market(시장가 매도)
    };

    if (volume) params.volume = volume;
    if (price) params.price = price;

    return this.request('POST', '/v1/orders', params);
  }

  // 주문 취소
  async cancelOrder(uuid) {
    return this.request('DELETE', '/v1/order', { uuid });
  }

  // 주문 조회
  async getOrder(uuid) {
    return this.request('GET', '/v1/order', { uuid });
  }

  // 웹소켓 연결 설정
  connectWebSocket(markets, callbacks) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.websocketCallbacks = callbacks || {};
    this.websocket = new WebSocket(this.websocketUrl);

    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      const request = [
        { ticket: uuidv4() },
        { type: 'ticker', codes: Array.isArray(markets) ? markets : [markets] }
      ];
      this.websocket.send(JSON.stringify(request));
      
      if (this.websocketCallbacks.onOpen) {
        this.websocketCallbacks.onOpen();
      }
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.websocketCallbacks.onMessage) {
          this.websocketCallbacks.onMessage(data);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (this.websocketCallbacks.onError) {
        this.websocketCallbacks.onError(error);
      }
    };

    this.websocket.onclose = () => {
      console.log('WebSocket disconnected');
      if (this.websocketCallbacks.onClose) {
        this.websocketCallbacks.onClose();
      }
    };
  }

  // 웹소켓 연결 종료
  disconnectWebSocket() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

module.exports = new UpbitClient();