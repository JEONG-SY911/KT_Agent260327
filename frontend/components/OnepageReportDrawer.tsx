"use client";

import {
  BarChart2,
  FileText,
  Loader2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  AnalysisResult,
  OnepageReport,
  ReportType,
} from "@/types/analysis";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ──────────────────────────────────────────────────────────────────────
// Report type metadata
// ──────────────────────────────────────────────────────────────────────

const REPORT_META: Record<
  ReportType,
  { label: string; icon: React.ReactNode; description: string }
> = {
  market_entry: {
    label: "시장 진입전략",
    icon: <TrendingUp className="h-4 w-4" />,
    description: "경쟁 빈틈 분석 · 타겟 세분화 · GTM 핵심 메시지",
  },
  competitive_bid: {
    label: "경쟁입찰 제안",
    icon: <FileText className="h-4 w-4" />,
    description: "USP 우위 요소 · ROI 정량화 · 반론 대응 논리",
  },
  investment_decision: {
    label: "내부 투자 결정",
    icon: <BarChart2 className="h-4 w-4" />,
    description: "시장 규모 추정 · 초기 예산 기준 · 리스크 헷징",
  },
};

// ──────────────────────────────────────────────────────────────────────
// Helper: build compressed analysis_summary for API
// ──────────────────────────────────────────────────────────────────────

function buildAnalysisSummary(result: AnalysisResult) {
  return {
    market_overview: result.market_overview,
    strategic_action_summary: result.strategic_action_summary,
    absolute_strengths: result.absolute_strengths?.slice(0, 5) ?? [],
    critical_weaknesses: result.critical_weaknesses?.slice(0, 5) ?? [],
    phase1_competitors: result.phase1_competitors?.slice(0, 8).map((c) => ({
      name: c.name,
      type: c.type,
      description: c.description,
      relevance_score: c.relevance_score,
    })) ?? [],
    pricing_intelligence: result.pricing_intelligence
      ? {
          entries: result.pricing_intelligence.entries?.slice(0, 5).map((e) => ({
            competitor_name: e.competitor_name,
            explicit_price: e.explicit_price,
            price_tier: e.price_tier,
          })) ?? [],
          market_avg_estimate: result.pricing_intelligence.market_avg_estimate,
        }
      : {},
    final_report: result.final_report
      ? {
          executive_summary: result.final_report.executive_summary,
          market_opportunities: result.final_report.market_opportunities?.slice(0, 3) ?? [],
          threat_factors: result.final_report.threat_factors?.slice(0, 3) ?? [],
        }
      : {},
  };
}

// ──────────────────────────────────────────────────────────────────────
// Report content renderer
// ──────────────────────────────────────────────────────────────────────

function ReportContent({ report }: { report: OnepageReport }) {
  const [s1, s2, s3] = report.sections;
  const [c1, c2, c3, c4] = report.summary_cards;

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-slate-200 pl-3">
        {report.subtitle}
      </p>

      {/* Sections 1 & 2 — two-column grid */}
      <div className="grid grid-cols-2 gap-4">
        {[s1, s2].filter(Boolean).map((section) => (
          <div
            key={section.title}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              {section.title}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>

      {/* Section 3 — full width */}
      {s3 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4">
          <p className="text-xs font-semibold text-brand-700 mb-2 uppercase tracking-wide">
            {s3.title}
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{s3.content}</p>
        </div>
      )}

      {/* Summary cards — 2x2 grid */}
      {report.summary_cards.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            핵심 요약
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[c1, c2, c3, c4].filter(Boolean).map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <p className="text-xs text-slate-400 mb-1">{card.label}</p>
                <p className="text-xs font-semibold text-slate-800 leading-snug">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main Drawer component
// ──────────────────────────────────────────────────────────────────────

interface OnepageReportDrawerProps {
  isOpen: boolean;
  reportType: ReportType | null;
  result: AnalysisResult;
  onClose: () => void;
}

export function OnepageReportDrawer({
  isOpen,
  reportType,
  result,
  onClose,
}: OnepageReportDrawerProps) {
  const [report, setReport] = useState<OnepageReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // Cache results by report type so re-opening the same type is instant
  const [cache, setCache] = useState<Partial<Record<ReportType, OnepageReport>>>({});

  useEffect(() => {
    if (!isOpen || !reportType) return;
    if (cache[reportType]) {
      setReport(cache[reportType]!);
      return;
    }

    let cancelled = false;
    setReport(null);
    setError("");
    setIsLoading(true);

    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/one-page-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_type: reportType,
            product_description: result.product_description,
            analysis_summary: buildAnalysisSummary(result),
          }),
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`HTTP ${response.status}: ${detail}`);
        }
        const data: OnepageReport = await response.json();
        if (!cancelled) {
          setReport(data);
          setCache((prev) => ({ ...prev, [reportType]: data }));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "알 수 없는 오류");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reportType]);

  const meta = reportType ? REPORT_META[reportType] : null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 flex-shrink-0">
          {meta && (
            <div className="flex items-center gap-2 text-slate-600">
              {meta.icon}
              <span className="text-sm font-semibold text-slate-900">
                {meta.label} 보고서
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
            닫기
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="h-6 w-6 text-brand-600 animate-spin" />
              <p className="text-sm text-slate-500">원페이지 보고서 생성 중...</p>
              {meta && (
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  {meta.description}
                </p>
              )}
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-600 mb-1">보고서 생성 실패</p>
              <p className="text-xs text-slate-600 font-mono">{error}</p>
            </div>
          )}

          {!isLoading && !error && report && (
            <div>
              {/* Report title */}
              <h2 className="text-base font-bold text-slate-900 mb-4">
                {report.title}
              </h2>
              <ReportContent report={report} />
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && report && (
          <div className="px-6 py-3 border-t border-slate-100 flex-shrink-0">
            <p className="text-xs text-slate-400 italic">
              이 보고서는 수집된 시장 분석 데이터를 기반으로 AI가 생성한 원페이지 요약입니다.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
