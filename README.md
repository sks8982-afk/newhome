# 내집 알리미 (newhome)

LH 청약플러스(`apply.lh.or.kr`) 행복주택 공고를 매일 자동 수집하고, 우선 지역(수원·화성·오산)을 강조해 텔레그램 알림과 캘린더로 보여주는 Next.js 앱.

## 기능

- ✅ LH 청약플러스 행복주택/경기도 공고 자동 수집 (Vercel Cron)
- ✅ 매일 오전 10시 KST 자동 실행
- ✅ AWS RDS Postgres (`newhome` 스키마) 영속화
- ✅ 신규 공고 텔레그램 푸시 알림
- ✅ 우선 지역(수원·화성·오산) 카드/캘린더 강조
- ✅ 월별 캘린더 뷰
- ✅ 필터 설정(주택 유형 / 지역 / 우선 도시)
- ⏳ (예정) 청약홈 등 추가 출처 모니터링

## 아키텍처

```
[Vercel Cron]  매일 01:00 UTC = 10:00 KST
     │ GET /api/cron/scrape (Authorization: Bearer $CRON_SECRET)
     ▼
[Vercel Serverless Function]
     ├─ scrapeLH() → fetch apply.lh.or.kr
     ├─ Prisma upsert → AWS RDS Postgres (newhome 스키마)
     └─ 새 공고 있으면 → Telegram Bot API
```

## 로컬 개발

```bash
# 1. 의존성 설치
npm install

# 2. .env.example 복사 후 값 채우기
cp .env.example .env

# 3. DB 스키마 푸시 (newhome 스키마/테이블 생성)
npm run db:push

# 4. dev 서버
npm run dev
# http://localhost:3000
```

수동 수집:
```bash
npm run scrape
```

Prisma Studio (DB 시각화):
```bash
npm run db:studio
```

## 환경변수

| 변수 | 설명 | 필수 |
|---|---|---|
| `DATABASE_URL` | Postgres 연결 URL (`?schema=newhome&sslmode=require` 포함) | ✅ |
| `CRON_SECRET` | Vercel Cron 인증 (production만) | ✅ (배포) |
| `TELEGRAM_BOT_TOKEN` | @BotFather에서 발급 | 알림용 |
| `TELEGRAM_CHAT_ID` | @userinfobot에서 확인한 본인 chat_id | 알림용 |

## 텔레그램 봇 셋업 (1분)

1. 텔레그램에서 `@BotFather` 검색 → `/newbot` → 봇 이름/유저네임 입력
2. 받은 **HTTP API 토큰**을 `TELEGRAM_BOT_TOKEN`에 입력
3. 만든 봇과 한 번 대화 시작 (`/start`)
4. `@userinfobot` 검색 → 시작 → **Id** 값을 `TELEGRAM_CHAT_ID`에 입력

테스트:
```bash
curl -X POST http://localhost:3000/api/scrape
# 새 공고가 있으면 텔레그램으로 알림이 옴
```

## Vercel 배포

1. GitHub repo를 Vercel에 import
2. **Environment Variables**에 위 4개 변수 입력
   - `CRON_SECRET`: 임의의 긴 랜덤 문자열 (예: `openssl rand -hex 32`)
3. Deploy
4. 자동으로 `vercel.json`의 `crons` 등록됨 → 매일 10:00 KST 자동 실행

## AWS RDS 보안그룹 주의

Vercel 서버리스에서 RDS 접속하려면:
- RDS Public Access **활성화**
- 보안그룹 인바운드 5432: `0.0.0.0/0` 허용 (또는 Vercel IP)
- `sslmode=require`는 이미 `DATABASE_URL`에 포함됨

## 디렉토리

```
src/
  app/
    page.tsx                # 대시보드
    calendar/page.tsx       # /calendar
    settings/page.tsx       # /settings
    api/
      announcements/        # GET 매칭 공고
      scrape/               # POST 수동 수집
      cron/scrape/          # GET 자동 수집 (Vercel Cron)
      seen/                 # POST 신규 표시 해제
      filter/               # GET/PUT 필터
  components/
    Dashboard.tsx
    Calendar.tsx
    AnnouncementCard.tsx
    NotificationBanner.tsx
  lib/
    db/
      client.ts             # Prisma 싱글톤
      store.ts              # CRUD 헬퍼
    notify/
      telegram.ts           # 텔레그램 봇 알림
    scraper/
      lh.ts                 # LH 청약플러스 스크래퍼
      index.ts              # refresh + notify 흐름
      run.ts                # CLI: npm run scrape
    filter.ts               # 매칭/우선지역 로직
  types/
    announcement.ts
prisma/
  schema.prisma             # newhome 스키마 정의
vercel.json                 # cron 0 1 * * * (10:00 KST)
```

## 향후 계획

- [ ] 청약홈(applyhome.co.kr) 스크래퍼 추가
- [ ] 마감일(applyEnd) 파싱 + 캘린더 D-Day 표기
- [ ] 모집 단지 상세(평수/공급호수) 크롤링
- [ ] 알림 채널 다양화 (이메일, 카카오 "나에게 보내기")
