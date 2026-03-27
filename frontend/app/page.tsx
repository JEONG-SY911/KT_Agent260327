"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

import { AgentProgress } from "@/components/AgentProgress";
import { InputForm } from "@/components/InputForm";
import { ReportView } from "@/components/ReportView";
import { ReportSkeleton } from "@/components/SkeletonLoader";
import { createSSEParser } from "@/lib/streamParser";
import type {
  AgentStep,
  AnalysisResult,
  AppState,
  ProgressPayload,
  TerminalPayload,
} from "@/types/analysis";

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

const INITIAL_STEPS: AgentStep[] = [
  {
    step: 1, node: "market_scan",
    label: "Market Scan",          description: "시장 경쟁사 광범위 스캔 (Phase 1)",
    status: "pending", message: "대기 중",
  },
  {
    step: 2, node: "competitor_select",
    label: "Competitor Selection", description: "핵심 경쟁사 선별 및 심층 분석 (Phase 2)",
    status: "pending", message: "대기 중",
  },
  {
    step: 3, node: "planner",
    label: "Planner Agent",        description: "국내/글로벌 분석 전략 수립",
    status: "pending", message: "대기 중",
  },
  {
    step: 4, node: "researcher",
    label: "Web Researcher",       description: "국내외 데이터 수집",
    status: "pending", message: "대기 중",
  },
  {
    step: 5, node: "graph",
    label: "Graph Structuring",    description: "지식 그래프 구축",
    status: "pending", message: "대기 중",
  },
  {
    step: 6, node: "reporter",
    label: "Reporter Agent",       description: "보고서 작성",
    status: "pending", message: "대기 중",
  },
];

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ──────────────────────────────────────────────────────────────────────
// Page component
// ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState]           = useState<AppState>("idle");
  const [steps, setSteps]                 = useState<AgentStep[]>(INITIAL_STEPS);
  const [result, setResult]               = useState<AnalysisResult | null>(null);
  const [fallbackMessage, setFallbackMsg] = useState("");
  const [errorMessage, setErrorMsg]       = useState("");
  const [showSkeleton, setShowSkeleton]   = useState(false);

  // ── Step helpers ──────────────────────────────────────────────────

  function setStepStatus(step: number, status: AgentStep["status"], message: string) {
    setSteps((prev) =>
      prev.map((s) => (s.step === step ? { ...s, status, message } : s))
    );
  }

  // ── Analysis handler ──────────────────────────────────────────────

  const handleAnalyze = useCallback(async (productDescription: string) => {
    setAppState("analyzing");
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending", message: "대기 중" })));
    setResult(null);
    setFallbackMsg("");
    setErrorMsg("");
    setShowSkeleton(false);

    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_description: productDescription }),
      });
    } catch {
      setErrorMsg("백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.");
      setAppState("error");
      return;
    }

    if (!response.ok || !response.body) {
      setErrorMsg(`서버 오류: HTTP ${response.status}`);
      setAppState("error");
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    const parser = createSSEParser(({ event, data }) => {
      if (event === "progress") {
        const payload = data as ProgressPayload;
        if (payload.type === "stage_start" && payload.step != null) {
          setStepStatus(payload.step, "active", payload.message);
        } else if (payload.type === "stage_complete" && payload.step != null) {
          setStepStatus(payload.step, "complete", payload.message);
          // Show skeleton when the last step completes (report incoming)
          if (payload.step === 6) setShowSkeleton(true);
        } else if (payload.type === "searching" && payload.step != null) {
          setStepStatus(payload.step, "active", payload.message);
        }
      } else if (event === "complete") {
        setResult(data as AnalysisResult);
        setShowSkeleton(false);
        setAppState("complete");
      } else if (event === "terminal") {
        const payload = data as TerminalPayload;
        if (payload.type === "invalid_input") {
          setFallbackMsg(payload.fallback_message ?? "");
          setAppState("fallback");
        } else {
          setErrorMsg(payload.error ?? "알 수 없는 오류가 발생했습니다.");
          setAppState("error");
        }
      }
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser(decoder.decode(value, { stream: true }));
      }
    } catch {
      setErrorMsg("데이터 수신 중 오류가 발생했습니다.");
      setAppState("error");
    }
  }, []);

  function handleReset() {
    setAppState("idle");
    setSteps(INITIAL_STEPS);
    setResult(null);
    setFallbackMsg("");
    setErrorMsg("");
    setShowSkeleton(false);
  }

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-brand-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">MI</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              Market Intelligence Agent
            </span>
          </div>
          <div className="flex items-center gap-3">
            {appState !== "idle" && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                새 분석
              </button>
            )}
            <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
              LangGraph · GPT-4o-mini
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* ── IDLE ─────────────────────────────────────────────────── */}
        {appState === "idle" && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
                자율형 시장 동향 및 경쟁사 분석
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                제품/서비스 설명을 입력하거나 문서 파일을 업로드하면 AI 에이전트가 자동으로
                경쟁사를 탐색하고 마켓 인텔리전스 보고서를 생성합니다.
              </p>
            </div>

            <div className="card p-6">
              <InputForm onSubmit={handleAnalyze} isLoading={false} />
            </div>

            {/* Pipeline overview */}
            <div className="mt-6 grid grid-cols-3 md:grid-cols-6 gap-2">
              {INITIAL_STEPS.map((s) => (
                <div key={s.step} className="text-center p-3 rounded-lg bg-white border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700">{s.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ANALYZING ────────────────────────────────────────────── */}
        {appState === "analyzing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="card p-6 sticky top-20">
                <h2 className="text-sm font-semibold text-slate-900 mb-5">
                  에이전트 실행 현황
                </h2>
                <AgentProgress steps={steps} />
              </div>
            </div>
            <div className="lg:col-span-2">
              {showSkeleton ? (
                <ReportSkeleton />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin mb-4" />
                  <p className="text-sm text-slate-500">AI 에이전트 분석 진행 중</p>
                  <p className="text-xs text-slate-400 mt-1">약 45~90초 소요됩니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMPLETE ─────────────────────────────────────────────── */}
        {appState === "complete" && result && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="card p-5 sticky top-20">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  분석 완료
                </h2>
                <AgentProgress
                  steps={steps.map((s) => ({
                    ...s,
                    status: s.status === "pending" ? "complete" : s.status,
                  }))}
                />
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="mb-6">
                <h1 className="text-lg font-bold text-slate-900">
                  마켓 인텔리전스 보고서
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Generated by LangGraph Multi-Agent Workflow · 2-Phase Competitor Analysis
                </p>
              </div>
              <ReportView result={result} />
            </div>
          </div>
        )}

        {/* ── FALLBACK ─────────────────────────────────────────────── */}
        {appState === "fallback" && (
          <div className="max-w-2xl mx-auto">
            <div className="card p-6 border-l-4 border-amber-400">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-1">
                    추가 정보가 필요합니다
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{fallbackMessage}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                다시 입력하기
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────── */}
        {appState === "error" && (
          <div className="max-w-2xl mx-auto">
            <div className="card p-6 border-l-4 border-red-500">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-1">
                    분석 중 오류가 발생했습니다
                  </h2>
                  <p className="text-sm text-slate-600 font-mono">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                다시 시도하기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
