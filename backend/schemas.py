"""
Pydantic output schemas for LLM structured output in each agent node.
All fields include Korean-language descriptions to guide the LLM.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────────────
# Phase 1: Market Scan (5+ competitors, lightweight metadata)
# ──────────────────────────────────────────────────────────────────────

class Phase1CompetitorItem(BaseModel):
    name: str = Field(description="회사명 (한글 또는 영문 공식명)")
    type: Literal["direct", "indirect", "adjacent"] = Field(
        description=(
            "경쟁사 유형: 직접(direct) / 간접·대체재(indirect) / "
            "인접 시장(adjacent)"
        )
    )
    description: str = Field(description="회사 및 핵심 제품 한 줄 설명")
    website: str = Field(default="", description="공식 웹사이트 URL")
    market_share_estimate: str = Field(
        default="", description="국내 또는 글로벌 예상 시장 점유율 (예: 약 12%, 상위 3위권)"
    )
    funding_info: str = Field(
        default="", description="투자 현황 (예: Series B $30M, 상장사, 비공개)"
    )
    founded_year: str = Field(default="", description="설립 연도 (예: 2018)")
    relevance_score: int = Field(
        description="사용자 제품 대비 경쟁 위협도 1(낮음)~10(높음). "
                    "타겟 고객 겹침·기능 유사성·시장 영향력을 종합 평가."
    )


class MarketScanOutput(BaseModel):
    is_valid_input: bool = Field(
        description="입력 내용이 시장 분석에 충분한지 여부. "
                    "제품 카테고리, 타겟 고객, 핵심 기능 중 최소 2가지가 언급되면 true."
    )
    fallback_message: str = Field(
        default="",
        description="is_valid_input=false 일 때 사용자에게 전달할 안내 메시지",
    )
    market_overview: str = Field(
        default="",
        description="시장 전반 개요 (2~3문장). 시장 규모, 성장률, 주요 트렌드 포함.",
    )
    phase1_competitors: list[Phase1CompetitorItem] = Field(
        default_factory=list,
        description=(
            "대한민국 국내 기업만 포함한 잠재적 경쟁사 최소 5개 이상. "
            "해외·글로벌 기업 및 KT(KT Cloud 포함)는 반드시 제외하고, "
            "relevance_score 내림차순으로 정렬하세요."
        ),
    )


# ──────────────────────────────────────────────────────────────────────
# Phase 2: Competitor Selection + Deep Profile (2-3 selected companies)
# ──────────────────────────────────────────────────────────────────────

class CompetitorProfile(BaseModel):
    name: str = Field(description="회사명")
    type: Literal["direct", "indirect"] = Field(
        description="경쟁사 유형: 직접(direct) 또는 간접/대체재(indirect)"
    )
    description: str = Field(description="회사 및 제품/서비스 상세 설명 (2~3문장)")
    website: str = Field(default="", description="공식 웹사이트 URL")
    key_products: list[str] = Field(
        default_factory=list, description="핵심 제품/서비스 목록 (2~3개)"
    )
    strengths: list[str] = Field(
        default_factory=list, description="주요 경쟁 강점 (2~3개)"
    )
    weaknesses: list[str] = Field(
        default_factory=list, description="주요 경쟁 약점 — 사용자 제품의 차별화 기회 (2~3개)"
    )
    estimated_market_position: str = Field(
        default="", description="시장 내 포지션 요약 (한 문장)"
    )


class CompetitorSelectionOutput(BaseModel):
    market_positioning: str = Field(
        description="사용자 제품의 시장 내 포지셔닝 상세 분석 (3~5문장)"
    )
    selected_names: list[str] = Field(
        description=(
            "선정된 경쟁사 이름 목록 (총 5곳). "
            "주요 경쟁사(direct, GPU IaaS 이미 보유) 3곳 + 잠재적 경쟁사(indirect, 향후 진입 가능) 2곳. "
            "KT(KT Cloud 포함) 및 해외 기업 제외."
        )
    )
    selection_rationale: str = Field(
        description="두 그룹 각각의 선정 이유 요약 (주요 경쟁사 3곳 / 잠재적 경쟁사 2곳, KT 관점)"
    )
    detailed_profiles: list[CompetitorProfile] = Field(
        description=(
            "선정된 경쟁사 총 5곳의 심층 분석 프로필. "
            "type=direct인 주요 경쟁사 3곳(GPU IaaS 실제 운영 중)과 "
            "type=indirect인 잠재적 경쟁사 2곳(향후 진입 가능)으로 구성."
        )
    )


# ──────────────────────────────────────────────────────────────────────
# Planner Agent
# ──────────────────────────────────────────────────────────────────────

class PlannerOutput(BaseModel):
    search_keywords: list[str] = Field(
        description=(
            "국내 시장 심층 분석을 위한 검색 키워드 4~6개. "
            "전체를 국내(한국) 시장 타겟 한글 키워드로만 구성하고, "
            "해외 기업(AWS, Azure 등) 관련 키워드는 포함하지 않습니다. "
            "KT 관점에서 위협적인 국내 경쟁사의 전략·점유율 변화에 초점을 맞추세요."
        )
    )
    analysis_rationale: str = Field(
        description="키워드 선정 이유 및 분석 방향 요약 (2~3문장)"
    )


# ──────────────────────────────────────────────────────────────────────
# Graph Structuring Agent
# ──────────────────────────────────────────────────────────────────────

class GraphNodeItem(BaseModel):
    id: str = Field(description="노드 고유 ID (소문자 snake_case, 예: comp_salesforce)")
    type: Literal["company", "product", "trend", "threat"] = Field(
        description="노드 유형: company(기업), product(제품), trend(시장 트렌드), threat(위협 요소)"
    )
    label: str = Field(description="노드 표시명")
    description: str = Field(description="노드에 대한 한 줄 설명")


class GraphEdgeItem(BaseModel):
    source: str = Field(description="출발 노드 ID")
    target: str = Field(description="도착 노드 ID")
    relation: str = Field(
        description="관계 유형 (예: competes_with, leverages, threatens, offers, targets, disrupts)"
    )


class GraphStructuringOutput(BaseModel):
    nodes: list[GraphNodeItem] = Field(
        description="지식 그래프 노드 목록 (최소 6개, 최대 12개)"
    )
    edges: list[GraphEdgeItem] = Field(
        description="노드 간 관계 엣지 목록 (최소 5개)"
    )
    insights: list[str] = Field(
        description="그래프 구조에서 도출된 핵심 인사이트 3~5개 (각 항목은 한 문장)"
    )


# ──────────────────────────────────────────────────────────────────────
# Reporter Agent
# ──────────────────────────────────────────────────────────────────────

class SwotQuadrant(BaseModel):
    keyword: str = Field(
        description="해당 사분면을 대표하는 핵심 키워드 1개 (명사형, 5자 이내 간결하게)"
    )
    points: list[str] = Field(
        description="해당 사분면의 구체적 분석 항목 3~4개. KT GPU IaaS 관점에서 작성."
    )


class SwotAnalysis(BaseModel):
    strengths: SwotQuadrant = Field(
        description="강점(S): KT GPU IaaS가 보유한 내부 경쟁 우위 요소. keyword는 가장 핵심적인 강점 단어."
    )
    weaknesses: SwotQuadrant = Field(
        description="약점(W): KT GPU IaaS의 내부 한계 또는 보완이 필요한 요소. keyword는 가장 핵심적인 약점 단어."
    )
    opportunities: SwotQuadrant = Field(
        description="기회(O): 외부 환경에서 KT GPU IaaS가 활용할 수 있는 시장 기회. keyword는 가장 핵심적인 기회 단어."
    )
    threats: SwotQuadrant = Field(
        description="위협(T): 외부 환경에서 KT GPU IaaS에 불리하게 작용하는 요소. keyword는 가장 핵심적인 위협 단어."
    )


class PersonaSection(BaseModel):
    persona: str = Field(
        description="직급명. 반드시 아래 6개 중 하나: 직원 / 팀장 / 담당상무 / 본부장 / 부문장 / 대표이사"
    )
    focus: str = Field(
        description="해당 직급의 분석 초점을 한 문장으로 요약 (예: '실무 경쟁사 대응 및 제품 차별화 포인트')"
    )
    key_insights: list[str] = Field(
        description="해당 직급에게 가장 중요한 핵심 인사이트 2~3개. 직급 수준에 맞는 시각과 언어로 서술."
    )
    action_items: list[str] = Field(
        description="해당 직급이 즉시 또는 단기 내 취해야 할 구체적 액션 아이템 2~3개."
    )


class ReporterOutput(BaseModel):
    executive_summary: str = Field(
        description="전체 분석 요약 (3~5문장, C레벨 의사결정자 대상, 핵심만 직설적으로)"
    )
    positioning_summary: str = Field(
        description="KT GPU IaaS의 시장 내 포지셔닝 상세 분석 (3~5문장)"
    )
    market_opportunities: list[str] = Field(
        description="시장 기회 요소 3~5개 (각 항목은 구체적인 근거와 함께)"
    )
    threat_factors: list[str] = Field(
        description="위협 요소 및 리스크 3~5개 (각 항목은 구체적인 근거와 함께)"
    )
    strategic_recommendations: list[str] = Field(
        description="실행 가능한 전략적 권고사항 3~5개 (우선순위 순, 주요/잠재 경쟁사 대응 각각 포함)"
    )
    competitive_analysis_summary: str = Field(
        description="주요 경쟁사(direct 3곳)와 잠재적 경쟁사(indirect 2곳) 비교 종합 분석 (3~4문장)"
    )
    swot_analysis: SwotAnalysis = Field(
        description=(
            "KT GPU IaaS 관점의 SWOT 분석 사분면. "
            "강점(S)·약점(W)·기회(O)·위협(T) 각각에 핵심 키워드 1개와 분석 항목 3~4개를 작성."
        )
    )
    persona_sections: list[PersonaSection] = Field(
        description=(
            "KT 내 직급별 맞춤형 인사이트 섹션. "
            "반드시 아래 순서로 6개를 모두 생성하세요: "
            "직원, 팀장, 담당상무, 본부장, 부문장, 대표이사. "
            "각 직급의 업무 관점·의사결정 범위·시간 지평(horizon)에 맞춰 인사이트와 액션을 차별화하세요."
        )
    )
