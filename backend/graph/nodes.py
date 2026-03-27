"""
LangGraph agent node functions for the market analysis workflow.

2-Phase competitor analysis pipeline:
  Phase 1 (market_scan_node)      - Broad scan: 5+ competitors with metadata
  Phase 2 (competitor_select_node) - Deep analysis: select 2-3, build full profiles

Additional nodes: planner, researcher (Korean-aware), graph_structuring, reporter.

Each node is an async function accepting (state, writer):
  - state: AgentState - current accumulated workflow state
  - writer: StreamWriter - pushes a progress event into the SSE stream

Nodes return a partial state dict; LangGraph merges it with the existing state.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.types import StreamWriter

from backend.graph.state import AgentState
from backend.schemas import (
    CompetitorSelectionOutput,
    GraphStructuringOutput,
    MarketScanOutput,
    PlannerOutput,
    ReporterOutput,
)
from backend.tools.search import search_web_async

logger = logging.getLogger(__name__)

_FALLBACK_MESSAGE = (
    "입력하신 정보만으로는 정확한 시장 포지셔닝을 분석하기 어렵습니다. "
    "주요 타겟 고객층이나 핵심 기능 1~2가지를 추가로 설명해 주시면 더 깊은 분석이 가능합니다."
)


def _llm(temperature: float = 0) -> ChatOpenAI:
    # Reads API key and model name at call time so .env changes are reflected on restart.
    return ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4o-mini"),
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=temperature,
    )


# ──────────────────────────────────────────────────────────────────────
# 1. Market Scan Node  (Phase 1 — broad scan, 5+ competitors)
# ──────────────────────────────────────────────────────────────────────

_MARKET_SCAN_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.
감정적 표현 없이 데이터와 논리에 기반하여 직설적으로 분석합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 1: 비즈니스 모델(BM) 분류 — 경쟁사 나열 전 필수 선행]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자 제품의 BM을 아래 중 하나로 먼저 분류하십시오:

  BM-A (서비스형)  : SaaS / IaaS / PaaS / BaaS — 소프트웨어·인프라를 구독 또는 종량제로 제공
  BM-B (하드웨어)  : 반도체, 서버, GPU, 네트워크 장비 등 물리적 제품 제조·판매 (OEM/Vendor)
  BM-C (SI/컨설팅): 프로젝트 기반 IT 구축·운영 서비스

[강제 필터링 규칙 — BM 불일치 기업 완전 배제]
  - 사용자 BM이 A(서비스형)이면:
      BM-B(하드웨어 OEM·제조사)는 경쟁사 목록에서 완전히 제외합니다.
      (올바른 예) GPU 클라우드 서비스 → CoreWeave, Lambda Labs, Vast.ai 포함
                                        → Nvidia(반도체 제조사) 제외
      (잘못된 예) GPU 클라우드 서비스 → Nvidia를 경쟁사로 포함 — BM 불일치, 허용 불가
  - 사용자 BM이 B(하드웨어)이면:
      BM-A(SaaS·클라우드 서비스사)는 경쟁사 목록에서 제외합니다.
  - 반드시 "동일한 서비스 딜리버리 모델"을 보유한 기업만 후보군으로 인정합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 2: Phase 1 시장 스캔 — BM 필터링 통과 기업만 나열]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
요구사항:
- 최소 5개 이상의 경쟁사를 도출합니다 (BM 일치 기업만).
- 글로벌 기업과 국내(한국) 기업을 반드시 혼합하여 포함합니다.
- 국내 B2B 시장의 경우 아래 기업군을 우선 검토하고, BM이 일치하면 반드시 포함하십시오:
    통신사 클라우드 : SKT(T클라우드비즈), KT(KT Cloud), LG유플러스 기업솔루션
    대형 SI·IT서비스: 삼성SDS, LG CNS, SK C&C, 롯데정보통신, 현대오토에버
    클라우드 네이티브: 네이버클라우드, 카카오클라우드, NHN클라우드
- 각 기업의 예상 시장 점유율, 투자 현황, 설립 연도 등 메타데이터를 파악합니다.
- relevance_score(경쟁 위협도 1-10)를 기준으로 내림차순 정렬합니다.
- type은 direct / indirect / adjacent 중 하나로 분류합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[입력 유효성 판단]
- 유효(is_valid_input=true): 제품 카테고리, 타겟 고객, 핵심 기능 중 최소 2가지가 명확히 언급됨
- 무효(is_valid_input=false): 단순 키워드 나열, 10단어 미만의 모호한 설명"""

_MARKET_SCAN_HUMAN = "다음 제품/서비스를 분석해 주세요:\n\n{product_description}"


async def market_scan_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "market_scan", "step": 1,
            "message": "시장 내 잠재적 경쟁사 스캔 중..."})

    structured_llm = _llm().with_structured_output(MarketScanOutput)
    chain = ChatPromptTemplate.from_messages([
        ("system", _MARKET_SCAN_SYSTEM),
        ("human", _MARKET_SCAN_HUMAN),
    ]) | structured_llm

    try:
        result: MarketScanOutput = await chain.ainvoke(
            {"product_description": state["product_description"]}
        )
    except Exception as exc:
        logger.error("Market scan node failed: %s", exc)
        writer({"type": "error", "message": str(exc)})
        return {
            "error": str(exc), "current_stage": "error",
            "is_valid_input": False, "fallback_message": "",
            "market_overview": "", "phase1_competitors": [],
        }

    if not result.is_valid_input:
        fallback = result.fallback_message or _FALLBACK_MESSAGE
        writer({"type": "fallback", "message": fallback})
        return {
            "is_valid_input": False,
            "fallback_message": fallback,
            "market_overview": "",
            "phase1_competitors": [],
            "current_stage": "invalid_input",
        }

    competitors = [c.model_dump() for c in result.phase1_competitors]
    writer({
        "type": "stage_complete", "node": "market_scan", "step": 1,
        "message": f"잠재 경쟁사 {len(competitors)}개 목록 확보",
    })

    return {
        "is_valid_input": True,
        "fallback_message": "",
        "market_overview": result.market_overview,
        "phase1_competitors": competitors,
        "current_stage": "market_scan_complete",
    }


# ──────────────────────────────────────────────────────────────────────
# 2. Competitor Selection Node  (Phase 2 — select 2-3, deep profiles)
# ──────────────────────────────────────────────────────────────────────

_COMPETITOR_SELECT_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 1: BM 일치성 재검증 — 선정 전 필수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1 목록에서 각 후보의 BM이 사용자 제품과 일치하는지 재확인합니다.

  확인 항목: 후보가 사용자와 동일한 서비스 딜리버리 모델(SaaS/IaaS/하드웨어 등)인가?
  제외 규칙: 하드웨어 OEM·반도체 제조사가 Phase 1 목록에 포함되어 있다면
             이 단계에서 강제 제외합니다. 선정 대상에서 완전히 배제합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 2: 핵심 경쟁사 선정 및 심층 분석]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BM 검증을 통과한 후보 중 사용자 제품에 가장 위협적인 2~3곳을 선정합니다.

[선정 기준 (우선순위 순)]
1. BM 일치 여부 — 반드시 동일한 서비스 딜리버리 모델이어야 함 (하드웨어 OEM 완전 배제)
2. 타겟 고객 겹침 정도 — 동일 고객 세그먼트를 직접 공략하는가?
3. 핵심 기능 유사성 — 사용자 제품과 기능이 얼마나 겹치는가?
4. 시장 내 영향력 — relevance_score, 투자 규모, 시장 점유율
5. 진입 위협 — 신규 진입이나 기능 확장 가능성

[심층 프로필 작성 지침]
- key_products: 실제 제품명 또는 기능명 (추측 금지)
- strengths/weaknesses: 사용자 제품 관점에서의 차별화 포인트 포함
- 약점은 사용자 제품이 차별화할 수 있는 기회 관점에서 서술"""

_COMPETITOR_SELECT_HUMAN = """사용자 제품 설명: {product_description}

Phase 1 경쟁사 목록 (relevance_score 내림차순):
{phase1_summary}

위 목록에서 핵심 경쟁사 2~3곳을 선정하고 심층 분석 프로필을 작성해 주세요."""


async def competitor_select_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "competitor_select", "step": 2,
            "message": "핵심 경쟁사 선별 및 심층 분석 중..."})

    structured_llm = _llm().with_structured_output(CompetitorSelectionOutput)
    chain = ChatPromptTemplate.from_messages([
        ("system", _COMPETITOR_SELECT_SYSTEM),
        ("human", _COMPETITOR_SELECT_HUMAN),
    ]) | structured_llm

    phase1_summary = "\n".join(
        f"{i+1}. {c.get('name','')} (위협도 {c.get('relevance_score','')}/10, {c.get('type','')}): "
        f"{c.get('description','')} | 점유율: {c.get('market_share_estimate','미상')} | "
        f"투자: {c.get('funding_info','미상')} | 설립: {c.get('founded_year','미상')}"
        for i, c in enumerate(state.get("phase1_competitors", []))
    )

    try:
        result: CompetitorSelectionOutput = await chain.ainvoke({
            "product_description": state["product_description"],
            "phase1_summary": phase1_summary,
        })
    except Exception as exc:
        logger.error("Competitor select node failed: %s", exc)
        writer({"type": "error", "message": str(exc)})
        return {
            "error": str(exc), "current_stage": "error",
            "market_positioning": "", "competitors": [],
        }

    profiles = [p.model_dump() for p in result.detailed_profiles]
    writer({
        "type": "stage_complete", "node": "competitor_select", "step": 2,
        "message": f"핵심 경쟁사 {len(profiles)}곳 선정 완료",
    })

    return {
        "market_positioning": result.market_positioning,
        "competitors": profiles,
        "current_stage": "competitor_select_complete",
    }


# ──────────────────────────────────────────────────────────────────────
# 3. Planner Agent  (Korean-market aware keyword generation)
# ──────────────────────────────────────────────────────────────────────

_PLANNER_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.
경쟁사 목록과 사용자 제품 정보를 바탕으로 심층 분석을 위한 최적의 검색 키워드를 도출합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[국내 시장 탐색 의무화 — 빅테크 편향 보정]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
글로벌 검색만으로는 AWS, MS Azure, Google Cloud 등 빅테크 위주로 결과가 편향되어
국내 실질 경쟁사(통신사·대형 SI)가 누락됩니다.

아래 국내 기업군이 해당 시장에서 경쟁하는지 확인하는 키워드를 2개 이상 반드시 포함하세요:

  통신사 클라우드 : SKT T클라우드비즈, KT Cloud, LG유플러스 기업솔루션
  대형 SI·IT서비스: 삼성SDS, LG CNS, SK C&C, 롯데정보통신, 현대오토에버
  클라우드 네이티브: 네이버클라우드, 카카오클라우드, NHN클라우드

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[키워드 구성 비율]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 국내 타겟 (50% 이상): 위 기업명 포함 한글 키워드, "국내 시장 점유율", "한국 엔터프라이즈" 등
- 글로벌 타겟 (나머지): 경쟁사명 + 기능/가격/평가 조합 영문 키워드

키워드 생성 예시:
  국내 의무 포함: "GPU 클라우드 국내 경쟁사 SKT KT 삼성SDS 2024"
  국내 의무 포함: "한국 AI 인프라 대여 클라우드 통신사 AIDC 엔터프라이즈"
  글로벌: "GPU cloud IaaS competitor pricing Lambda Labs CoreWeave 2024"

총 4~6개의 키워드를 도출하세요."""

_PLANNER_HUMAN = """제품 설명: {product_description}

핵심 경쟁사 목록:
{competitors_summary}

심층 분석을 위한 검색 키워드를 기획해 주세요."""


async def planner_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "planner", "step": 3,
            "message": "심층 분석 전략 수립 중..."})

    structured_llm = _llm().with_structured_output(PlannerOutput)
    chain = ChatPromptTemplate.from_messages([
        ("system", _PLANNER_SYSTEM),
        ("human", _PLANNER_HUMAN),
    ]) | structured_llm

    competitors_summary = "\n".join(
        f"- {c.get('name', '')} ({c.get('type', '')}): {c.get('description', '')}"
        for c in state.get("competitors", [])
    )

    try:
        result: PlannerOutput = await chain.ainvoke({
            "product_description": state["product_description"],
            "competitors_summary": competitors_summary,
        })
    except Exception as exc:
        logger.error("Planner node failed: %s", exc)
        writer({"type": "error", "message": str(exc)})
        return {"error": str(exc), "current_stage": "error",
                "search_keywords": [], "analysis_rationale": ""}

    writer({"type": "stage_complete", "node": "planner", "step": 3,
            "message": "분석 키워드 도출 완료"})

    return {
        "search_keywords": result.search_keywords,
        "analysis_rationale": result.analysis_rationale,
        "current_stage": "planner_complete",
    }


# ──────────────────────────────────────────────────────────────────────
# 4. Web Researcher Agent  (Korean search enhancement)
# ──────────────────────────────────────────────────────────────────────

_KOREAN_INDICATORS = ("국내", "한국", "korea", "korean", "site:kr", "국내 경쟁", "한국 스타트업")

# 플래너 키워드와 무관하게 항상 실행되는 국내 통신·SI 기업 탐색 쿼리
_DOMESTIC_TELCO_SI_QUERY = (
    "국내 클라우드 통신사 SI 대기업 엔터프라이즈 서비스 "
    "SKT KT 삼성SDS LG CNS 네이버클라우드 카카오클라우드 시장 점유율"
)


def _enhance_korean_query(query: str) -> str:
    """
    For queries already targeting the Korean market, appends 'site:kr'
    to increase domestic result density. Global queries are returned as-is.
    """
    lower = query.lower()
    if any(kw in lower for kw in _KOREAN_INDICATORS):
        if "site:kr" not in lower:
            return f"{query} site:kr"
    return query


def _build_domestic_b2b_query(competitors: list[dict]) -> str:
    """
    Builds a context-aware domestic B2B query using Phase 2 competitor names
    so search results are relevant to the specific market segment.
    """
    known_names = " ".join(
        c.get("name", "") for c in competitors[:2] if c.get("name")
    ).strip()
    if known_names:
        return f"한국 B2B 엔터프라이즈 국내 경쟁사 {known_names} 통신사 SI 시장 2024"
    return "한국 B2B 엔터프라이즈 국내 클라우드 솔루션 경쟁사 통신사 SI 시장 2024"


async def researcher_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "researcher", "step": 4,
            "message": "데이터 수집 및 크롤링 중..."})

    all_results: list[dict] = []

    # ── (A) Planner-generated keywords ───────────────────────────────
    for keyword in state.get("search_keywords", []):
        enhanced = _enhance_korean_query(keyword)
        writer({"type": "searching", "node": "researcher", "step": 4,
                "message": f"'{keyword}' 검색 중..."})
        results = await search_web_async(enhanced, max_results=3)
        for r in results:
            r["keyword"] = keyword
        all_results.extend(results)

    # ── (B) Mandatory domestic Korean market searches ─────────────────
    # Executed regardless of Planner output to prevent omission of
    # domestic telco/SI companies (SKT, KT, Samsung SDS, LG CNS, etc.)
    # that are consistently underrepresented by global-biased queries.
    domestic_queries = [
        _DOMESTIC_TELCO_SI_QUERY,
        _build_domestic_b2b_query(state.get("competitors", [])),
    ]
    for query in domestic_queries:
        writer({"type": "searching", "node": "researcher", "step": 4,
                "message": "국내 통신·SI 기업 탐색 중..."})
        results = await search_web_async(query, max_results=3)
        for r in results:
            r["keyword"] = query
            r["market_scope"] = "domestic_kr"
        all_results.extend(results)

    writer({"type": "stage_complete", "node": "researcher", "step": 4,
            "message": "관련 자료 수집 완료"})

    return {
        "raw_research": all_results,
        "current_stage": "research_complete",
    }


# ──────────────────────────────────────────────────────────────────────
# 5. Graph Structuring Agent
# ──────────────────────────────────────────────────────────────────────

_GRAPH_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.
수집된 시장 데이터를 분석하여 지식 그래프(Knowledge Graph)로 구조화합니다.

노드 유형:
- company: 기업 (사용자 제품 포함)
- product: 제품/서비스/기능
- trend: 시장 트렌드
- threat: 위협 요소/리스크

엣지 관계 예시: competes_with, targets, leverages, threatens, offers, disrupts, adopts, depends_on

요구사항: 최소 6개 노드, 최소 5개 엣지. 노드 ID는 소문자 snake_case로 작성하세요."""

_GRAPH_HUMAN = """제품 설명: {product_description}

핵심 경쟁사 (Phase 2 선정):
{competitors_summary}

수집된 시장 데이터:
{research_snippets}

위 정보를 기반으로 지식 그래프를 구성하고 핵심 인사이트를 도출해 주세요."""


async def graph_structuring_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "graph", "step": 5,
            "message": "데이터 연관성 분석 중..."})

    structured_llm = _llm().with_structured_output(
        GraphStructuringOutput, method="function_calling"
    )
    chain = ChatPromptTemplate.from_messages([
        ("system", _GRAPH_SYSTEM),
        ("human", _GRAPH_HUMAN),
    ]) | structured_llm

    competitors_summary = "\n".join(
        f"- {c.get('name', '')} ({c.get('type', '')}): {c.get('description', '')}"
        for c in state.get("competitors", [])
    )
    research_snippets = "\n".join(
        f"[{r.get('source', '')}] {r.get('title', '')}: {r.get('snippet', '')[:200]}"
        for r in state.get("raw_research", [])[:10]
    )

    try:
        result: GraphStructuringOutput = await chain.ainvoke({
            "product_description": state["product_description"],
            "competitors_summary": competitors_summary,
            "research_snippets": research_snippets,
        })
    except Exception as exc:
        logger.error("Graph structuring node failed: %s", exc)
        writer({"type": "error", "message": str(exc)})
        return {"error": str(exc), "current_stage": "error",
                "knowledge_graph": {}, "graph_insights": []}

    writer({"type": "stage_complete", "node": "graph", "step": 5,
            "message": "지식 그래프 구축 완료"})

    return {
        "knowledge_graph": {
            "nodes": [n.model_dump() for n in result.nodes],
            "edges": [e.model_dump() for e in result.edges],
        },
        "graph_insights": result.insights,
        "current_stage": "graph_complete",
    }


# ──────────────────────────────────────────────────────────────────────
# 6. Reporter Agent
# ──────────────────────────────────────────────────────────────────────

_REPORTER_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.
구조화된 시장 데이터를 바탕으로 사업개발 담당자를 위한 시장 진입 전략 보고서를 작성합니다.

작성 원칙:
- 감정적 표현, 과장 없이 사실과 데이터 중심으로 서술
- 각 항목은 구체적이고 실행 가능한 수준으로 작성
- TAM/SAM/SOM은 현실적인 수치 또는 범위로 추정 (불확실하면 "약 ~" 표현 사용)
- 시장 진입 관점에서 실질적으로 도움이 되는 내용 중심
- 한국어로 명확하게 서술"""

_REPORTER_HUMAN = """분석 데이터 종합:

제품 설명: {product_description}
시장 포지셔닝: {market_positioning}

핵심 경쟁사 (Phase 2):
{competitors_summary}

Graph RAG 인사이트:
{graph_insights}

위 데이터를 바탕으로 시장 진입 전략 보고서를 작성해 주세요.
TAM/SAM/SOM, 시장 성숙도, 진입 장벽, 차별화 포인트, GTM 채널, 첫 고객 확보 전략, 진입 경로, 리스크 시나리오, 전략적 권고사항을 모두 포함해야 합니다."""


async def reporter_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "reporter", "step": 6,
            "message": "최종 보고서 작성 중..."})

    structured_llm = _llm().with_structured_output(ReporterOutput)
    chain = ChatPromptTemplate.from_messages([
        ("system", _REPORTER_SYSTEM),
        ("human", _REPORTER_HUMAN),
    ]) | structured_llm

    competitors_summary = "\n".join(
        f"- {c.get('name', '')} ({c.get('type', '')}): {c.get('description', '')}"
        for c in state.get("competitors", [])
    )
    graph_insights_text = "\n".join(
        f"- {insight}" for insight in state.get("graph_insights", [])
    )

    try:
        result: ReporterOutput = await chain.ainvoke({
            "product_description": state["product_description"],
            "market_positioning": state.get("market_positioning", ""),
            "competitors_summary": competitors_summary,
            "graph_insights": graph_insights_text,
        })
    except Exception as exc:
        logger.error("Reporter node failed: %s", exc)
        writer({"type": "error", "message": str(exc)})
        return {"error": str(exc), "current_stage": "error", "final_report": {}}

    writer({"type": "stage_complete", "node": "reporter", "step": 6,
            "message": "분석 완료"})
    writer({"type": "complete", "message": "마켓 인텔리전스 보고서 생성 완료"})

    return {
        "final_report": result.model_dump(),
        "current_stage": "complete",
    }
