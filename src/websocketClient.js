const WebSocket = require('websocket').w3cwebsocket;
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

class WebSocketClient {
  constructor() {
    this.websocket = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribers = {};
  }

  // WebSocket 연결
  connect(markets = ['KRW-BTC'], types = ['ticker']) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected');
      return;
    }

    this.websocket = new WebSocket(config.upbit.websocketUrl);

    this.websocket.onopen = () => {
      console.log('WebSocket connected successfully');
      this.reconnectAttempts = 0;
      
      // 실시간 시세 구독
      const message = [
        { ticket: uuidv4() },
        ...types.map(type => ({
          type,
          codes: Array.isArray(markets) ? markets : [markets]
        }))
      ];
      
      this.websocket.send(JSON.stringify(message));
      
      // 연결 유지를 위한 ping 메시지 전송 (30초마다)
      this.pingInterval = setInterval(() => {
        if (this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send('ping');
        }
      }, 30000);
    };

    this.websocket.onmessage = (event) => {
      try {
        if (event.data === 'pong') {
          return; // ping에 대한 pong 응답 무시
        }
        
        const data = JSON.parse(event.data);
        const { type, code } = data;
        
        // 구독자들에게 데이터 전달
        if (this.subscribers[type]) {
          this.subscribers[type].forEach(callback => {
            callback(data);
          });
        }
        
        if (this.subscribers[code]) {
          this.subscribers[code].forEach(callback => {
            callback(data);
          });
        }
        
        if (this.subscribers['all']) {
          this.subscribers['all'].forEach(callback => {
            callback(data);
          });
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.cleanupConnection();
      this.attemptReconnect();
    };

    this.websocket.onclose = () => {
      console.log('WebSocket connection closed');
      this.cleanupConnection();
      this.attemptReconnect();
    };
  }

  // 연결 정리
  cleanupConnection() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // 재연결 시도
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // 지수 백오프
      console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
      
      setTimeout(() => {
        console.log(`Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    } else {
      console.error('Maximum reconnection attempts reached. Please check your connection and try again later.');
    }
  }

  // 연결 닫기
  disconnect() {
    this.cleanupConnection();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // 구독하기
  subscribe(channel, callback) {
    if (!this.subscribers[channel]) {
      this.subscribers[channel] = [];
    }
    this.subscribers[channel].push(callback);
    return () => this.unsubscribe(channel, callback);
  }

  // 구독 취소
  unsubscribe(channel, callback) {
    if (this.subscribers[channel]) {
      this.subscribers[channel] = this.subscribers[channel].filter(cb => cb !== callback);
    }
  }
}

module.exports = new WebSocketClient();