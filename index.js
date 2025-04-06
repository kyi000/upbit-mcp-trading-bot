require('dotenv').config();
const server = require('./src/server');
const upbitClient = require('./src/upbitClient');
const websocketClient = require('./src/websocketClient');

// 애플리케이션 시작 시 웹소켓 연결
const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP']; // 기본 마켓 목록
websocketClient.connect(markets, ['ticker', 'orderbook']);

// 웹소켓으로 받은 데이터를 콘솔에 출력 (테스트용)
websocketClient.subscribe('all', (data) => {
  if (data.type === 'ticker') {
    const { code, trade_price, signed_change_rate } = data;
    console.log(`[${code}] 현재가: ${trade_price}, 등락률: ${(signed_change_rate * 100).toFixed(2)}%`);
  }
});

// 애플리케이션 종료 시 정리 작업
process.on('SIGINT', () => {
  console.log('Shutting down the application');
  websocketClient.disconnect();
  process.exit(0);
});