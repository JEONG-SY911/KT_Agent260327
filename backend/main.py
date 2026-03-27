"""
FastAPI application entry point for the Market Intelligence Analysis API.

Endpoints:
  POST /analyze  - Streams agent progress and final report via Server-Sent Events
  POST /upload   - Parses an uploaded PDF or DOCX file and returns extracted text
  GET  /health   - Liveness probe

SSE event types emitted by /analyze:
  event: progress  data: {"type": "stage_start"|"stage_complete"|"searching", "step": int, ...}
  event: complete  data: {full AnalysisResult payload}
  event: terminal  data: {"type": "invalid_input"|"error", "fallback_message"?, "error"?}
"""
from __future__ import annotations

import io
import json
import logging
import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# override=True ensures that if OPENAI_API_KEY is already set in the shell
# environment, the value in .env still takes precedence on every restart.
load_dotenv(override=True)

from backend.graph.builder import build_graph
from backend.graph.deep_dive_builder import build_deep_dive_graph
from backend.graph.deep_dive_state import DeepDiveState
from backend.graph.state import AgentState
from backend.schemas import OnepageReport

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Market Intelligence Analysis API",
    description=(
        "Autonomous market research and competitor analysis "
        "using a LangGraph multi-agent workflow."
    ),
    version="2.0.0",
)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build the graphs once at startup; both are stateless and safe for concurrent use.
_graph = build_graph()
_deep_dive_graph = build_deep_dive_graph()


# ──────────────────────────────────────────────────────────────────────
# File parsing helpers
# ──────────────────────────────────────────────────────────────────────

def _parse_pdf(content: bytes) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(stream=content, filetype="pdf")
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages).strip()


def _parse_docx(content: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()


# ──────────────────────────────────────────────────────────────────────
# File upload endpoint
# ──────────────────────────────────────────────────────────────────────

_SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Accepts a PDF (.pdf) or Word (.docx/.doc) file and returns the extracted
    plain text.  The caller passes this text as the product_description to
    the /analyze endpoint.
    """
    filename = file.filename or ""
    ext = ""
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()

    if ext not in _SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"지원하지 않는 파일 형식입니다 ('{ext}'). "
                "PDF(.pdf) 또는 Word(.docx) 파일을 업로드하세요."
            ),
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="파일이 비어 있습니다.")

    try:
        if ext == ".pdf":
            text = _parse_pdf(content)
        else:
            text = _parse_docx(content)
    except Exception as exc:
        logger.error("File parse error (%s): %s", filename, exc)
        raise HTTPException(
            status_code=422,
            detail=f"파일 파싱 중 오류가 발생했습니다: {exc}",
        ) from exc

    if not text:
        raise HTTPException(
            status_code=422,
            detail="파일에서 텍스트를 추출할 수 없습니다. 스캔 이미지 PDF는 지원되지 않습니다.",
        )

    return {
        "text": text,
        "filename": filename,
        "char_count": len(text),
    }


# ──────────────────────────────────────────────────────────────────────
# Analysis streaming endpoint
# ──────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    product_description: str


def _initial_state(product_description: str) -> AgentState:
    return AgentState(
        product_description=product_description,
        is_valid_input=True,
        fallback_message="",
        market_overview="",
        phase1_competitors=[],
        market_positioning="",
        competitors=[],
        search_keywords=[],
        analysis_rationale="",
        raw_research=[],
        knowledge_graph={},
        graph_insights=[],
        final_report={},
        strategic_action_summary="",
        pricing_intelligence={},
        spec_comparison={},
        absolute_strengths=[],
        critical_weaknesses=[],
        current_stage="initializing",
        error=None,
    )


async def _stream_analysis(product_description: str) -> AsyncGenerator[dict, None]:
    """
    Drives the LangGraph workflow and yields SSE-formatted dicts.
    Uses stream_mode=["updates","custom"]:
      - "custom"  chunks are emitted by StreamWriter calls inside nodes.
      - "updates" chunks signal node completion with the state delta.
    """
    accumulated: dict = dict(_initial_state(product_description))

    try:
        async for stream_mode, chunk in _graph.astream(
            _initial_state(product_description),
            stream_mode=["updates", "custom"],
        ):
            if stream_mode == "custom":
                yield {"event": "progress", "data": json.dumps(chunk)}

            elif stream_mode == "updates":
                for _node, delta in chunk.items():
                    accumulated.update(delta)

                stage = accumulated.get("current_stage", "")

                if stage == "complete":
                    payload = {
                        "product_description":       accumulated["product_description"],
                        "market_overview":           accumulated["market_overview"],
                        "phase1_competitors":        accumulated["phase1_competitors"],
                        "market_positioning":        accumulated["market_positioning"],
                        "competitors":               accumulated["competitors"],
                        "search_keywords":           accumulated["search_keywords"],
                        "raw_research":              accumulated["raw_research"],
                        "knowledge_graph":           accumulated["knowledge_graph"],
                        "graph_insights":            accumulated["graph_insights"],
                        "final_report":              accumulated["final_report"],
                        "strategic_action_summary":  accumulated["strategic_action_summary"],
                        "pricing_intelligence":      accumulated["pricing_intelligence"],
                        "spec_comparison":           accumulated["spec_comparison"],
                        "absolute_strengths":        accumulated["absolute_strengths"],
                        "critical_weaknesses":       accumulated["critical_weaknesses"],
                    }
                    yield {"event": "complete", "data": json.dumps(payload)}
                    return

                if stage in ("invalid_input", "error"):
                    yield {
                        "event": "terminal",
                        "data": json.dumps({
                            "type": stage,
                            "fallback_message": accumulated.get("fallback_message", ""),
                            "error": accumulated.get("error", ""),
                        }),
                    }
                    return

    except Exception as exc:
        logger.exception("Workflow execution failed")
        yield {
            "event": "terminal",
            "data": json.dumps({"type": "error", "error": str(exc)}),
        }


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Accepts a product description and streams back agent progress events
    followed by the final analysis report, all via Server-Sent Events.
    """
    return EventSourceResponse(_stream_analysis(request.product_description))


# ──────────────────────────────────────────────────────────────────────
# Deep-Dive streaming endpoint
# ──────────────────────────────────────────────────────────────────────

class DeepDiveRequest(BaseModel):
    company_names: list[str]
    product_description: str


def _initial_deep_dive_state(
    company_names: list[str], product_description: str
) -> DeepDiveState:
    return DeepDiveState(
        company_names=company_names,
        product_description=product_description,
        mode="single" if len(company_names) == 1 else "comparison",
        raw_research=[],
        single_report={},
        comparison_report={},
        current_stage="initializing",
        error=None,
    )


async def _stream_deep_dive(
    company_names: list[str], product_description: str
) -> AsyncGenerator[dict, None]:
    """
    Drives the deep-dive LangGraph workflow and yields SSE-formatted dicts.
    Reuses the same event schema as /analyze for frontend parser compatibility.
    """
    accumulated: dict = dict(
        _initial_deep_dive_state(company_names, product_description)
    )

    try:
        async for stream_mode, chunk in _deep_dive_graph.astream(
            _initial_deep_dive_state(company_names, product_description),
            stream_mode=["updates", "custom"],
        ):
            if stream_mode == "custom":
                yield {"event": "progress", "data": json.dumps(chunk)}

            elif stream_mode == "updates":
                for _node, delta in chunk.items():
                    accumulated.update(delta)

                stage = accumulated.get("current_stage", "")

                if stage == "complete":
                    payload = {
                        "mode":               accumulated["mode"],
                        "single_report":      accumulated["single_report"],
                        "comparison_report":  accumulated["comparison_report"],
                        "raw_research":       accumulated["raw_research"],
                    }
                    yield {"event": "complete", "data": json.dumps(payload)}
                    return

                if stage == "error":
                    yield {
                        "event": "terminal",
                        "data": json.dumps({
                            "type": "error",
                            "error": accumulated.get("error", ""),
                        }),
                    }
                    return

    except Exception as exc:
        logger.exception("Deep-dive workflow failed")
        yield {
            "event": "terminal",
            "data": json.dumps({"type": "error", "error": str(exc)}),
        }


@app.post("/deep-dive")
async def deep_dive(request: DeepDiveRequest):
    """
    Accepts a list of pre-selected company names and streams back a focused
    deep-dive report via Server-Sent Events.
    Single company  -> SWOT + BM detail report
    Multiple companies -> side-by-side comparison report
    """
    if not request.company_names:
        raise HTTPException(status_code=400, detail="company_names가 비어 있습니다.")
    if len(request.company_names) > 5:
        raise HTTPException(status_code=400, detail="최대 5개 기업까지 선택 가능합니다.")
    return EventSourceResponse(
        _stream_deep_dive(request.company_names, request.product_description)
    )


# ──────────────────────────────────────────────────────────────────────
# One-Page Report endpoint
# ──────────────────────────────────────────────────────────────────────

_ONEPAGE_COMMON_RULES = """
작성 원칙:
- 제공된 분석 데이터에서 확인된 사실과 수치만 사용하고 일반론 금지
- 섹션은 정확히 3개, 요약 카드는 정확히 4개
- 각 섹션은 2~4문장 분량 (원페이지 제한)
- 한국어로 작성, 이모티콘 사용 금지
"""

_ONEPAGE_PROMPTS: dict[str, tuple[str, str]] = {
    "market_entry": (
        f"""당신은 GTM(Go-to-Market) 전략 전문가입니다.
제공된 시장 분석 데이터를 기반으로 시장 진입 전략 원페이지 보고서를 작성합니다.
{_ONEPAGE_COMMON_RULES}
보고서 구성:
- 섹션 1: 경쟁사 빈틈(Gap) 분석 — 현 경쟁사들이 공략하지 못한 시장 영역
- 섹션 2: 초기 타겟 고객 세분화 — 가장 높은 전환 가능성이 있는 세그먼트
- 섹션 3: GTM 핵심 메시지 — 차별화된 포지셔닝 문구와 진입 채널 전략
요약 카드: 최우선 진입 세그먼트 / 핵심 차별화 메시지 / 예상 초기 시장 규모 / 주요 진입 장벽""",
        """제품/서비스: {product_description}

수집된 분석 데이터:
{analysis_context}

위 데이터를 기반으로 시장 진입전략 원페이지 보고서를 작성하십시오.""",
    ),
    "competitive_bid": (
        f"""당신은 B2B 경쟁 입찰 전략 전문가입니다.
제공된 경쟁사 분석 데이터를 기반으로 고객사 경쟁 입찰 제안 원페이지 보고서를 작성합니다.
{_ONEPAGE_COMMON_RULES}
보고서 구성:
- 섹션 1: 압도적 우위 요소(USP) — 경쟁사 대비 명확히 우월한 스펙·기능·가격 근거
- 섹션 2: 고객 ROI 정량화 — 고객이 우리 제품을 선택했을 때 얻는 정량적 이익
- 섹션 3: 반론 대응 논리 — 경쟁사가 사용할 예상 공격 논리와 방어 스크립트
요약 카드: 핵심 USP 1위 항목 / 예상 ROI 수치 / 예상 경쟁사 공격 포인트 / 방어 핵심 논리""",
        """제품/서비스: {product_description}

수집된 분석 데이터:
{analysis_context}

위 데이터를 기반으로 경쟁 입찰 제안 원페이지 보고서를 작성하십시오.""",
    ),
    "investment_decision": (
        f"""당신은 기업 투자 심사 전문 컨설턴트입니다.
제공된 시장 분석 데이터를 기반으로 내부 투자 결정 지원 원페이지 보고서를 작성합니다.
{_ONEPAGE_COMMON_RULES}
보고서 구성:
- 섹션 1: 타겟 시장 규모 및 성장성 — TAM/SAM 추정치와 CAGR 전망
- 섹션 2: 초기 리소스 및 예산 추정 — 진입에 필요한 인력·인프라·마케팅 비용 기준점
- 섹션 3: 치명적 리스크 및 헷징 전략 — 투자 실패 시나리오와 리스크 완화 방안
요약 카드: TAM 추정치 / 필요 초기 예산 규모 / 최대 위협 요인 / 핵심 헷징 방안""",
        """제품/서비스: {product_description}

수집된 분석 데이터:
{analysis_context}

위 데이터를 기반으로 내부 투자 결정 지원 원페이지 보고서를 작성하십시오.""",
    ),
}


class OnepageReportRequest(BaseModel):
    report_type: str  # "market_entry" | "competitive_bid" | "investment_decision"
    product_description: str
    analysis_summary: dict


def _build_analysis_context(summary: dict) -> str:
    """Compresses the analysis summary dict into a concise text block for the LLM prompt."""
    lines: list[str] = []

    if summary.get("market_overview"):
        lines.append(f"[시장 개요] {summary['market_overview']}")

    if summary.get("strategic_action_summary"):
        lines.append(f"[전략 요약]\n{summary['strategic_action_summary']}")

    strengths = summary.get("absolute_strengths", [])
    if strengths:
        lines.append("[절대적 강점]\n" + "\n".join(f"- {s}" for s in strengths[:5]))

    weaknesses = summary.get("critical_weaknesses", [])
    if weaknesses:
        lines.append("[치명적 약점]\n" + "\n".join(f"- {w}" for w in weaknesses[:5]))

    phase1 = summary.get("phase1_competitors", [])
    if phase1:
        competitor_lines = [
            f"- {c.get('name', '')} ({c.get('type', '')}): 위협도 {c.get('relevance_score', '')}/10 — {c.get('description', '')[:120]}"
            for c in phase1[:8]
        ]
        lines.append("[Phase1 경쟁사]\n" + "\n".join(competitor_lines))

    pricing = summary.get("pricing_intelligence", {})
    entries = pricing.get("entries", []) if isinstance(pricing, dict) else []
    if entries:
        pricing_lines = [
            f"- {e.get('competitor_name', '')}: {e.get('explicit_price', '')} ({e.get('price_tier', '')})"
            for e in entries[:5]
        ]
        lines.append("[가격 정보]\n" + "\n".join(pricing_lines))
        if pricing.get("market_avg_estimate"):
            lines.append(f"[시장 평균가] {pricing['market_avg_estimate']}")

    final = summary.get("final_report", {})
    if isinstance(final, dict):
        if final.get("executive_summary"):
            lines.append(f"[Executive Summary] {final['executive_summary']}")
        opportunities = final.get("market_opportunities", [])
        if opportunities:
            lines.append("[시장 기회]\n" + "\n".join(f"- {o}" for o in opportunities[:3]))
        threats = final.get("threat_factors", [])
        if threats:
            lines.append("[위협 요소]\n" + "\n".join(f"- {t}" for t in threats[:3]))

    return "\n\n".join(lines)


@app.post("/one-page-report")
async def one_page_report(request: OnepageReportRequest):
    """
    Generates a purpose-driven one-page report using already-collected analysis data.
    No new web search is performed; relies entirely on the provided analysis_summary.
    Returns a structured JSON response (no SSE — single fast LLM call).
    """
    if request.report_type not in _ONEPAGE_PROMPTS:
        raise HTTPException(
            status_code=400,
            detail=f"report_type must be one of: {list(_ONEPAGE_PROMPTS.keys())}",
        )

    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI

    system_prompt, human_template = _ONEPAGE_PROMPTS[request.report_type]
    analysis_context = _build_analysis_context(request.analysis_summary)

    llm = ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4o-mini"),
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0,
    )
    structured_llm = llm.with_structured_output(OnepageReport)
    chain = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", human_template),
    ]) | structured_llm

    try:
        result: OnepageReport = await chain.ainvoke({
            "product_description": request.product_description,
            "analysis_context": analysis_context,
        })
        return result.model_dump()
    except Exception as exc:
        logger.error("One-page report generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
async def health():
    return {"status": "ok", "service": "market-intelligence-api", "version": "2.0.0"}
