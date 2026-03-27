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
    positioning_summary: str = Field(
        description="사용자 제품의 시장 내 포지셔닝 상세 분석 (3~5문장)"
    )
    competitive_analysis_summary: str = Field(
        description="경쟁 환경 종합 분석 (2~3문장)"
    )
    market_opportunities: list[str] = Field(
        description="시장 기회 요소 3~5개 (각 항목은 구체적인 근거와 함께)"
    )
    threat_factors: list[str] = Field(
        description="위협 요소 및 리스크 3~5개 (각 항목은 구체적인 근거와 함께)"
    )
    strategic_recommendations: list[str] = Field(
        description="우선순위 순 실행 가능한 전략적 권고사항 3~5개"
    )
    # ── 시장 규모 ──────────────────────────────────────────────────
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
    # ── 진입 장벽 / 차별화 ─────────────────────────────────────────
    entry_barriers: list[str] = Field(
        description="시장 진입 장벽 3~5개 (규제, 초기 투자, 전환 비용, 기술/특허 등)"
    )
    differentiation_points: list[str] = Field(
        description="경쟁사 약점 기반 차별화 포인트 3~5개 (우리가 파고들 수 있는 틈새)"
    )
    # ── Go-to-Market ───────────────────────────────────────────────
    gtm_channels: list[str] = Field(
        description="권장 유통/판매 채널 2~3개 (경쟁사 채널 분석 기반)"
    )
    first_customer_hint: str = Field(
        description="첫 고객 확보 전략: 초기 타겟 고객 세그먼트와 레퍼런스 확보 방법 (2~3문장)"
    )
    entry_route: str = Field(
        description="권장 진입 경로: 자체 개발 / 파트너십 / M&A 중 선택 및 이유 (2~3문장)"
    )
    # ── 리스크 ────────────────────────────────────────────────────
    risk_scenarios: list[str] = Field(
        description="진입 후 리스크 시나리오 2~3개 (경쟁사 대응, 시장 변화, 피벗 옵션 포함)"
    )


# ──────────────────────────────────────────────────────────────────────
# Deep-Dive Agent schemas
# ──────────────────────────────────────────────────────────────────────

class SWOTItem(BaseModel):
    strengths: list[str] = Field(description="강점 2~4개")
    weaknesses: list[str] = Field(description="약점 2~4개")
    opportunities: list[str] = Field(description="기회 요소 2~4개 (사용자 제품 관점에서 공략 가능한 영역)")
    threats: list[str] = Field(description="위협 요소 2~4개 (사용자 제품이 받는 경쟁 위협)")


class SingleDeepDiveReport(BaseModel):
    company_name: str = Field(description="분석 대상 기업명")
    business_model_detail: str = Field(
        description="비즈니스 모델 상세 설명 (수익 구조, 고객 세그먼트, 가격 정책 포함, 3~5문장)"
    )
    core_technology: str = Field(
        description="핵심 기술력 및 기술 스택 요약 (2~3문장)"
    )
    key_products: list[str] = Field(
        description="주요 제품/서비스 목록 2~4개"
    )
    swot: SWOTItem = Field(description="SWOT 분석 (사용자 제품과의 경쟁 관계 관점)")
    recent_highlights: list[str] = Field(
        description="최근 1년 주요 이슈 (신제품, 파트너십, 투자, 인수 등) 2~4개"
    )
    customer_pain_points: list[str] = Field(
        description="수집된 고객 불만 및 경쟁 약점 2~4개"
    )


class ComparisonEntry(BaseModel):
    company_name: str = Field(description="기업명")
    core_service: str = Field(description="핵심 서비스 한 줄 요약")
    target_customer: str = Field(description="주요 타겟 고객 세그먼트")
    pricing_model: str = Field(description="가격 정책 (공개 정보 기준; 알 수 없으면 '비공개/문의')")
    market_position: str = Field(description="시장 내 포지션 요약 (한 문장)")
    top_strength: str = Field(description="경쟁 측면 핵심 강점 1개")
    top_weakness: str = Field(description="경쟁 측면 핵심 약점 1개")


class ComparisonReport(BaseModel):
    entries: list[ComparisonEntry] = Field(description="기업별 비교 항목 (선택된 기업 수만큼)")
    summary: str = Field(description="비교 분석 종합 인사이트 (3~5문장, 사용자 제품의 포지셔닝 시사점 포함)")


# ──────────────────────────────────────────────────────────────────────
# Intelligence Agent schemas  (Step 7 — pricing, spec, executive summary)
# ──────────────────────────────────────────────────────────────────────

class PricingEntry(BaseModel):
    competitor_name: str = Field(description="경쟁사 기업명")
    explicit_price: str = Field(
        description=(
            "공개된 명시적 가격 정보 (예: '월 $2,000/GPU 노드', 'vCPU당 $0.05/hr'). "
            "공개 정보가 없으면 '비공개 — 협상 기반'으로 작성."
        )
    )
    price_vs_market_avg: str = Field(
        description=(
            "해당 시장의 평균가 대비 포지셔닝 서술 "
            "(예: '시장 평균 대비 약 15% 저렴 (추정)', '프리미엄 포지션 — 평균 대비 30% 이상'). "
            "추정인 경우 반드시 '(추정)' 명시."
        )
    )
    pricing_model: str = Field(
        description="가격 모델 분류: '종량제', '구독형(월정액)', '구독형(연정액)', '협상형', '프리미엄 협상형' 중 하나"
    )
    active_promotions: str = Field(
        description=(
            "현재 진행 중인 프로모션 또는 할인 정보. "
            "없으면 '없음', 있으면 내용과 할인율/기간 포함."
        )
    )
    price_tier: Literal["low", "medium", "high", "premium"] = Field(
        description=(
            "UI 시각화용 가격 등급: "
            "low=저가형, medium=중가형, high=고가형, premium=프리미엄"
        )
    )


class PricingIntelligenceOutput(BaseModel):
    entries: list[PricingEntry] = Field(description="경쟁사별 가격 정보 항목")
    market_avg_estimate: str = Field(
        description="해당 시장 전반의 가격대 서술 (예: '국내 GPU 클라우드 시장 평균 월 $1,500~$3,000 수준')"
    )
    our_price_positioning: str = Field(
        description=(
            "당사 가격 정보가 입력된 경우 경쟁 포지셔닝 분석, "
            "없는 경우 수집된 시장 정보 기반 권장 포지셔닝 방향 (1~2문장)"
        )
    )


class CompetitorSpecValue(BaseModel):
    competitor_name: str = Field(description="경쟁사 기업명")
    value: str = Field(description="해당 스펙 값. 공개 정보 없으면 '미공개'.")


class SpecRow(BaseModel):
    spec_name: str = Field(description="스펙 항목명 (예: GPU 모델, 메모리, 인프라 리전, 최소 계약 단위)")
    our_value: str = Field(
        description="사용자 제품 설명에서 추출한 당사 스펙 값. 언급 없으면 '미기재'."
    )
    competitor_values: list[CompetitorSpecValue] = Field(
        description="경쟁사별 동일 스펙 값 목록"
    )
    advantage_holder: str = Field(
        description=(
            "해당 스펙에서 우위를 가진 주체: "
            "'our_product'(당사 우세), 경쟁사명(해당 경쟁사 우세), "
            "'equivalent'(동등), 'unknown'(비교 불가)"
        )
    )


class SpecComparisonOutput(BaseModel):
    rows: list[SpecRow] = Field(description="스펙 비교 행 목록 (최소 4개, 최대 8개)")
    our_product_label: str = Field(
        description="제품 설명에서 추론한 당사 제품/서비스명 (짧게, 예: 'GPUaaS 플랫폼')"
    )


# ──────────────────────────────────────────────────────────────────────
# One-Page Report schemas  (purpose-driven: market_entry / competitive_bid / investment_decision)
# ──────────────────────────────────────────────────────────────────────

class OnepageSection(BaseModel):
    title: str = Field(description="섹션 제목 (간결하게, 15자 이내)")
    content: str = Field(
        description="섹션 본문 (2~4문장, 핵심 사실과 수치 중심, 일반론 금지)"
    )


class SummaryCard(BaseModel):
    label: str = Field(description="카드 항목명 (8자 이내)")
    value: str = Field(
        description="해당 항목의 핵심 값 또는 한 줄 결론 (구체적 수치·명사 포함)"
    )


class OnepageReport(BaseModel):
    title: str = Field(description="보고서 제목")
    subtitle: str = Field(description="보고서 부제목 — 제품/시장을 특정하는 한 줄")
    sections: list[OnepageSection] = Field(
        description="핵심 섹션 정확히 3개. 각 섹션은 독립적인 전략 관점을 다룸."
    )
    summary_cards: list[SummaryCard] = Field(
        description="요약 카드 정확히 4개. 가장 중요한 수치·결론 4가지."
    )


class IntelligenceOutput(BaseModel):
    strategic_action_summary: str = Field(
        description=(
            "경영진이 즉시 의사결정할 수 있는 전략적 액션 요약. "
            "반드시 3줄 이내. 일반론 금지 — 이 제품과 이 시장에 특화된 구체적 액션만 서술. "
            "각 줄은 '1)', '2)', '3)' 으로 시작."
        )
    )
    pricing_intelligence: PricingIntelligenceOutput = Field(
        description="경쟁사 가격 정보 종합"
    )
    spec_comparison: SpecComparisonOutput = Field(
        description="당사 vs 경쟁사 스펙 비교"
    )
    absolute_strengths: list[str] = Field(
        description=(
            "수집된 스펙/가격/고객 반응 데이터에서 확인된 당사 제품의 경쟁사 대비 절대적 우위 3~5개. "
            "각 항목은 '어떤 근거로 우위인지' 사실 기반으로 서술."
        )
    )
    critical_weaknesses: list[str] = Field(
        description=(
            "즉각 보완하지 않으면 시장 점유를 잃을 위험이 있는 치명적 약점 3~5개. "
            "각 항목은 '[약점 내용] — 보완 방향: [구체적 액션]' 형식으로 작성."
        )
    )
