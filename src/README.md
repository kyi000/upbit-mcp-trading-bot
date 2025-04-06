# 소스 코드 디렉토리

이 디렉토리에는 Upbit MCP 서버와 트레이딩 봇의 핵심 소스 코드가 포함되어 있습니다.

## 디렉토리 구조

- **src/**
  - **upbitClient.js**: 업비트 API 통신 클라이언트
  - **websocketClient.js**: WebSocket 통신 클라이언트
  - **server.js**: Express 서버 및 API 엔드포인트
  - **tradingRouter.js**: 트레이딩 관련 API 라우터
  - **utils/**: 유틸리티 함수
    - **logger.js**: 로깅 유틸리티
  - **trading/**: 트레이딩 관련 모듈
    - **TradingManager.js**: 트레이딩 시스템 메인 관리자
    - **MarketDataManager.js**: 시장 데이터 관리
    - **strategies/**: 트레이딩 전략 구현
      - **TradingStrategy.js**: 전략 기본 클래스
      - **MovingAverageCrossStrategy.js**: 이동평균선 교차 전략
      - **RSIStrategy.js**: RSI 오버솔드/오버바웃 전략
    - **execution/**: 주문 실행 모듈
      - **OrderExecutor.js**: 주문 실행기
    - **backtest/**: 백테스트 관련 모듈
      - **Backtester.js**: 백테스트 실행기
  - **public/**: 웹 대시보드 파일
    - **index.html**: 메인 HTML 페이지
    - **css/style.css**: 스타일시트
    - **js/app.js**: 클라이언트 자바스크립트

## 시작하기

1. `.env` 파일을 프로젝트 루트에 생성하고 업비트 API 키 설정
2. 필요한 디렉토리가 없다면 생성
3. `npm install`로 의존성 설치
4. `npm start`로 서버 실행