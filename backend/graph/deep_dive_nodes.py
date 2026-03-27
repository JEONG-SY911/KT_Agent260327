"""
LangGraph node functions for the deep-dive focused analysis workflow.

Two nodes:
  1. targeted_researcher_node  - runs high-density targeted queries per company
  2. report_generator_node     - synthesises into single SWOT report or comparison table
"""
from __future__ import annotations

import logging
import os
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.types import StreamWriter

from backend.graph.deep_dive_state import DeepDiveState
from backend.schemas import ComparisonReport, SingleDeepDiveReport
from backend.tools.search import enrich_results_with_full_text, search_web_async

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Shared helper
# ──────────────────────────────────────────────────────────────────────

def _llm(temperature: float = 0) -> ChatOpenAI:
    return ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4o-mini"),
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=temperature,
    )


# ──────────────────────────────────────────────────────────────────────
# 1. Targeted Researcher Node
# ──────────────────────────────────────────────────────────────────────

# Four query dimensions that maximise information density per company.
# Using a template so each company gets its own targeted searches.
_QUERY_TEMPLATES = [
    "{company} 재무 현황 매출 영업이익 시장 점유율 2024 2025",
    "{company} 핵심 서비스 기술 스택 주요 제품 기능 상세",
    "{company} 최근 뉴스 신사업 파트너십 투자 2024 2025",
    "{company} 고객 평가 후기 불만 사례 경쟁 약점",
]


async def targeted_researcher_node(
    state: DeepDiveState, writer: StreamWriter
) -> dict[str, Any]:
    writer({
        "type": "stage_start", "node": "targeted_researcher", "step": 1,
        "message": "선택된 기업 타겟 데이터 수집 중...",
    })

    all_results: list[dict] = []

    for company in state["company_names"]:
        for template in _QUERY_TEMPLATES:
            query = template.format(company=company)
            writer({
                "type": "searching", "node": "targeted_researcher", "step": 1,
                "message": f"{company} — {query[:28]}...",
            })
            results = await search_web_async(query, max_results=3)
            for r in results:
                r["keyword"] = query
                r["target_company"] = company
            all_results.extend(results)

    # Deep reading: fetch full-text for top URLs (more pages than main pipeline
    # because deep-dive analysis benefits from maximum information density)
    writer({
        "type": "searching", "node": "targeted_researcher", "step": 1,
        "message": "수집된 페이지 딥 리딩 중...",
    })
    all_results = await enrich_results_with_full_text(all_results, max_pages=8)

    writer({
        "type": "stage_complete", "node": "targeted_researcher", "step": 1,
        "message": f"타겟 데이터 {len(all_results)}건 수집 및 딥 리딩 완료",
    })

    return {"raw_research": all_results, "current_stage": "research_complete"}


# ──────────────────────────────────────────────────────────────────────
# 2. Report Generator Node  (branches on mode)
# ──────────────────────────────────────────────────────────────────────

_SINGLE_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.
수집된 검색 데이터를 최대한 활용하여 특정 기업에 대한 심층 분석 보고서를 작성합니다.

작성 원칙:
- 수집된 실제 데이터와 사실에 기반하여 서술 (일반론 금지)
- SWOT 분석은 사용자 제품 관점에서 해당 기업이 어떤 위협/기회를 주는지로 서술
- 고객 불만 항목은 수집된 리뷰·뉴스 데이터를 참고하여 구체적으로 작성
- 추측이 불가피하면 "추정" 또는 "공개 정보 없음"으로 명시
- 한국어로 명확하게 서술, 이모티콘 사용 금지"""

_SINGLE_HUMAN = """분석 대상 기업: {company_name}
사용자 제품/서비스: {product_description}

수집된 데이터:
{research_snippets}

위 데이터를 바탕으로 {company_name}에 대한 심층 분석 보고서를 작성해 주세요."""


_COMPARISON_SYSTEM = """당신은 냉철하고 객관적인 시니어 전략 컨설턴트입니다.
수집된 데이터를 기반으로 여러 기업을 항목별로 비교 분석하는 보고서를 작성합니다.

작성 원칙:
- 각 기업의 실제 서비스·제품명을 구체적으로 언급
- 가격 정책은 공개 정보 기준; 알 수 없으면 "비공개/문의" 명시
- 사용자 제품 관점에서 각 경쟁사의 위협도와 차별화 포인트를 서술
- 모든 기업에 대해 동일한 항목 기준으로 작성 (비교 가능성 확보)
- 한국어로 명확하게 서술, 이모티콘 사용 금지"""

_COMPARISON_HUMAN = """비교 대상 기업: {company_names}
사용자 제품/서비스: {product_description}

수집된 데이터:
{research_snippets}

위 데이터를 바탕으로 선택된 기업들에 대한 비교 분석 보고서를 작성해 주세요."""


async def report_generator_node(
    state: DeepDiveState, writer: StreamWriter
) -> dict[str, Any]:
    mode = state["mode"]
    writer({
        "type": "stage_start", "node": "report_generator", "step": 2,
        "message": "심층 분석 보고서 작성 중...",
    })

    research_snippets = "\n".join(
        "[{co}][{src}] {title}: {body}".format(
            co=r.get("target_company", ""),
            src=r.get("source", ""),
            title=r.get("title", ""),
            body=(r.get("full_text") or r.get("snippet", ""))[:500],
        )
        for r in state.get("raw_research", [])[:20]
    )

    try:
        if mode == "single":
            structured_llm = _llm().with_structured_output(SingleDeepDiveReport)
            chain = ChatPromptTemplate.from_messages([
                ("system", _SINGLE_SYSTEM),
                ("human", _SINGLE_HUMAN),
            ]) | structured_llm

            result: SingleDeepDiveReport = await chain.ainvoke({
                "company_name": state["company_names"][0],
                "product_description": state["product_description"],
                "research_snippets": research_snippets,
            })

            writer({
                "type": "stage_complete", "node": "report_generator", "step": 2,
                "message": "심층 분석 보고서 완성",
            })
            writer({"type": "complete", "message": "심층 분석 완료"})

            return {
                "single_report": result.model_dump(),
                "comparison_report": {},
                "current_stage": "complete",
            }

        else:  # comparison
            structured_llm = _llm().with_structured_output(ComparisonReport)
            chain = ChatPromptTemplate.from_messages([
                ("system", _COMPARISON_SYSTEM),
                ("human", _COMPARISON_HUMAN),
            ]) | structured_llm

            result: ComparisonReport = await chain.ainvoke({
                "company_names": ", ".join(state["company_names"]),
                "product_description": state["product_description"],
                "research_snippets": research_snippets,
            })

            writer({
                "type": "stage_complete", "node": "report_generator", "step": 2,
                "message": "비교 분석 보고서 완성",
            })
            writer({"type": "complete", "message": "비교 분석 완료"})

            return {
                "single_report": {},
                "comparison_report": result.model_dump(),
                "current_stage": "complete",
            }

    except Exception as exc:
        logger.error("Report generator node failed: %s", exc)
        writer({"type": "error", "message": str(exc)})
        return {
            "error": str(exc), "current_stage": "error",
            "single_report": {}, "comparison_report": {},
        }
