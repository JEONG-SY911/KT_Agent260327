"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createSSEParser } from "@/lib/streamParser";
import type {
  ComparisonEntry,
  ComparisonReport,
  DeepDiveApiResult,
  ProgressPayload,
  SingleDeepDiveReport,
  SWOTItem,
  TerminalPayload,
} from "@/types/analysis";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ──────────────────────────────────────────────────────────────────────
// Small helper components (mirrors ReportView counterparts)
// ──────────────────────────────────────────────────────────────────────

function SWOTGrid({ swot }: { swot: SWOTItem }) {
  const quadrants: { key: keyof SWOTItem; label: string; color: string; dot: string }[] = [
    { key: "strengths",    label: "Strengths",    color: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500" },
    { key: "weaknesses",   label: "Weaknesses",   color: "border-red-200 bg-red-50",         dot: "bg-red-400" },
    { key: "opportunities",label: "Opportunities",color: "border-blue-200 bg-blue-50",       dot: "bg-blue-500" },
    { key: "threats",      label: "Threats",      color: "border-amber-200 bg-amber-50",     dot: "bg-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {quadrants.map(({ key, label, color, dot }) => (
        <div key={key} className={`rounded-lg border p-4 ${color}`}>
          <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            {label}
          </p>
          <ul className="space-y-1.5">
            {swot[key].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="text-xs text-slate-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SingleDeepDiveReportView({ report }: { report: SingleDeepDiveReport }) {
  return (
    <div className="space-y-5">
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">{report.company_name}</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{report.business_model_detail}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            핵심 기술
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{report.core_technology}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            주요 제품 / 서비스
          </p>
          <div className="flex flex-wrap gap-1.5">
            {report.key_products.map((product) => (
              <span
                key={product}
                className="inline-block px-2 py-1 rounded bg-slate-100 text-xs text-slate-700 font-medium"
              >
                {product}
              </span>
            ))}
          </div>
        </div>
      </div>

      <SWOTGrid swot={report.swot} />

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            최근 주요 이슈
          </p>
          <ul className="space-y-2">
            {report.recent_highlights.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                <span className="text-xs text-slate-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            고객 불만 / 약점
          </p>
          <ul className="space-y-2">
            {report.customer_pain_points.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5" />
                <span className="text-xs text-slate-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const COMPARISON_ROWS: { key: keyof ComparisonEntry; label: string }[] = [
  { key: "core_service",    label: "핵심 서비스" },
  { key: "target_customer", label: "타겟 고객" },
  { key: "pricing_model",   label: "가격 정책" },
  { key: "market_position", label: "시장 포지션" },
  { key: "top_strength",    label: "핵심 강점" },
  { key: "top_weakness",    label: "핵심 약점" },
];

function ComparisonReportView({ report }: { report: ComparisonReport }) {
  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">기업 비교 분석</h3>
          <span className="ml-auto text-xs text-slate-400 font-mono">
            {report.entries.length}개 기업
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2.5 pr-4 text-left font-semibold text-slate-500 w-28">
                  항목
                </th>
                {report.entries.map((e) => (
                  <th key={e.company_name} className="py-2.5 px-3 text-left font-semibold text-slate-800">
                    {e.company_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(({ key, label }) => (
                <tr key={key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-500 align-top">{label}</td>
                  {report.entries.map((e) => (
                    <td key={e.company_name} className="py-2.5 px-3 text-slate-700 leading-relaxed align-top">
                      {key === "top_strength" && (
                        <span className="flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5 flex-shrink-0">+</span>
                          {e[key]}
                        </span>
                      )}
                      {key === "top_weakness" && (
                        <span className="flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5 flex-shrink-0">-</span>
                          {e[key]}
                        </span>
                      )}
                      {key !== "top_strength" && key !== "top_weakness" && e[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 border-l-4 border-slate-300">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          비교 분석 종합 인사이트
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Progress steps
// ──────────────────────────────────────────────────────────────────────

const DEEP_DIVE_STEPS = [
  { step: 1, label: "타겟 데이터 수집", description: "선택 기업 집중 검색 및 딥 리딩" },
  { step: 2, label: "보고서 생성",      description: "심층 분석 보고서 작성" },
];

function StepIndicator({
  steps,
  activeStep,
  message,
}: {
  steps: typeof DEEP_DIVE_STEPS;
  activeStep: number;
  message: string;
}) {
  return (
    <div className="space-y-3 mb-6">
      {steps.map(({ step, label, description }) => {
        const isDone   = activeStep > step;
        const isActive = activeStep === step;
        return (
          <div key={step} className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDone
                  ? "bg-emerald-100 text-emerald-700"
                  : isActive
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : step}
            </div>
            <div>
              <p className={`text-xs font-semibold ${isActive ? "text-slate-900" : isDone ? "text-slate-500" : "text-slate-400"}`}>
                {label}
              </p>
              <p className="text-xs text-slate-400">{isActive ? message : description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Page component
// ──────────────────────────────────────────────────────────────────────

export default function DeepDivePage() {
  const [phase, setPhase] = useState<"loading" | "complete" | "error">("loading");
  const [activeStep, setActiveStep] = useState(1);
  const [stepMessage, setStepMessage] = useState("타겟 데이터 수집 중...");
  const [result, setResult] = useState<DeepDiveApiResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let params: { company_names: string[]; product_description: string } | null = null;
    try {
      const raw = localStorage.getItem("deepDiveParams");
      if (raw) params = JSON.parse(raw);
    } catch {
      // ignore parse errors
    }

    if (!params || !params.company_names?.length) {
      setErrorMsg("분석할 기업 정보를 찾을 수 없습니다. 원래 탭에서 다시 시도해 주세요.");
      setPhase("error");
      return;
    }

    setCompanies(params.company_names);

    (async () => {
      let response: Response;
      try {
        response = await fetch(`${BACKEND_URL}/deep-dive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
      } catch {
        setErrorMsg("백엔드 서버에 연결할 수 없습니다.");
        setPhase("error");
        return;
      }

      if (!response.ok || !response.body) {
        setErrorMsg(`서버 오류: HTTP ${response.status}`);
        setPhase("error");
        return;
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      const parser = createSSEParser(({ event, data }) => {
        if (event === "progress") {
          const payload = data as ProgressPayload;
          if (payload.step != null) setActiveStep(payload.step);
          setStepMessage(payload.message);
        } else if (event === "complete") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = data as any;
          const parsed: DeepDiveApiResult = {
            mode: raw.mode,
            single_report:
              raw.single_report && Object.keys(raw.single_report).length > 0
                ? raw.single_report
                : null,
            comparison_report:
              raw.comparison_report && Object.keys(raw.comparison_report).length > 0
                ? raw.comparison_report
                : null,
            raw_research: raw.raw_research ?? [],
          };
          setResult(parsed);
          setPhase("complete");
        } else if (event === "terminal") {
          const payload = data as TerminalPayload;
          setErrorMsg(payload.error ?? "심층 분석 중 오류가 발생했습니다.");
          setPhase("error");
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
        setPhase("error");
      }
    })();
  }, []);

  const isComparison = result?.mode === "comparison";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            탭 닫기
          </button>
          <div className="flex items-center gap-2">
            {isComparison ? (
              <Users className="h-4 w-4 text-slate-500" />
            ) : (
              <Search className="h-4 w-4 text-slate-500" />
            )}
            <span className="text-sm font-semibold text-slate-900">
              {companies.length > 0
                ? companies.join(" · ")
                : "기업 심층 분석"}
            </span>
          </div>
          {phase === "complete" && (
            <span className="ml-auto text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
              {isComparison ? "비교 분석 완료" : "단독 심층 분석 완료"}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Loading state */}
        {phase === "loading" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="card p-6 sticky top-20">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">
                  분석 진행 현황
                </h2>
                <StepIndicator
                  steps={DEEP_DIVE_STEPS}
                  activeStep={activeStep}
                  message={stepMessage}
                />
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-brand-600 animate-spin mb-4" />
              <p className="text-sm text-slate-500">{stepMessage}</p>
              <p className="text-xs text-slate-400 mt-1">
                {companies.length > 1 ? "기업 비교 분석 실행 중" : "단독 기업 심층 분석 실행 중"}
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === "error" && (
          <div className="max-w-lg mx-auto">
            <div className="card p-6 border-l-4 border-red-500">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-1">
                    심층 분석 중 오류가 발생했습니다
                  </h2>
                  <p className="text-sm text-slate-600 font-mono">{errorMsg}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete state */}
        {phase === "complete" && result && (
          <div>
            <div className="mb-6">
              <h1 className="text-lg font-bold text-slate-900">
                {isComparison ? "다중 기업 비교 분석" : `${companies[0]} 심층 분석`}
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Deep-Dive Analysis · LangGraph Targeted Research Pipeline
              </p>
            </div>

            {result.mode === "single" && result.single_report && (
              <SingleDeepDiveReportView report={result.single_report} />
            )}
            {result.mode === "comparison" && result.comparison_report && (
              <ComparisonReportView report={result.comparison_report} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
