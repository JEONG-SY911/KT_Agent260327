# Market Intelligence Agent

제품/서비스 설명을 입력하면 AI 에이전트가 자동으로 경쟁사를 탐색하고 마켓 인텔리전스 보고서를 생성하는 웹 프로토타입입니다.

**Python(FastAPI + LangGraph) 백엔드**와 **Next.js 프론트엔드**로 구성되어 있으며, 5개의 AI 에이전트가 순차적으로 실행되어 최종 보고서를 생성합니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| AI 오케스트레이션 | LangGraph 1.1.3, LangChain 1.2.13 |
| LLM | OpenAI GPT-4o-mini (`langchain-openai` 1.1.12) |
| 웹 검색 | DuckDuckGo Search (실패 시 Mock 데이터 자동 대체) |
| API 서버 | FastAPI 0.135.2, uvicorn 0.42.0 |
| 실시간 스트리밍 | Server-Sent Events (`sse-starlette` 3.3.3) |
| 프론트엔드 | Next.js 15 (App Router), TypeScript, TailwindCSS v3 |
| 아이콘 | lucide-react |

---

## 프로젝트 구조

```
KT_Agent260327/
├── backend/                     Python 백엔드 패키지
│   ├── main.py                  FastAPI 앱, SSE 엔드포인트 (POST /analyze)
│   ├── schemas.py               LLM 구조화 출력용 Pydantic 모델
│   ├── graph/
│   │   ├── state.py             LangGraph 워크플로우 상태 정의 (TypedDict)
│   │   ├── nodes.py             5개 에이전트 노드 함수 (async + StreamWriter)
│   │   ├── edges.py             조건부 라우팅 함수
│   │   └── builder.py           StateGraph 조립 및 컴파일
│   └── tools/
│       └── search.py            DuckDuckGo 비동기 검색 래퍼
│
├── frontend/                    Next.js 프론트엔드
│   ├── app/
│   │   ├── layout.tsx           루트 레이아웃
│   │   ├── page.tsx             메인 페이지 (상태 기계 및 SSE 소비)
│   │   └── globals.css          TailwindCSS 글로벌 스타일
│   ├── components/
│   │   ├── InputForm.tsx        제품 설명 입력 폼
│   │   ├── AgentProgress.tsx    에이전트 실행 단계 표시 (수직 스테퍼)
│   │   ├── ReportView.tsx       최종 보고서 대시보드 (7개 섹션)
│   │   └── SkeletonLoader.tsx   로딩 스켈레톤 UI
│   ├── lib/
│   │   └── streamParser.ts      청크 분할 SSE 스트림 파서
│   ├── types/
│   │   └── analysis.ts          TypeScript 인터페이스 정의
│   └── .env.local               프론트엔드 환경 변수
│
├── run_backend.sh               백엔드 실행 스크립트
├── run_frontend.sh              프론트엔드 실행 스크립트
├── requirements.txt             Python 의존성
└── .env                         API 키 설정
```

---

## 실행 방법

### 1. 환경 변수 확인

`.env` 파일에 아래 키가 설정되어 있어야 합니다.

```bash
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o-mini
```

### 2. 백엔드 실행

```bash
# 터미널 1
bash run_backend.sh
# → http://localhost:8000 에서 FastAPI 서버 시작
```

정상 기동 시 콘솔에 다음과 같이 출력됩니다.

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

FastAPI 자동 문서는 `http://localhost:8000/docs` 에서 확인할 수 있습니다.

### 3. 프론트엔드 실행

```bash
# 터미널 2 (최초 실행 시 npm install 자동 수행)
bash run_frontend.sh
# → http://localhost:3000 에서 Next.js 개발 서버 시작
```

브라우저에서 `http://localhost:3000` 을 열면 입력 화면이 표시됩니다.

---

## 에이전트 워크플로우

사용자가 제품 설명을 제출하면 아래 5단계 파이프라인이 순차 실행됩니다.

```
사용자 입력
    │
    ▼
[1] Discovery Agent
    입력 유효성 검증 → 시장 포지셔닝 분석 → 직접 경쟁사 2곳 + 간접 경쟁사 1곳 식별
    │
    ├── 입력 불충분 → 안내 메시지 반환 후 종료
    │
    ▼
[2] Planner Agent
    경쟁사 목록 기반으로 심층 분석용 검색 키워드 3~5개 도출
    │
    ▼
[3] Web Researcher Agent
    DuckDuckGo로 키워드별 웹 검색 수행, 결과 수집
    (API 실패 시 Mock 데이터로 자동 대체)
    │
    ▼
[4] Graph Structuring Agent
    수집 데이터를 기업/제품/트렌드/위협 노드와 엣지로 구조화
    → 지식 그래프(Knowledge Graph) JSON 생성
    │
    ▼
[5] Reporter Agent
    전체 데이터를 종합하여 최종 마켓 인텔리전스 보고서 작성
    │
    ▼
최종 대시보드 렌더링
```

각 에이전트 실행 결과는 **Server-Sent Events**로 프론트엔드에 실시간 스트리밍됩니다.

---

## 핵심 코드 설명

### LangGraph 상태 (backend/graph/state.py)

워크플로우 전체에서 공유되는 단일 상태 객체입니다. 각 노드는 자신이 갱신하는 필드만 반환하며, LangGraph가 기존 상태에 병합합니다.

```python
class AgentState(TypedDict):
    product_description: str   # 사용자 입력
    is_valid_input: bool        # Discovery Agent가 판단
    competitors: list[dict]     # 식별된 경쟁사 목록
    search_keywords: list[str]  # Planner Agent가 도출
    raw_research: list[dict]    # Web Researcher가 수집
    knowledge_graph: dict       # Graph Structuring Agent가 구축
    final_report: dict          # Reporter Agent가 작성
    current_stage: str          # 현재 단계 식별자
    ...
```

### 에이전트 노드 구조 (backend/graph/nodes.py)

모든 노드는 `(state, writer)` 시그니처를 가진 비동기 함수입니다. `writer`는 LangGraph가 주입하는 `StreamWriter`로, 호출 시 SSE 스트림에 즉시 이벤트를 방출합니다.

```python
async def discovery_node(state: AgentState, writer: StreamWriter) -> dict:
    # 진행 상황을 SSE로 즉시 방출
    writer({"type": "stage_start", "step": 1, "message": "시장 내 유사 솔루션 탐색 중..."})

    # LLM 호출 (구조화 출력)
    result: DiscoveryOutput = await chain.ainvoke(...)

    writer({"type": "stage_complete", "step": 1, "message": "잠재적 경쟁사 식별 완료"})

    # 갱신할 상태 필드만 반환 (LangGraph가 병합)
    return {"competitors": [...], "current_stage": "discovery_complete"}
```

### LangGraph 스트리밍 (backend/main.py)

`stream_mode=["updates", "custom"]` 조합으로 두 종류의 이벤트를 동시에 수신합니다.

```python
async for stream_mode, chunk in graph.astream(initial, stream_mode=["updates", "custom"]):
    if stream_mode == "custom":
        # writer()로 방출한 실시간 진행 이벤트
        yield {"event": "progress", "data": json.dumps(chunk)}

    elif stream_mode == "updates":
        # 노드 완료 시 상태 델타
        accumulated.update(chunk[node_name])
        if accumulated["current_stage"] == "complete":
            yield {"event": "complete", "data": json.dumps(payload)}
```

### SSE 파서 (frontend/lib/streamParser.ts)

`fetch()`의 `ReadableStream`은 SSE 이벤트 경계를 보장하지 않습니다. 한 번의 `read()` 호출로 여러 이벤트가 오거나 이벤트가 두 청크에 나뉘어 올 수 있습니다. 버퍼를 유지하여 불완전한 라인을 다음 청크까지 보존합니다.

```typescript
export function createSSEParser(onEvent) {
    let buffer = "";
    return function parse(chunk: string) {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";  // 마지막 불완전 라인은 버퍼에 보존
        // 완전한 라인만 처리...
    };
}
```

### 구조화 출력 스키마 (backend/schemas.py)

각 에이전트는 `with_structured_output(PydanticModel)`을 통해 LLM으로부터 타입이 보장된 응답을 받습니다.

- 단순 스키마 (Discovery, Planner, Reporter): 기본 `method="json_schema"` 사용
- 중첩 리스트 스키마 (Graph Structuring): `method="function_calling"` 사용 (strict 모드 제약 우회)

---

## SSE 이벤트 명세

백엔드가 방출하는 SSE 이벤트 타입은 다음과 같습니다.

| event 필드 | data 구조 | 설명 |
|-----------|----------|------|
| `progress` | `{type, step, node, message}` | 에이전트 단계 진행 상황 |
| `complete` | `AnalysisResult` 전체 객체 | 분석 완료, 최종 결과 |
| `terminal` | `{type, fallback_message?, error?}` | 입력 불충분 또는 오류로 조기 종료 |

`progress` 이벤트의 `type` 값:

| type | 의미 |
|------|------|
| `stage_start` | 에이전트 노드 실행 시작 |
| `stage_complete` | 에이전트 노드 실행 완료 |
| `searching` | Web Researcher가 특정 키워드 검색 중 |
| `fallback` | 입력 불충분 안내 메시지 |
| `error` | 노드 내부 오류 |

---

## 보고서 대시보드 구성

분석 완료 후 렌더링되는 대시보드는 7개 섹션으로 구성됩니다.

| 순서 | 섹션 | 내용 |
|------|------|------|
| 1 | Executive Summary | 전체 분석 요약 및 경쟁 환경 종합 |
| 2 | 시장 포지셔닝 분석 | 사용자 제품의 시장 내 위치 분석 |
| 3 | 경쟁사 프로필 | 직접 경쟁사 2곳 + 간접/대체재 1곳 (강점/약점 포함) |
| 4 | 시장 기회 요소 | 진입 또는 성장 가능한 시장 기회 목록 |
| 5 | 위협 요소 및 리스크 | 경쟁 및 시장 위협 요소 목록 |
| 6 | Graph RAG 인사이트 | 지식 그래프 노드/엣지 및 도출 인사이트 |
| 7 | 전략적 권고사항 | 실행 가능한 전략 제언 |
| 8 | Reference | 수집된 출처 링크 및 인용 근거 |

---

## 환경 변수

### 백엔드 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 키 (필수) | - |
| `MODEL_NAME` | 사용할 GPT 모델명 | `gpt-4o-mini` |
| `LANGCHAIN_TRACING_V2` | LangSmith 트레이싱 활성화 | `false` |
| `LANGCHAIN_API_KEY` | LangSmith API 키 | - |
| `LANGCHAIN_PROJECT` | LangSmith 프로젝트명 | - |

### 프론트엔드 (frontend/.env.local)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI 서버 URL | `http://localhost:8000` |

---

## Fallback 처리

입력 내용이 불충분하면 LLM 추측 없이 다음 메시지를 반환합니다.

> 입력하신 정보만으로는 정확한 시장 포지셔닝을 분석하기 어렵습니다.
> 주요 타겟 고객층이나 핵심 기능 1~2가지를 추가로 설명해 주시면 더 깊은 분석이 가능합니다.

유효 판단 기준: 제품 카테고리, 타겟 고객, 핵심 기능 중 **최소 2가지**가 명확히 언급된 경우 분석 진행.
