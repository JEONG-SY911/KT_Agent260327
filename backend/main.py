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
from backend.graph.state import AgentState

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build the graph once at startup; it is stateless and safe for concurrent use.
_graph = build_graph()


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
                        "product_description": accumulated["product_description"],
                        "market_overview":     accumulated["market_overview"],
                        "phase1_competitors":  accumulated["phase1_competitors"],
                        "market_positioning":  accumulated["market_positioning"],
                        "competitors":         accumulated["competitors"],
                        "search_keywords":     accumulated["search_keywords"],
                        "raw_research":        accumulated["raw_research"],
                        "knowledge_graph":     accumulated["knowledge_graph"],
                        "graph_insights":      accumulated["graph_insights"],
                        "final_report":        accumulated["final_report"],
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "market-intelligence-api", "version": "2.0.0"}
