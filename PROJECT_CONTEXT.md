# 🚀 IAI V3 - 프로젝트 컨텍스트

> **AI 어시스턴트용**: 이 파일을 먼저 읽고 작업을 시작하세요.
> **최종 업데이트**: 2025-12-05

---

## 📌 프로젝트 개요

**이름**: IAI V3 (I AM IMPACT V3)
**목적**: AI 기반 패션 상세페이지 생성기
**배포 URL**: https://iai-v3.vercel.app
**GitHub**: https://github.com/coreofalchemy-ui/iai_v3

---

## 🏗️ 기술 스택

- **프레임워크**: React + TypeScript + Vite
- **스타일링**: CSS (Vanilla)
- **인증**: Supabase (이메일/비밀번호)
- **AI**: Google Gemini API (`gemini-3-pro-image-preview`)
- **배포**: Vercel (자동 배포 연동)
- **서버리스**: Vercel Serverless Functions

---

## 🔐 보안 아키텍처 (중요!)

### API 키 보호

**Gemini API 키는 절대 프론트엔드에 노출되지 않음!**

```
[브라우저] → /api/gemini (서버리스) → [Gemini API]
                    ↑
            GEMINI_API_KEY (서버 전용)
```

### 파일 구조

```
/api/gemini.ts              ← 서버리스 함수 (API 키 사용)
/src/lib/geminiClient.ts    ← 프론트엔드 클라이언트 (서버리스 호출)
/src/lib/supabase.ts        ← Supabase 클라이언트
```

### 모든 AI 서비스 파일 (보안 버전으로 리팩토링 완료)

| 파일 | 설명 |
|------|------|
| `geminiService.ts` | 얼굴 생성, 룩북 생성 |
| `poseService.ts` | 포즈 변경 (40가지) |
| `productEnhancement.ts` | 신발 미화 |
| `quickTransferService.ts` | 퀵 트랜스퍼 |
| `shoeStudioService.ts` | 스튜디오 합성 |
| `faceSynthesisService.ts` | 얼굴 합성 (SKULL LOCK) |
| `analyzeModel.ts` | 모델 분석 |
| `productAnalysisService.ts` | 제품 분석 |
| `originalGenerationService.ts` | 원본 생성 |
| `backgroundRemovalService.ts` | 배경 제거 |
| `contentGeneratorService.ts` | 콘텐츠 생성 |
| `geminiAICopywriter.ts` | AI 카피라이팅 |

**위 모든 파일은 `callGeminiSecure()`를 사용하여 서버리스 함수를 통해 API 호출함.**

---

## 🔑 환경 변수

### Vercel 환경변수 (프로젝트 Settings)

| Key | 설명 | 노출 |
|-----|------|------|
| `GEMINI_API_KEY` | Gemini API 키 | 서버 전용 ❌ |
| `VITE_SUPABASE_URL` | Supabase URL | 클라이언트 ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key (Legacy) | 클라이언트 ✅ |

### 로컬 개발용 `.env` 파일

```env
VITE_SUPABASE_URL=https://dkkwxzkexmealgzabbpr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs... (Legacy 키)
GEMINI_API_KEY=AIzaSy... (vercel dev 사용 시)
```

---

## 🏠 로컬 개발 방법

### 옵션 1: `vercel dev` (추천)

```bash
npm i -g vercel
vercel dev
```
→ 서버리스 함수 포함, AI 기능 완전 작동

### 옵션 2: `npm run dev`

```bash
npm run dev
```
→ UI만 작동, AI 기능 ❌ (서버리스 없음)

---

## 🔐 인증 시스템

### Supabase 설정

- **URL**: `https://dkkwxzkexmealgzabbpr.supabase.co`
- **로그인 방식**: 이메일/비밀번호
- **테스트 계정**: `core.of.alchemy@gmail.com`
- **⚠️ 주의**: Supabase API 키는 **Legacy 형식** 사용 (`eyJhbGci...`)

### 관련 파일

```
/src/lib/supabase.ts        ← Supabase 클라이언트
/src/contexts/AuthContext.tsx  ← 인증 컨텍스트
/src/components/LoginPage.tsx  ← 로그인 페이지
```

---

## 📁 주요 폴더 구조

```
COAAI_V2/
├── api/
│   └── gemini.ts           ← 서버리스 함수
├── src/
│   ├── apps/
│   │   └── detail-generator/
│   │       ├── components/ ← UI 컴포넌트
│   │       ├── services/   ← AI 서비스 (보안 버전)
│   │       └── DetailGeneratorApp.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── lib/
│   │   ├── geminiClient.ts ← 보안 API 클라이언트
│   │   └── supabase.ts
│   ├── pages/
│   │   └── landing/        ← 랜딩 페이지
│   └── App.tsx
├── vercel.json
├── package.json
└── .env (gitignore됨)
```

---

## 🚧 알려진 이슈 / TODO

1. **청크 사이즈 경고**: 빌드 시 500KB 초과 경고 (코드 스플리팅 권장)
2. **로컬 개발**: `vercel dev` 필요 (일반 `npm run dev`는 AI 기능 ❌)

---

## 📞 연락처

- **Supabase 프로젝트**: dkkwxzkexmealgzabbpr
- **Vercel 프로젝트**: iai-v3
- **GitHub 조직**: coreofalchemy-ui

---

## 🔄 최근 변경 이력

### 2025-12-05: 보안 API 리팩토링

1. 모든 Gemini API 호출을 서버리스 함수로 이동
2. 12개 서비스 파일 리팩토링 완료
3. `@vercel/node` 패키지 추가
4. Supabase 이메일/비밀번호 인증 추가
5. Vercel 배포 완료

---

> **다음 작업 시**: 이 파일을 먼저 읽고, 필요한 파일 수정 후 `git push`하면 자동 배포됩니다.
