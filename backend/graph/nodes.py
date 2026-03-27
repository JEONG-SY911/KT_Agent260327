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

import asyncio
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
분석 의뢰자는 KT(케이티) 소속 직원입니다. KT는 경쟁사에서 반드시 제외하십시오.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[분석 컨텍스트: KT GPU IaaS 상품]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KT는 GPU를 IaaS(Infrastructure as a Service) 형태로 국내 엔터프라이즈 및 SMB 고객군에 판매하는 상품을 출시하고자 합니다.
분석 대상: 대한민국 국내 기업만. 해외·글로벌 기업(AWS, Azure, Google 등) 완전 제외. KT(KT Cloud 포함) 제외.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[경쟁사 유형 분류 기준 — GPU IaaS 특화]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ▶ direct (주요 경쟁사):
    현재 이미 GPU를 IaaS 방식(온디맨드/구독/종량제)으로 국내 기업 고객에게 제공 중인 기업.
    실제 GPU 클라우드 서비스를 운영 중이어야 함.
    예시 후보: 네이버클라우드(GPU 클라우드), NHN클라우드(GPU 서버), SKT T클라우드비즈,
              카카오클라우드, 가비아, iwinv(인터넷나야나) 등

  ▶ indirect (잠재적 경쟁사):
    현재 GPU IaaS 상품은 없으나, 보유한 인프라·클라우드·SI 역량으로 향후 GPU IaaS 시장 진입이
    가능한 기업. 엔터프라이즈·SMB 고객군을 이미 보유하고 있어 진입 시 즉각적 위협이 될 수 있음.
    예시 후보: 삼성SDS, LG CNS, SK C&C, 롯데정보통신, 현대오토에버, LG유플러스 기업솔루션 등

  ▶ adjacent (인접 시장):
    GPU IaaS와 직접 경쟁하지 않지만 대체재 또는 연관 시장에 존재하는 기업.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Phase 1 시장 스캔 요구사항]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 국내 기업만, KT 제외, 최소 7개 이상 도출 (direct 최소 3개, indirect 최소 3개)
- 각 기업의 GPU IaaS 상품 보유 여부, 예상 시장 점유율, 투자 현황, 설립 연도 포함
- relevance_score(경쟁 위협도 1-10)를 기준으로 내림차순 정렬
- description에 GPU IaaS 상품명 또는 진입 가능성 근거를 반드시 포함

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
분석 의뢰자는 KT(케이티) 소속 직원입니다. KT GPU IaaS 상품의 국내 경쟁 환경을 두 그룹으로 분리 분석합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 1: GPU IaaS 보유 여부 재검증]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1 목록에서 각 후보의 GPU IaaS 상품 실제 보유 여부를 재확인합니다.
  - direct: 현재 실제로 GPU IaaS 서비스를 운영 중인 기업
  - indirect: GPU IaaS는 없지만 향후 진입 가능한 잠재적 경쟁사
  - KT(KT Cloud 포함) 및 해외 기업은 무조건 제외

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 2: 두 그룹으로 분리 선정 — 총 5곳]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ 그룹 A — 주요 경쟁사 (type=direct): 정확히 3곳
  현재 GPU IaaS를 실제 제공 중인 국내 기업 중 KT에 가장 위협적인 3곳 선정.
  [선정 기준]
  1. GPU IaaS 서비스 실제 운영 여부 (필수)
  2. 엔터프라이즈·SMB 고객 확보 규모
  3. GPU 자원 규모 및 서비스 안정성
  4. 가격 경쟁력 및 국내 시장 점유율

▶ 그룹 B — 잠재적 경쟁사 (type=indirect): 정확히 2곳
  현재 GPU IaaS는 없지만 인프라·클라우드·SI 역량으로 단기~중기 내 시장 진입이 유력한 기업.
  [선정 기준]
  1. 기존 엔터프라이즈 고객 기반 (즉시 전환 위협)
  2. 데이터센터·서버 인프라 보유 여부
  3. AI·클라우드 사업 전략 방향
  4. 자본력 및 투자 의지

[심층 프로필 작성 지침]
- key_products: 기존 보유 클라우드/인프라 제품명 또는 GPU IaaS 상품명 (추측 금지)
- strengths: KT GPU IaaS 대비 위협이 되는 강점
- weaknesses: KT가 차별화할 수 있는 기회 포인트
- estimated_market_position: GPU IaaS 시장 내 현재 또는 예상 포지션"""

_COMPETITOR_SELECT_HUMAN = """KT 제품: GPU를 IaaS 형태로 국내 엔터프라이즈·SMB 고객에게 제공하는 서비스
제품 추가 설명: {product_description}

Phase 1 경쟁사 목록 (relevance_score 내림차순):
{phase1_summary}

위 목록에서 아래 두 그룹으로 분리하여 총 5곳을 선정하고 심층 분석 프로필을 작성해 주세요.
- 그룹 A (type=direct): 이미 GPU IaaS 보유한 주요 경쟁사 정확히 3곳
- 그룹 B (type=indirect): 향후 진입 가능한 잠재적 경쟁사 정확히 2곳"""


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
KT GPU IaaS 상품의 국내 경쟁 환경을 심층 분석하기 위한 검색 키워드를 도출합니다.
분석 의뢰자는 KT(케이티) 소속 직원이며, 국내 기업만 대상입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[국내 GPU IaaS 시장 탐색 전용]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
모든 키워드는 국내(한국) GPU IaaS 시장 탐색에 집중합니다.
해외 기업(AWS, Azure, Google 등) 관련 키워드는 생성하지 않습니다.

키워드는 아래 두 그룹을 균형 있게 탐색해야 합니다:

  [주요 경쟁사 탐색] — 이미 GPU IaaS 운영 중인 국내 기업
    네이버클라우드 GPU 서비스, NHN클라우드 GPU, SKT T클라우드비즈 GPU,
    카카오클라우드 GPU, 국내 GPU 클라우드 서비스 현황, 국내 AI 인프라 IaaS

  [잠재적 경쟁사 탐색] — GPU IaaS 진입 가능한 국내 SI·인프라 기업
    삼성SDS LG CNS SK C&C GPU 클라우드 신사업, 국내 SI 기업 AI 인프라 전략,
    대기업 IT 서비스사 GPU 클라우드 진출 계획

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[키워드 구성 원칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 전체를 국내 시장 한글 키워드로만 구성합니다.
- 엔터프라이즈·SMB 고객 관점의 GPU IaaS 채택 동향도 포함합니다.
- KT 관점에서 위협이 되는 경쟁사의 GPU 전략·신사업·가격 정책 탐색에 초점을 맞춥니다.

총 4~6개의 키워드를 도출하세요."""

_PLANNER_HUMAN = """KT 제품: GPU IaaS (국내 엔터프라이즈·SMB 대상)
추가 설명: {product_description}

선정된 경쟁사 목록 (주요 경쟁사 + 잠재적 경쟁사):
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

# 플래너 키워드와 무관하게 항상 실행되는 국내 통신·SI 기업 탐색 쿼리 (KT 제외)
_DOMESTIC_TELCO_SI_QUERY = (
    "국내 클라우드 통신사 SI 대기업 엔터프라이즈 서비스 "
    "SKT 삼성SDS LG CNS 네이버클라우드 카카오클라우드 시장 점유율"
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
    so search results are relevant to the specific market segment. KT excluded.
    """
    known_names = " ".join(
        c.get("name", "") for c in competitors[:2]
        if c.get("name") and "kt" not in c.get("name", "").lower()
    ).strip()
    if known_names:
        return f"한국 B2B 엔터프라이즈 국내 경쟁사 {known_names} 통신사 SI 시장 2024"
    return "한국 B2B 엔터프라이즈 국내 클라우드 솔루션 경쟁사 통신사 SI 시장 2024"


async def researcher_node(state: AgentState, writer: StreamWriter) -> dict[str, Any]:
    writer({"type": "stage_start", "node": "researcher", "step": 4,
            "message": "데이터 수집 및 크롤링 중..."})

    keywords = state.get("search_keywords", [])
    domestic_queries = [
        _DOMESTIC_TELCO_SI_QUERY,
        _build_domestic_b2b_query(state.get("competitors", [])),
    ]

    writer({"type": "searching", "node": "researcher", "step": 4,
            "message": f"총 {len(keywords) + len(domestic_queries)}개 키워드 병렬 검색 중..."})

    # ── (A) Planner keywords — 병렬 실행 ─────────────────────────────
    async def _search_keyword(keyword: str) -> list[dict]:
        enhanced = _enhance_korean_query(keyword)
        results = await search_web_async(enhanced, max_results=3)
        for r in results:
            r["keyword"] = keyword
        return results

    # ── (B) Mandatory domestic searches — 병렬 실행 ──────────────────
    async def _search_domestic(query: str) -> list[dict]:
        results = await search_web_async(query, max_results=3)
        for r in results:
            r["keyword"] = query
            r["market_scope"] = "domestic_kr"
        return results

    # 전체 검색을 동시에 실행
    keyword_tasks  = [_search_keyword(kw) for kw in keywords]
    domestic_tasks = [_search_domestic(q) for q in domestic_queries]

    all_batches = await asyncio.gather(*keyword_tasks, *domestic_tasks, return_exceptions=True)

    all_results: list[dict] = []
    for batch in all_batches:
        if isinstance(batch, list):
            all_results.extend(batch)

    writer({"type": "stage_complete", "node": "researcher", "step": 4,
            "message": f"자료 수집 완료 ({len(all_results)}건)"})

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
구조화된 시장 데이터를 바탕으로 KT GPU IaaS 상품의 국내 경쟁 전략 마켓 인텔리전스 보고서를 작성합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[보고서 작성 원칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 감정적 표현·과장 없이 사실과 데이터 중심으로 서술
- 경쟁사를 두 그룹으로 명확히 구분:
    주요 경쟁사(direct, 3곳): GPU IaaS 실제 보유 → 즉각적 대응 전략
    잠재적 경쟁사(indirect, 2곳): 향후 진입 가능 → 선제적 방어 전략
- swot_analysis: KT GPU IaaS 관점 SWOT 사분면 — 각 항목에 핵심 키워드 1개(명사, 5자 이내) + 분석 항목 3~4개
- 한국어로 명확하게 서술

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[직급별 인사이트 작성 기준 — persona_sections 필수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KT 조직 내 아래 6개 직급 모두에 대해 각각 맞춤형 인사이트를 작성하세요.
각 직급의 업무 범위·의사결정 권한·시간 지평(time horizon)에 맞게 차별화합니다.

① 직원 (실무자)
   - 시간 지평: 즉시~3개월
   - 관점: 경쟁사 제품·기술 동향 파악, 고객 응대 및 영업 현장 활용
   - 인사이트: 경쟁사 제품 대비 KT GPU IaaS의 구체적 차별점, 고객 질문 대응 포인트
   - 액션: 현업에서 즉시 활용 가능한 실무 수준 행동

② 팀장 (팀 리더)
   - 시간 지평: 1~6개월
   - 관점: 팀 실행 계획 수립, 팀원 역할 배분, 단기 KPI 달성
   - 인사이트: 경쟁사 공략 세그먼트·채널 분석, 팀 역량 강화 포인트
   - 액션: 팀 단위 실행 가능한 구체적 과제 (예: 경쟁사 분석 워크숍, 영업 스크립트 개발)

③ 담당상무 (사업부장급)
   - 시간 지평: 3~12개월
   - 관점: 사업부 전략, 분기별 목표 달성, 예산·인력 배분 결정
   - 인사이트: 시장 점유율 변동 리스크, 경쟁사 대응을 위한 투자 우선순위
   - 액션: 사업부 전략 조정, 예산 재배분, 파트너십 구축 방향

④ 본부장 (본부 단위 리더)
   - 시간 지평: 6개월~2년
   - 관점: 본부 포지셔닝, 타 본부와 협력, 중기 시장 전략
   - 인사이트: 국내 GPU IaaS 시장 구조 변화, 본부 차원의 경쟁 우위 확보 방향
   - 액션: 본부 중기 전략 수립, 조직 간 협업 과제, 핵심 역량 투자 결정

⑤ 부문장 (사업 부문 총괄)
   - 시간 지평: 1~3년
   - 관점: 부문 포트폴리오 전략, 신사업 투자 판단, 시장 리더십 확보
   - 인사이트: GPU IaaS 시장 성장성과 KT의 포지셔닝 기회, M&A·파트너십 가능성
   - 액션: 중장기 투자 결정, 포트폴리오 조정, 시장 선점 전략 수립

⑥ 대표이사 (CEO)
   - 시간 지평: 3~5년
   - 관점: 기업 전략, 이사회 보고, 장기 시장 리더십 및 기업 가치
   - 인사이트: KT가 국내 GPU IaaS 시장에서 장기 리더십을 확보하기 위한 핵심 전략 방향
   - 액션: 이사회·주주 소통 메시지, 전사 전략 방향 결정, 장기 투자 어젠다"""

_REPORTER_HUMAN = """분석 데이터 종합:

제품: KT GPU IaaS (국내 엔터프라이즈·SMB 대상)
추가 설명: {product_description}
시장 포지셔닝: {market_positioning}

핵심 경쟁사 (Phase 2 — 주요 3곳 + 잠재 2곳):
{competitors_summary}

Graph RAG 인사이트:
{graph_insights}

위 데이터를 바탕으로 최종 마켓 인텔리전스 보고서를 작성하세요.
반드시 아래 두 항목을 포함해야 합니다:
1. swot_analysis: S/W/O/T 각 사분면에 핵심 키워드 1개 + 분석 항목 3~4개
2. persona_sections: 직원/팀장/담당상무/본부장/부문장/대표이사 6개 직급 모두"""


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
