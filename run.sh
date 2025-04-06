#!/bin/bash

# 설치 및 실행 스크립트
echo "🚀 Upbit MCP 서버 및 트레이딩 봇 설치 및 실행 스크립트"

# 현재 디렉토리 확인
CURRENT_DIR=$(pwd)
echo "📂 현재 디렉토리: $CURRENT_DIR"

# 필요한 디렉토리 생성
echo "📁 필요한 디렉토리 생성 중..."
mkdir -p logs data/raw data/processed data/backtest_results

# 필요한 패키지 설치
echo "📦 의존성 패키지 설치 중..."
npm install

# .env 파일 확인
if [ ! -f .env ]; then
    echo "⚠️ .env 파일이 없습니다. 샘플 파일을 생성합니다."
    echo "ACCESS_KEY=your_access_key_here
SECRET_KEY=your_secret_key_here
SERVER_PORT=3000
LOG_LEVEL=info" > .env
    echo "✅ .env 파일이 생성되었습니다. API 키를 업데이트하세요."
else
    echo "✅ .env 파일이 이미 존재합니다."
fi

# API 키 확인
if grep -q "your_access_key_here" .env; then
    echo "⚠️ Upbit API 키가 기본값입니다. .env 파일을 편집하여 API 키를 설정하세요."
    echo "API 키를 설정한 후 이 스크립트를 다시 실행하세요."
    exit 1
fi

# 서버 실행
echo "🔄 서버를 시작합니다..."
echo "📊 대시보드는 http://localhost:3000 에서 접속할 수 있습니다."
npm start