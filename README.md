# Market Intelligence Agent
## 자율형 시장동향 및 경쟁사 분석 AI 에이전트

제품/서비스 설명을 입력하면 AI 에이전트가 자동으로 경쟁사를 탐색하고 마켓 인텔리전스 보고서를 생성하는 웹 애플리케이션입니다.

---

## 왜 이 시스템이 필요한가

> "신규 사업 아이템이 생기면 시장조사부터 시작해야 하는데, 보통 2~3일이 걸린다."

| 기존 방식 | 이 시스템 |
|-----------|-----------|
| 담당자가 직접 구글 검색 → 수십 개 탭 열기 | 단일 입력 → 자동 검색 + 전문 분석 |
| 경쟁사 파악에 2~4시간 | Phase 1 스캔: 5개 이상 경쟁사 45초 내 도출 |
| 가격 비교는 영업팀에 문의하거나 포기 | 가격 인텔리전스 자동 수집 및 시장 평균 대비 분석 |
| 보고서 작성까지 별도 1~2일 | 5종 PDF 보고서 즉시 내보내기 |
| 국내 경쟁사 파악이 글로벌에 비해 부족 | 국내 SKT/KT/삼성SDS/LG CNS 등 필수 탐색 내장 |

```
시장조사 소요 시간:  2~3일 → 90초
경쟁사 파악 범위:   담당자 기억 의존 → AI가 국내외 5개 이상 자동 발굴
보고서 작성:        반나절 이상 → 버튼 1번으로 5종 PDF 즉시 출력
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| LLM | OpenAI GPT-4o-mini (`langchain-openai` 1.1.12) |
| 에이전트 프레임워크 | LangGraph 1.1.3 (StateGraph) |
| LLM 오케스트레이션 | LangChain 1.2.13 + `with_structured_output` |
| 웹 검색 | DuckDuckGo Search (`asyncio.to_thread` 비동기 래퍼) |
| 딥 스크래핑 | Jina Reader API (`httpx` 비동기, 본문 최대 4,000자) |
| API 서버 | FastAPI 0.135.2, uvicorn 0.42.0 |
| 실시간 스트리밍 | SSE (`sse-starlette` 3.3.3) |
| 문서 파싱 | PyMuPDF (PDF), python-docx (DOCX) |
| 프론트엔드 | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS v3 |
| PDF 생성 | html2canvas 1.4.1 + jsPDF 4.2.1 (클라이언트 사이드) |
| 아이콘 | lucide-react |

---

## 프로젝트 구조

```
KT_Agent260327/
├── backend/
│   ├── main.py                     FastAPI 앱 — API 엔드포인트 5종
│   ├── schemas.py                  Pydantic 구조화 출력 스키마 (16개 필드 ReporterOutput 등)
│   ├── graph/
│   │   ├── state.py                메인 파이프라인 AgentState (TypedDict)
│   │   ├── nodes.py                7개 에이전트 노드 (async + StreamWriter)
│   │   ├── edges.py                route_on_error() 조건부 라우팅
│   │   ├── builder.py              메인 StateGraph 조립 및 컴파일
│   │   ├── deep_dive_state.py      심층 분석 파이프라인 상태
│   │   ├── deep_dive_nodes.py      심층 분석 노드 함수
│   │   └── deep_dive_builder.py    심층 분석 StateGraph
│   └── tools/
│       └── search.py               DuckDuckGo 비동기 검색 래퍼
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                메인 페이지 (AppState 상태 기계 + SSE 소비)
│   │   └── deep-dive/
│   │       └── page.tsx            심층 분석 독립 탭 (localStorage 파라미터 수신)
│   ├── components/
│   │   ├── InputForm.tsx           텍스트 입력 + PDF/DOCX 파일 업로드
│   │   ├── AgentProgress.tsx       7단계 수직 스테퍼 (pending/active/complete/error)
│   │   ├── ReportView.tsx          최종 보고서 대시보드
│   │   ├── PdfExportButtons.tsx    5종 PDF 내보내기 (html2canvas + jsPDF)
│   │   └── SkeletonLoader.tsx      로딩 스켈레톤 UI
│   ├── lib/
│   │   └── streamParser.ts         SSE 청크 분할 버퍼 파서
│   └── types/
│       └── analysis.ts             TypeScript 인터페이스 (AnalysisResult 외 20개 타입)
│
├── run_backend.sh
├── run_frontend.sh
├── requirements.txt
└── .env
```

---

## 실행 방법

### 1. 환경 변수 설정

```bash
# .env
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o-mini
```

```bash
# frontend/.env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 2. 백엔드 실행

```bash
bash run_backend.sh
# → http://localhost:8000
# API 문서: http://localhost:8000/docs
```

### 3. 프론트엔드 실행

```bash
bash run_frontend.sh
# → http://localhost:3000  (최초 실행 시 npm install 자동 수행)
```

---

## API 엔드포인트

| 메서드 | 경로 | 스트리밍 | 설명 |
|--------|------|----------|------|
| `POST` | `/analyze` | SSE | 7단계 메인 분석 파이프라인 |
| `POST` | `/upload` | — | PDF/DOCX 파일 → 텍스트 추출 |
| `POST` | `/deep-dive` | SSE | 기업 단일/비교 심층 분석 |
| `POST` | `/one-page-report` | — | 목적별 원페이지 보고서 (JSON) |
| `GET`  | `/health` | — | 서버 헬스 체크 |

---

## 에이전트 파이프라인 (7단계)

```
사용자 입력 (텍스트 또는 파일)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Market Scan Node                                   │
│  - GPT-4o-mini + Structured Output                         │
│  - BM 유형 분류: SaaS/IaaS vs Hardware OEM vs SI           │
│  - 동일 카테고리 경쟁사 5개 이상 발굴, relevance_score 산정  │
│  - is_valid_input = False → terminal 이벤트 후 조기 종료    │
└──────────────────────── route_on_error() ───────────────────┘
         │  is_valid_input = True
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Competitor Selection Node                          │
│  - Phase 2 심층 프로파일 생성 (2~3개사 선정)                │
│  - Jina Reader API → 경쟁사 웹사이트 본문 전체 추출         │
│  - 선정 이유 (selection_rationale) 명시 강제                │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Planner Node                                       │
│  - 심층 분석용 검색 키워드 4~6개 도출                        │
│  - 국내 타겟 키워드 50% 이상 의무 (글로벌 편향 방지)         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Web Researcher Node                                │
│  - Phase A: DuckDuckGo 키워드별 검색 (키워드당 3건)         │
│  - Phase B: 국내 필수 검색 강제 실행                         │
│    ("SKT KT 삼성SDS LG CNS 네이버클라우드" 등 고정 쿼리)    │
│  - Phase C: Jina Reader 상위 5 URL 본문 전체 추출           │
│  - 검색 실패 시 Mock 데이터 fallback (파이프라인 중단 없음)  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Graph Structuring Node                             │
│  - 수집 데이터 → 지식 그래프 (노드 6~12개, 엣지 5개 이상)   │
│  - 노드 타입: company / product / trend / threat             │
│  - 엣지 타입: competes_with / leverages / threatens 등      │
│  - method="function_calling" (중첩 스키마 직렬화 안정성)    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Reporter Node                                      │
│  - TAM / SAM / SOM 수치 기반 추정 (근거 없으면 "(추정)" 강제) │
│  - 진입 장벽 / 차별화 포인트 / GTM 채널 / 리스크 시나리오   │
│  - ReporterOutput Pydantic 스키마 16개 필드 강제 생성        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Intelligence Agent Node                            │
│  - 경영진 3줄 즉시 실행 전략 요약                            │
│  - 가격 인텔리전스 (시장 평균 대비 경쟁사 포지셔닝)          │
│  - 스펙 비교표 (advantage_holder 명시)                       │
│  - 절대적 강점 / 즉시 보완 필요 약점                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
SSE complete 이벤트 → 프론트엔드 대시보드 렌더링
```

---

## 보고서 대시보드 구성

| 순서 | 섹션 | 주요 내용 |
|------|------|----------|
| 0 | 목적별 PDF 내보내기 | 5종 버튼 — 클릭 즉시 PDF 다운로드 |
| 1 | Executive Insight Panel | 즉시 실행 전략 3줄 / 절대 강점 / 치명적 약점 |
| 2 | Executive Summary | 전체 분석 내러티브 요약 |
| 3 | 시장 포지셔닝 분석 | 시장 개요 + 포지셔닝 |
| 4 | 가격 인텔리전스 | 경쟁사별 가격 / 모델 / 시장 평균 대비 비교 |
| 5 | Phase 1 Market Scan | 5개 이상 경쟁사 relevance_score 테이블 (체크박스 선택) |
| 6 | 스펙 비교표 | 항목별 당사 vs 경쟁사 (초록=우위 / 빨강=열위) |
| 7 | Phase 2 경쟁사 프로필 | 심층 강점/약점 카드 |
| 8 | 시장 구조 분석 | TAM/SAM/SOM / 성숙도 / 진입 장벽 / 차별화 / GTM |
| 9 | Graph RAG 인사이트 | 지식 그래프 노드/엣지 + 도출 인사이트 |
| 10 | 전략적 권고사항 | 실행 가능한 전략 제언 |
| 11 | 참고 출처 | 수집 URL / 스니펫 최대 12건 |

---

## PDF 내보내기 (5종)

클릭 즉시 html2canvas로 hidden 렌더 div 캡처 → jsPDF A4 변환 → 다운로드. API 호출 없음.

| 버튼 | 용도 | 포함 내용 |
|------|------|----------|
| 시장 진입 브리핑 | 내부 경영진 보고 | 경쟁사 프로필, 시장 기회, 전략 권고 |
| 경쟁 전략 요약 | 제안/입찰 | 스펙 비교, 차별화, GTM 채널 |
| 투자자용 시장 요약 | VC·투자자 | TAM/SAM/SOM, 성숙도, 진입 장벽 |
| 파트너십 제안서 | 파트너사 첨부 | 절대 강점, 협업 시너지 |
| 신사업 검토 보고 | 전략기획·임원 | 리스크 시나리오, 첫 고객 힌트, 진입 경로 |

---

## 기업 심층 분석 (새 탭)

Phase 1 테이블에서 경쟁사를 체크박스로 선택 → "심층 분석" 버튼 → 새 브라우저 탭(`/deep-dive`)에서 SSE 스트리밍으로 분석.

- **단일 기업**: 비즈니스 모델, 핵심 기술, 주요 제품, SWOT, 최근 동향, 고객 Pain Point
- **비교 분석**: 핵심 서비스 / 타겟 고객 / 가격 모델 / 시장 포지션 비교표

파라미터는 `localStorage`로 전달 (URL 길이 제한 회피).

---

## 핵심 기술 설계

### LangGraph 스트리밍

`stream_mode=["updates", "custom"]` 조합으로 실시간 진행 이벤트와 최종 상태를 동시에 수신합니다.

```python
async for stream_mode, chunk in graph.astream(initial, stream_mode=["updates", "custom"]):
    if stream_mode == "custom":
        # writer()로 방출한 실시간 진행 이벤트 (stage_start / searching / stage_complete)
        yield {"event": "progress", "data": json.dumps(chunk)}
    elif stream_mode == "updates":
        # 노드 완료 시 상태 델타 → accumulated에 병합 → complete 감지
        accumulated.update(chunk[node_name])
```

### Structured Output — Hallucination 방지 4단계

```
1. Pydantic 스키마 강제
   LLM이 자유 텍스트가 아닌 스키마 필드를 채우도록 강제
   → 형식 이탈 불가, 필드 누락 방지

2. "(추정)" 표기 의무화
   TAM/가격/점유율 등 수치는 근거 없을 경우 "(추정)" 명시를 프롬프트에서 강제
   → 사실인 것처럼 수치를 꾸미는 것 방지

3. 실시간 웹 데이터 기반 분석 (RAG)
   DuckDuckGo 검색 + Jina Reader 본문 추출 → 최신 데이터를 컨텍스트로 활용
   → "수집된 데이터에서 확인된 사실만 사용" 지침 명시

4. BM 카테고리 필터링
   market_scan_node에서 BM 불일치 기업 배제
   → "Nvidia 같은 하드웨어 OEM이 SaaS 경쟁사로 나오는" 오류 방지
```

```python
# 중첩 Pydantic 모델은 function_calling으로 직렬화 안정성 확보
chain = prompt | llm.with_structured_output(GraphOutput, method="function_calling")

# 단순 스키마는 기본 json_schema 사용
chain = prompt | llm.with_structured_output(ReporterOutput)
```

### SSE 청크 파서

`fetch()` ReadableStream은 SSE 이벤트 경계를 보장하지 않습니다. 버퍼링으로 분할 청크를 처리합니다.

```typescript
export function createSSEParser(onEvent: (event: string, data: string) => void) {
    let buffer = "";
    return function parse(chunk: string) {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 불완전 마지막 라인 보존
        // 완전한 라인만 event:/data: 파싱
    };
}
```

### 노드별 프롬프트 전략

| 노드 | 핵심 지침 | 제약 |
|------|----------|------|
| market_scan | BM 분류 후 동일 카테고리만 포함 | 하드웨어 OEM 배제 규칙 명시 |
| competitor_select | 타겟 고객 겹침 기준 선정 | selection_rationale 설명 강제 |
| planner | 국내 키워드 50% 이상 의무 | 글로벌 편향 방지 |
| researcher | Phase B 국내 필수 쿼리 고정 실행 | SKT/KT/삼성SDS/네이버클라우드 포함 |
| reporter | TAM/SAM/SOM 수치 추정 의무 | 공개 정보 없으면 "(추정)" 강제 |
| intelligence | "지금 당장 취할 액션" 3줄 | 일반론 금지, 이 제품·시장 특화만 허용 |

---

## SSE 이벤트 명세

### `/analyze` 및 `/deep-dive` 스트림

| event | data 구조 | 설명 |
|-------|----------|------|
| `progress` | `{type, step, node, message}` | 에이전트 단계 진행 |
| `complete` | `AnalysisResult` 전체 JSON | 분석 완료 최종 결과 |
| `terminal` | `{type, fallback_message?, error?}` | 조기 종료 (입력 불충분 또는 오류) |

`progress.type` 값: `stage_start` / `stage_complete` / `searching` / `fallback` / `error`

---

## 분석 성능

| 항목 | 수치 |
|------|------|
| 총 분석 소요 시간 | 45~90초 |
| LLM 비용 (1회) | 약 $0.10~0.25 (GPT-4o-mini 기준) |
| Phase 1 경쟁사 탐색 | 5개 이상 자동 발굴 |
| Phase 2 심층 분석 | 2~3개사 선택 |
| 검색 결과 수집 | 평균 20~30건 |
| Jina 딥 스크래핑 | 최대 5 URL × 4,000자/페이지 |
| PDF 종류 | 5종 (A4 1페이지) |

---

## Fallback 처리

입력 내용이 불충분하면 LLM 추측 없이 재입력 안내 메시지를 반환하고 조기 종료합니다.

**유효 조건**: 제품 카테고리, 타겟 고객, 핵심 기능 중 **최소 2가지** 명확히 포함

**무효 예시**: "AI", "챗봇 만들어줘", 10단어 미만 모호한 입력

```
market_scan_node
    │  is_valid_input = False
    ▼
route_on_error() → END
    │
    ▼
SSE terminal 이벤트 → 프론트엔드 재입력 안내 화면
```

---

## 환경 변수

### 백엔드 (.env)

| 변수 | 설명 | 필수 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 | 필수 |
| `MODEL_NAME` | GPT 모델명 (기본: `gpt-4o-mini`) | 선택 |
| `LANGCHAIN_TRACING_V2` | LangSmith 트레이싱 활성화 | 선택 |
| `LANGCHAIN_API_KEY` | LangSmith API 키 | 선택 |
| `LANGCHAIN_PROJECT` | LangSmith 프로젝트명 | 선택 |

### 프론트엔드 (frontend/.env.local)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI 서버 URL | `http://localhost:8000` |

---

## 데모 입력 예시

```
GPT-4o급 성능의 국산 언어모델을 기업 고객에게 API 형태로 제공하는 LLM APIaaS 서비스.
타겟은 국내 금융권, 공공기관, 대기업 IT 부서.
on-premise 배포 및 데이터 보안 SLA 제공.
```

**예상 출력 (45~90초 후)**

```
[Executive Insight — 즉시 실행 전략]
1) 네이버클라우드 HyperCLOVA X와의 직접 가격 비교 자료 선제적 확보 후
   금융권 보안 인증(ISMS-P) 취득 속도를 영업 USP로 전면화할 것
2) SK텔레콤 AI에게 빼앗기고 있는 공공기관 PoC 시장을 위해
   조달청 나라장터 등록 및 GS인증을 최우선 과제로 설정
3) AWS/Azure 대비 데이터 주권 이슈를 레버리지하는 국산 AI 마케팅 전략 즉시 실행

[Phase 1] 경쟁사 자동 도출
  - 네이버클라우드 (HyperCLOVA X): 직접 경쟁, 위협도 9/10
  - SKT AI (에이닷/A.X): 직접 경쟁, 위협도 8/10
  - KT AI: 직접 경쟁, 위협도 7/10
  - 삼성SDS (Brity): 직접 경쟁, 위협도 7/10
  - OpenAI API: 간접 경쟁, 위협도 8/10
  ...
```

---

## 확장 로드맵

```
현재 (v2.0)
├─ 7단계 자율형 파이프라인
├─ 실시간 SSE 스트리밍
├─ 5종 PDF 보고서 즉시 다운로드
├─ 기업별 심층 분석 / 비교 분석 (새 탭)
└─ 3종 원페이지 목적별 보고서 (API)

단기 (v2.1)
├─ 분석 히스토리 저장 및 재분석 비교
├─ 사용자 유형별 보고서 커스터마이징 (컨설턴트 / VC / 전략기획)
└─ 경쟁사 변동 알림 (주기적 재분석 + 차이점 하이라이트)

중기 (v3.0)
├─ RAG 기반 내부 문서 통합 (사내 보고서 + 웹 데이터 결합)
├─ Slack / Teams 연동 (보고서 자동 발송)
└─ 다국어 지원 (영문 / 일문 보고서 출력)
```
