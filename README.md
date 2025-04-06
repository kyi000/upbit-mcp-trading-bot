# Upbit MCP 서버 & 트레이딩 봇

업비트 API를 활용한 다중 통신 프로토콜(MCP) 서버와 자동 거래 봇 시스템입니다. 이 시스템을 통해 업비트 암호화폐 거래소의 데이터를 수집하고, 다양한 트레이딩 전략을 구현하여 자동 거래를 수행할 수 있습니다.

## 주요 기능

- **업비트 API 연동**: 계좌 정보, 시세, 호가, 캔들 데이터 등 조회
- **실시간 데이터 수집**: WebSocket을 통한 실시간 시세 정보 수신
- **사용자 정의 전략**: 다양한 트레이딩 전략 구현 및 확장 가능
- **백테스팅**: 과거 데이터를 통한 전략 성능 평가
- **API 서버**: RESTful API를 통한 데이터 및 기능 접근
- **웹 대시보드**: 직관적인 UI를 통한 시스템 모니터링 및 제어

## 시스템 요구사항

- Node.js 14.x 이상
- npm 6.x 이상
- 업비트 계정 및 API 키

## 설치 방법

### 1. 코드 다운로드

```bash
git clone https://github.com/kyi000/upbit-mcp-trading-bot.git
cd upbit-mcp-trading-bot
```

### 2. 의존성 패키지 설치

```bash
npm install
```

### 3. 환경 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```
ACCESS_KEY=your_upbit_access_key_here
SECRET_KEY=your_upbit_secret_key_here
SERVER_PORT=3000
LOG_LEVEL=info
```

### 4. 실행

```bash
npm start
```

또는 제공된 실행 스크립트를 사용할 수 있습니다:

```bash
chmod +x run.sh
./run.sh
```

## 시스템 구조

### 1. 핵심 모듈

- **upbitClient.js**: 업비트 API 통신 클라이언트
- **websocketClient.js**: 실시간 데이터 수신을 위한 WebSocket 클라이언트
- **server.js**: Express 기반 API 서버

### 2. 트레이딩 모듈

- **TradingManager.js**: 트레이딩 시스템 메인 관리자
- **strategies/**: 각종 트레이딩 전략 모듈
- **MarketDataManager.js**: 시장 데이터 관리 모듈
- **execution/OrderExecutor.js**: 주문 실행 모듈
- **backtest/Backtester.js**: 백테스트 모듈

### 3. 대시보드 및 UI

- **/public/**: 웹 대시보드 파일
  - **index.html**: 메인 HTML 파일
  - **js/app.js**: 대시보드 로직
  - **css/style.css**: 스타일시트

## API 엔드포인트

### 업비트 관련 API

- `GET /api/accounts`: 계좌 정보 조회
- `GET /api/markets`: 마켓 목록 조회
- `GET /api/ticker?markets=...`: 현재가 조회
- `GET /api/orderbook?markets=...`: 호가창 조회
- `GET /api/candles?market=...&unit=...&count=...`: 캔들 데이터 조회
- `POST /api/orders`: 주문 생성
- `DELETE /api/orders/:uuid`: 주문 취소
- `GET /api/orders/:uuid`: 주문 조회

### 트레이딩 관련 API

- `GET /api/trading/strategies`: 전략 목록 조회
- `GET /api/trading/strategies/active`: 활성 전략 조회
- `POST /api/trading/strategies/:name/activate`: 전략 활성화
- `POST /api/trading/strategies/:name/deactivate`: 전략 비활성화
- `POST /api/trading/backtest`: 백테스트 실행
- `GET /api/trading/orders/history`: 주문 이력 조회
- `GET /api/trading/orders/active`: 활성 주문 조회
- `GET /api/trading/config`: 트레이딩 설정 조회
- `PUT /api/trading/config`: 트레이딩 설정 업데이트
- `POST /api/trading/data/start`: 데이터 수집 시작
- `POST /api/trading/data/stop`: 데이터 수집 중단

## 트레이딩 전략 개발 가이드

새로운 트레이딩 전략을 개발하려면 다음 단계를 따르세요:

1. `src/trading/strategies/` 디렉토리에 새 전략 파일 생성
2. `TradingStrategy` 클래스를 상속받아 구현
3. 필수 메서드 구현:
   - `initialize`: 전략 초기화
   - `onData`: 새로운 데이터 처리
   - `onSignal`: 매매 신호 처리

예시:

```javascript
const TradingStrategy = require('./TradingStrategy');

class MyNewStrategy extends TradingStrategy {
  constructor() {
    super(
      'MyNewStrategy', 
      '나만의 새로운 전략', 
      {
        param1: 10,
        param2: 20
      }
    );
  }

  async initialize(context) {
    await super.initialize(context);
    this.orderExecutor = context.orderExecutor;
    this.dataManager = context.dataManager;
    this.markets = context.markets;
    
    // 추가 초기화 작업
  }

  async onData(data) {
    // 데이터 처리 및 매매 신호 생성
    return 'buy'; // 또는 'sell', null
  }

  async onSignal(signal, data) {
    await super.onSignal(signal, data);
    
    // 매매 신호에 따른 주문 실행
    if (signal === 'buy') {
      // 매수 로직
    } else if (signal === 'sell') {
      // 매도 로직
    }
  }
}

module.exports = MyNewStrategy;
```

## 웹 대시보드 사용법

1. 웹 브라우저에서 `http://localhost:3000` 접속
2. 대시보드 화면에서 계정 정보, 활성 전략, 최근 거래 내역 확인
3. 전략 관리 탭에서 전략 활성화/비활성화
4. 백테스트 탭에서 전략 성능 평가
5. 설정 탭에서 시스템 설정

## 트러블슈팅

### API 키 관련 오류

- 업비트 API 키가 올바르게 설정되었는지 확인
- API 키에 필요한 권한이 부여되었는지 확인

### 연결 오류

- 인터넷 연결 상태 확인
- 방화벽 설정 확인

### 전략 오류

- 로그 파일 확인 (`logs/` 디렉토리)
- 전략 코드 검토

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 면책 조항

이 소프트웨어는 투자 조언을 제공하지 않으며, 실제 자금으로 거래할 경우 발생하는 손실에 대해 책임을 지지 않습니다. 항상 자신의 투자 결정에 대해 전적인 책임을 지시기 바랍니다.