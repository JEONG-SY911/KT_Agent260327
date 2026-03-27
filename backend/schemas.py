"""
Pydantic output schemas for LLM structured output in each agent node.
All fields include Korean-language descriptions to guide the LLM.
"""
from __future__ import annotations

from typing import Literal, Optional

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
            "시장 내 잠재적 경쟁사 최소 5개 이상. "
            "반드시 국내(한국) 기업과 글로벌 기업을 모두 포함하고, "
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
        description="Phase 1 목록 중 가장 위협적인 핵심 경쟁사 2~3곳의 이름"
    )
    selection_rationale: str = Field(
        description="해당 경쟁사를 선정한 이유 요약 (2~3문장)"
    )
    detailed_profiles: list[CompetitorProfile] = Field(
        description="선정된 경쟁사 2~3곳의 심층 분석 프로필"
    )


# ──────────────────────────────────────────────────────────────────────
# Planner Agent
# ──────────────────────────────────────────────────────────────────────

class PlannerOutput(BaseModel):
    search_keywords: list[str] = Field(
        description=(
            "심층 분석을 위한 검색 키워드 4~6개. "
            "반드시 국내 시장 타겟 키워드(한글 포함)와 글로벌 타겟 키워드를 혼합하여 구성하세요."
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

class ReporterOutput(BaseModel):
    executive_summary: str = Field(
        description="시장 진입 관점 핵심 요약 (2~3문장, 가장 중요한 기회와 리스크 중심)"
    )
    # 시장 규모
    market_size_tam: str = Field(
        description="TAM(전체 시장 규모): 해당 산업 전체 시장 크기 및 성장률 (예: 국내 약 2조원, 연 15% 성장)"
    )
    market_size_sam: str = Field(
        description="SAM(유효 시장 규모): 실제 공략 가능한 세그먼트 크기 (예: 중견기업 대상 약 4천억원)"
    )
    market_size_som: str = Field(
        description="SOM(획득 가능 시장): 초기 3년 내 현실적으로 획득 가능한 규모 (예: 약 200~400억원)"
    )
    market_maturity: Literal["도입기", "성장기", "성숙기", "쇠퇴기"] = Field(
        description="시장 성숙도 단계: 도입기/성장기/성숙기/쇠퇴기 중 하나"
    )
    # 진입 장벽
    entry_barriers: list[str] = Field(
        description="시장 진입 장벽 3~5개 (규제, 초기 투자, 전환 비용, 기술/특허 등)"
    )
    # 차별화
    differentiation_points: list[str] = Field(
        description="경쟁사 약점 기반 차별화 포인트 3~5개 (우리가 파고들 수 있는 틈새)"
    )
    # Go-to-Market
    gtm_channels: list[str] = Field(
        description="권장 유통/판매 채널 2~3개 (경쟁사 채널 분석 기반)"
    )
    first_customer_hint: str = Field(
        description="첫 고객 확보 전략: 초기 타겟 고객 세그먼트와 레퍼런스 확보 방법 (2~3문장)"
    )
    entry_route: str = Field(
        description="권장 진입 경로: 자체 개발 / 파트너십 / M&A 중 선택 및 이유 (2~3문장)"
    )
    # 리스크
    risk_scenarios: list[str] = Field(
        description="진입 후 리스크 시나리오 2~3개 (경쟁사 대응, 시장 변화, 피벗 옵션 포함)"
    )
    # 액션 플랜
    strategic_recommendations: list[str] = Field(
        description="우선순위 순 실행 가능한 전략적 권고사항 3~5개"
    )
