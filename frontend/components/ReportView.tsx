"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  BookOpen,
  Building2,
  Check,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Loader2,
  Network,
  Search,
  Shield,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { PdfExportButtons } from "@/components/PdfExportButtons";
import type {
  AnalysisResult,
  GraphNode,
  Phase1CompetitorItem,
  PricingEntry,
  PricingIntelligence,
  SpecComparison,
  SWOTItem,
} from "@/types/analysis";

interface ReportViewProps {
  result: AnalysisResult;
}

// ──────────────────────────────────────────────────────────────────────
// Shared helper components (unchanged from original)
// ──────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="text-slate-500">{icon}</div>
      <h2 className="section-title">{title}</h2>
    </div>
  );
}

function BulletList({
  items,
  variant = "default",
}: {
  items: string[];
  variant?: "default" | "opportunity" | "threat" | "recommendation";
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          {variant === "recommendation" ? (
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-brand-600 text-white text-xs font-bold">
              {i + 1}
            </span>
          ) : (
            <span
              className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2 ${
                variant === "opportunity"
                  ? "bg-emerald-500"
                  : variant === "threat"
                  ? "bg-red-500"
                  : "bg-slate-400"
              }`}
            />
          )}
          <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NodeTypeBadge({ type }: { type: GraphNode["type"] }) {
  const classes: Record<GraphNode["type"], string> = {
    company: "badge-company",
    product: "badge-product",
    trend:   "badge-trend",
    threat:  "badge-threat",
  };
  const labels: Record<GraphNode["type"], string> = {
    company: "기업",
    product: "제품",
    trend:   "트렌드",
    threat:  "위협",
  };
  return <span className={classes[type]}>{labels[type]}</span>;
}

function ThreatBar({ score }: { score: number }) {
  const filled  = Math.round(score / 2);
  const color   =
    score >= 8 ? "bg-red-500"
    : score >= 5 ? "bg-amber-500"
    : "bg-slate-400";
  const textColor =
    score >= 8 ? "text-red-600"
    : score >= 5 ? "text-amber-600"
    : "text-slate-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-3.5 rounded-sm ${i < filled ? color : "bg-slate-200"}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{score}/10</span>
    </div>
  );
}

function CompetitorTypeBadge({ type }: { type: Phase1CompetitorItem["type"] }) {
  const map: Record<Phase1CompetitorItem["type"], { label: string; className: string }> = {
    direct:   { label: "직접 경쟁",   className: "bg-blue-50 text-blue-700 border-blue-200" },
    indirect: { label: "간접/대체재", className: "bg-slate-100 text-slate-600 border-slate-200" },
    adjacent: { label: "인접 시장",   className: "bg-violet-50 text-violet-700 border-violet-200" },
  };
  const { label, className } = map[type] ?? map.indirect;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Selection Action Bar
// ──────────────────────────────────────────────────────────────────────

function SelectionActionBar({
  selectedCount,
  onSingle,
  onComparison,
  onClear,
  isLoading,
}: {
  selectedCount: number;
  onSingle: () => void;
  onComparison: () => void;
  onClear: () => void;
  isLoading: boolean;
}) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          체크박스로 기업을 선택하면 심층 분석을 실행할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white border border-brand-600/30 shadow-sm">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 flex-shrink-0">
        <Check className="h-3.5 w-3.5 text-brand-600" />
        {selectedCount}개 기업 선택됨
      </span>

      <div className="flex items-center gap-2 ml-auto">
        {selectedCount === 1 && (
          <button
            onClick={onSingle}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            단일 기업 심층 분석
          </button>
        )}

        {selectedCount >= 2 && (
          <button
            onClick={onComparison}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            다중 기업 비교 보고서
          </button>
        )}

        <button
          onClick={onClear}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
        >
          <X className="h-3 w-3" />
          선택 초기화
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────
// Feature 1: Executive Insight Panel
// ──────────────────────────────────────────────────────────────────────

function ExecutiveInsightPanel({
  summary,
  strengths,
  weaknesses,
}: {
  summary: string;
  strengths: string[];
  weaknesses: string[];
}) {
  const lines = summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="rounded-xl bg-slate-900 p-6 text-white">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-slate-300" />
        <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
          Executive Insight — 즉시 실행 전략
        </h2>
      </div>

      <ul className="space-y-2.5 mb-5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-slate-200 leading-relaxed">
              {line.replace(/^\d+\)\s*/, "")}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-700 pt-4">
        <div>
          <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
            절대적 강점 ({strengths.length})
          </p>
          <ul className="space-y-1.5">
            {strengths.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0 text-xs">+</span>
                <span className="text-xs text-slate-300 leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">
            즉시 보완 필요 ({weaknesses.length})
          </p>
          <ul className="space-y-1.5">
            {weaknesses.slice(0, 3).map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5 flex-shrink-0 text-xs">-</span>
                <span className="text-xs text-slate-300 leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Feature 2: Pricing Intelligence
// ──────────────────────────────────────────────────────────────────────

const PRICE_TIER_CONFIG: Record<
  PricingEntry["price_tier"],
  { label: string; dot: string; text: string }
> = {
  low:     { label: "저가형",   dot: "bg-slate-400",  text: "text-slate-500" },
  medium:  { label: "중가형",   dot: "bg-amber-400",  text: "text-amber-600" },
  high:    { label: "고가형",   dot: "bg-orange-500", text: "text-orange-600" },
  premium: { label: "프리미엄", dot: "bg-red-500",    text: "text-red-600" },
};

function PricingTierBadge({ tier }: { tier: PricingEntry["price_tier"] }) {
  const cfg = PRICE_TIER_CONFIG[tier] ?? PRICE_TIER_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PricingIntelligenceSection({ data }: { data: PricingIntelligence }) {
  return (
    <div className="card p-6">
      <SectionHeader
        icon={<CircleDollarSign className="h-4 w-4" />}
        title="Pricing Intelligence — 가격 경쟁력 분석"
      />

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2 pr-4 font-semibold text-slate-500">경쟁사</th>
              <th className="py-2 pr-4 font-semibold text-slate-500">가격</th>
              <th className="py-2 pr-4 font-semibold text-slate-500">가격 등급</th>
              <th className="py-2 pr-4 font-semibold text-slate-500">가격 모델</th>
              <th className="py-2 pr-4 font-semibold text-slate-500">시장 평균 대비</th>
              <th className="py-2 font-semibold text-slate-500">프로모션</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr
                key={e.competitor_name}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
              >
                <td className="py-2.5 pr-4 font-semibold text-slate-800">{e.competitor_name}</td>
                <td className="py-2.5 pr-4 text-slate-700 font-mono text-xs">{e.explicit_price}</td>
                <td className="py-2.5 pr-4">
                  <PricingTierBadge tier={e.price_tier} />
                </td>
                <td className="py-2.5 pr-4 text-slate-600">{e.pricing_model}</td>
                <td className="py-2.5 pr-4 text-slate-600 max-w-[200px] leading-relaxed">
                  {e.price_vs_market_avg}
                </td>
                <td className="py-2.5 text-slate-600">
                  {e.active_promotions === "없음" ? (
                    <span className="text-slate-400">없음</span>
                  ) : (
                    e.active_promotions
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-500 mb-1">시장 평균 가격대</p>
          <p className="text-xs text-slate-700 leading-relaxed">{data.market_avg_estimate}</p>
        </div>
        <div className="bg-brand-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-brand-600 mb-1">당사 가격 포지셔닝 방향</p>
          <p className="text-xs text-slate-700 leading-relaxed">{data.our_price_positioning}</p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Feature 3: Spec Comparison
// ──────────────────────────────────────────────────────────────────────

function SpecComparisonSection({ data }: { data: SpecComparison }) {
  const competitorNames = Array.from(
    new Set(
      data.rows.flatMap((r) => r.competitor_values.map((cv) => cv.competitor_name))
    )
  );

  return (
    <div className="card p-6">
      <SectionHeader
        icon={<Layers className="h-4 w-4" />}
        title={`스펙 정밀 대조 — ${data.our_product_label} vs 경쟁사`}
      />
      <p className="text-xs text-slate-400 mb-4">
        배경 강조: 녹색 = 당사 우세, 적색 = 경쟁사 우세
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2 pr-4 font-semibold text-slate-500 min-w-[120px]">스펙 항목</th>
              <th className="py-2 pr-4 font-semibold text-brand-600 min-w-[120px]">
                {data.our_product_label}
              </th>
              {competitorNames.map((name) => (
                <th key={name} className="py-2 pr-4 font-semibold text-slate-500 min-w-[120px]">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const competitorMap = Object.fromEntries(
                row.competitor_values.map((cv) => [cv.competitor_name, cv.value])
              );

              const ourCellClass =
                row.advantage_holder === "our_product"
                  ? "bg-emerald-50 font-semibold text-emerald-800"
                  : "text-slate-700";

              return (
                <tr key={row.spec_name} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-600">{row.spec_name}</td>
                  <td className={`py-2.5 pr-4 ${ourCellClass}`}>
                    {row.our_value === "미기재" ? (
                      <span className="text-slate-400">미기재</span>
                    ) : (
                      row.our_value
                    )}
                  </td>
                  {competitorNames.map((name) => {
                    const val = competitorMap[name] ?? "—";
                    const isWinner = row.advantage_holder === name;
                    return (
                      <td
                        key={name}
                        className={`py-2.5 pr-4 ${
                          isWinner ? "bg-red-50 text-red-700 font-semibold" : "text-slate-600"
                        }`}
                      >
                        {val === "미공개" ? (
                          <span className="text-slate-400">미공개</span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Feature 4: Competitive SWOT Dashboard (absolute strengths/weaknesses)
// ──────────────────────────────────────────────────────────────────────

function CompetitiveSwotDashboard({
  strengths,
  weaknesses,
}: {
  strengths: string[];
  weaknesses: string[];
}) {
  return (
    <div className="card p-6">
      <SectionHeader
        icon={<Shield className="h-4 w-4" />}
        title="전략적 강점 및 즉시 보완점"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Absolute Strengths */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">
            절대적 강점 — 경쟁사 대비 확인된 우위
          </p>
          <ul className="space-y-2.5">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-xs text-slate-700 leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Critical Weaknesses */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-3">
            치명적 약점 — 즉각 보완 필요
          </p>
          <ul className="space-y-2.5">
            {weaknesses.map((w, i) => {
              const parts = w.split("— 보완 방향:");
              const weakness = parts[0]?.trim() ?? w;
              const action = parts[1]?.trim();
              return (
                <li key={i} className="space-y-0.5">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-700 leading-relaxed font-medium">
                      {weakness}
                    </span>
                  </div>
                  {action && (
                    <p className="ml-6 text-xs text-red-700 bg-red-100 rounded px-2 py-1 leading-relaxed">
                      보완 방향: {action}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SWOT 2x2 grid
// ──────────────────────────────────────────────────────────────────────

function SWOTGrid({ swot }: { swot: SWOTItem }) {
  const quadrants = [
    {
      label: "Strengths — 강점",
      items: swot.strengths,
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      title: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    {
      label: "Weaknesses — 약점",
      items: swot.weaknesses,
      bg: "bg-red-50",
      border: "border-red-200",
      title: "text-red-700",
      dot: "bg-red-500",
    },
    {
      label: "Opportunities — 기회",
      items: swot.opportunities,
      bg: "bg-blue-50",
      border: "border-blue-200",
      title: "text-blue-700",
      dot: "bg-blue-500",
    },
    {
      label: "Threats — 위협",
      items: swot.threats,
      bg: "bg-amber-50",
      border: "border-amber-200",
      title: "text-amber-700",
      dot: "bg-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {quadrants.map(({ label, items, bg, border, title, dot }) => (
        <div key={label} className={`rounded-lg border ${border} ${bg} p-4`}>
          <p className={`text-xs font-semibold ${title} mb-2`}>{label}</p>
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${dot}`} />
                <span className="text-xs text-slate-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────────
// Main ReportView component
// ──────────────────────────────────────────────────────────────────────

export function ReportView({ result }: ReportViewProps) {
  const {
    final_report,
    phase1_competitors,
    competitors,
    knowledge_graph,
    graph_insights,
    raw_research,
    market_overview,
    strategic_action_summary,
    pricing_intelligence,
    spec_comparison,
    absolute_strengths,
    critical_weaknesses,
  } = result;

  // ── Deep-dive selection state ─────────────────────────────────────
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  function toggleSelect(name: string) {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearSelection() {
    setSelectedNames(new Set());
  }

  function handleDeepDive() {
    const company_names = Array.from(selectedNames);
    if (company_names.length === 0) return;
    try {
      localStorage.setItem(
        "deepDiveParams",
        JSON.stringify({
          company_names,
          product_description: result.product_description,
        })
      );
    } catch {
      // localStorage unavailable — open tab anyway; page will show an error
    }
    window.open("/deep-dive", "_blank");
  }


  // ── Derived ───────────────────────────────────────────────────────
  const directCompetitors   = competitors.filter((c) => c.type === "direct");
  const indirectCompetitors = competitors.filter((c) => c.type === "indirect");

  const references = Array.from(
    new Map(raw_research.map((r) => [r.url, r])).values()
  ).slice(0, 12);

  const nodesByType = knowledge_graph.nodes?.reduce<
    Record<string, typeof knowledge_graph.nodes>
  >((acc, node) => {
    acc[node.type] = acc[node.type] || [];
    acc[node.type].push(node);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6">
      {/* ── 0. 목적별 원페이지 보고서 PDF 내보내기 ──────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-slate-400" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            목적별 원페이지 보고서 생성
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          수집된 분석 데이터를 바탕으로 용도에 맞는 원페이지 보고서를 PDF로 즉시 생성합니다.
        </p>
        <PdfExportButtons result={result} />
      </div>

      {/* ── 1. Executive Insight Panel (NEW) ─────────────────────── */}
      {strategic_action_summary && (
        <ExecutiveInsightPanel
          summary={strategic_action_summary}
          strengths={absolute_strengths ?? []}
          weaknesses={critical_weaknesses ?? []}
        />
      )}

      {/* ── 1b. Executive Summary (기존 — 상세 narrative) ────────── */}
      <div className="card p-6 border-l-4 border-brand-600">
        <SectionHeader icon={<BarChart2 className="h-4 w-4" />} title="Executive Summary" />
        <p className="text-sm text-slate-700 leading-relaxed">
          {final_report.executive_summary}
        </p>
        {final_report.competitive_analysis_summary && (
          <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
            {final_report.competitive_analysis_summary}
          </p>
        )}
      </div>

      {/* ── 2. Market Overview + Positioning ─────────────────────── */}
      <div className="card p-6">
        <SectionHeader icon={<Globe className="h-4 w-4" />} title="시장 포지셔닝 분석" />
        {market_overview && (
          <p className="text-sm text-slate-500 leading-relaxed mb-3 pb-3 border-b border-slate-100">
            {market_overview}
          </p>
        )}
        <p className="text-sm text-slate-700 leading-relaxed">
          {final_report.positioning_summary || result.market_positioning}
        </p>
      </div>

      {/* ── 3. Pricing Intelligence (NEW) ────────────────────────── */}
      {pricing_intelligence?.entries?.length > 0 && (
        <PricingIntelligenceSection data={pricing_intelligence} />
      )}

      {/* ── 3b. Phase 1: Market Scan Table (with checkboxes) ──────── */}
      {phase1_competitors.length > 0 && (
        <div className="card p-6">
          <SectionHeader
            icon={<Building2 className="h-4 w-4" />}
            title={`전체 시장 경쟁사 스캔 — Phase 1 (${phase1_competitors.length}개)`}
          />
          <p className="text-xs text-slate-400 mb-4">
            시장 내 잠재적 경쟁사를 광범위하게 나열한 목록입니다. 위협도(relevance_score) 기준 내림차순 정렬.
          </p>

          {/* Selection action bar */}
          <SelectionActionBar
            selectedCount={selectedNames.size}
            onSingle={handleDeepDive}
            onComparison={handleDeepDive}
            onClear={clearSelection}
            isLoading={false}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-3 font-semibold text-slate-500 w-8">
                    <span className="sr-only">선택</span>
                  </th>
                  <th className="py-2 pr-3 font-semibold text-slate-500 w-6">#</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">기업명</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">유형</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500 min-w-[180px]">설명</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">예상 점유율</th>
                  <th className="py-2 pr-3 font-semibold text-slate-500">투자/설립</th>
                  <th className="py-2 font-semibold text-slate-500">위협도</th>
                </tr>
              </thead>
              <tbody>
                {phase1_competitors.map((c, i) => {
                  const checked = selectedNames.has(c.name);
                  return (
                    <tr
                      key={c.name}
                      onClick={() => toggleSelect(c.name)}
                      className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${
                        checked
                          ? "bg-brand-50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            checked
                              ? "bg-brand-600 border-brand-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {checked && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        {c.website && (
                          <a
                            href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-brand-600 hover:text-brand-700 mt-0.5"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            <span className="text-xs">웹사이트</span>
                          </a>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <CompetitorTypeBadge type={c.type} />
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 leading-relaxed max-w-xs">
                        {c.description}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {c.market_share_estimate || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                        <div>{c.funding_info || <span className="text-slate-400">—</span>}</div>
                        {c.founded_year && (
                          <div className="text-slate-400">{c.founded_year}년 설립</div>
                        )}
                      </td>
                      <td className="py-2.5">
                        <ThreatBar score={c.relevance_score} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4b. Spec Comparison (NEW) ─────────────────────────────── */}
      {spec_comparison?.rows?.length > 0 && (
        <SpecComparisonSection data={spec_comparison} />
      )}

      {/* ── 4. Phase 2: Deep Competitor Profiles (with checkboxes) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-slate-500" />
          <h2 className="section-title">
            핵심 경쟁사 심층 분석 — Phase 2 ({competitors.length}개 선정)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Phase 1 목록에서 AI가 선정한 가장 위협적인 경쟁사에 대한 심층 프로필입니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {directCompetitors.map((c) => (
            <div key={c.name} className="card p-5">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium flex-shrink-0 ml-2">
                  직접 경쟁
                </span>
              </div>
              {c.estimated_market_position && (
                <p className="text-xs text-slate-500 mb-2 italic">{c.estimated_market_position}</p>
              )}
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{c.description}</p>
              {c.key_products.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">핵심 제품/서비스</p>
                  <div className="flex flex-wrap gap-1">
                    {c.key_products.map((p) => (
                      <span key={p} className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {c.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-emerald-700 mb-1">강점</p>
                  <ul className="space-y-0.5">
                    {c.strengths.map((s) => (
                      <li key={s} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-1 flex-shrink-0">+</span>
                        <span className="text-xs text-slate-600">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.weaknesses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">약점 (차별화 기회)</p>
                  <ul className="space-y-0.5">
                    {c.weaknesses.map((w) => (
                      <li key={w} className="flex items-start gap-1.5">
                        <span className="text-red-400 mt-1 flex-shrink-0">-</span>
                        <span className="text-xs text-slate-600">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.website && (
                <a
                  href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-brand-600 hover:text-brand-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  {c.website}
                </a>
              )}
            </div>
          ))}

          {indirectCompetitors.map((c) => (
              <div key={c.name} className="card p-5 border-dashed">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium flex-shrink-0 ml-2">
                    간접/대체재
                  </span>
                </div>
                {c.estimated_market_position && (
                  <p className="text-xs text-slate-500 mb-2 italic">{c.estimated_market_position}</p>
                )}
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{c.description}</p>
                {c.strengths.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-emerald-700 mb-1">강점</p>
                    <ul className="space-y-0.5">
                      {c.strengths.map((s) => (
                        <li key={s} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-1 flex-shrink-0">+</span>
                          <span className="text-xs text-slate-600">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
          ))}
        </div>
      </div>

      {/* ── 5b. Competitive SWOT Dashboard (NEW) ─────────────────── */}
      {(absolute_strengths?.length > 0 || critical_weaknesses?.length > 0) && (
        <CompetitiveSwotDashboard
          strengths={absolute_strengths ?? []}
          weaknesses={critical_weaknesses ?? []}
        />
      )}

      {/* ── 5. Opportunities & Threats ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            title="시장 기회 요소"
          />
          <BulletList items={final_report.market_opportunities} variant="opportunity" />
        </div>
        <div className="card p-5">
          <SectionHeader
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            title="위협 요소 및 리스크"
          />
          <BulletList items={final_report.threat_factors} variant="threat" />
        </div>
      </div>

      {/* ── 6. Graph RAG Insights ─────────────────────────────────── */}
      <div className="card p-6">
        <SectionHeader icon={<Network className="h-4 w-4" />} title="Graph RAG 기반 인사이트" />

        {graph_insights.length > 0 && (
          <div className="mb-5 space-y-2">
            {graph_insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <ArrowRight className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        )}

        {knowledge_graph.nodes?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">
              지식 그래프 노드
            </p>
            <div className="space-y-2">
              {(["company", "product", "trend", "threat"] as const).map((nodeType) => {
                const nodes = nodesByType[nodeType];
                if (!nodes?.length) return null;
                return (
                  <div key={nodeType} className="flex flex-wrap gap-2 items-center">
                    {nodes.map((node) => (
                      <div key={node.id} className="flex items-center gap-1.5" title={node.description}>
                        <NodeTypeBadge type={node.type} />
                        <span className="text-xs text-slate-700 font-medium">{node.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {knowledge_graph.edges?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
              주요 관계 (Edges)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-medium text-slate-500">Source</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Relation</th>
                    <th className="text-left py-2 pl-4 font-medium text-slate-500">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledge_graph.edges.slice(0, 10).map((edge, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-4 text-slate-700">{edge.source}</td>
                      <td className="py-1.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {edge.relation}
                        </span>
                      </td>
                      <td className="py-1.5 pl-4 text-slate-700">{edge.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Strategic Recommendations ─────────────────────────── */}
      <div className="card p-6">
        <SectionHeader icon={<Shield className="h-4 w-4" />} title="전략적 권고사항" />
        <BulletList items={final_report.strategic_recommendations} variant="recommendation" />
      </div>

      {/* ── 8. References ────────────────────────────────────────── */}
      {references.length > 0 && (
        <div className="card p-6">
          <SectionHeader
            icon={<BookOpen className="h-4 w-4" />}
            title="Reference — 참고 문헌 및 출처"
          />
          <div className="space-y-0">
            {references.map((ref, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                <span className="flex-shrink-0 text-xs font-medium text-slate-400 w-5 pt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 truncate">{ref.title}</p>
                    <span className="flex-shrink-0 text-xs text-slate-400 font-mono">{ref.source}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{ref.snippet}</p>
                  {ref.url && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {ref.url.length > 60 ? ref.url.slice(0, 60) + "..." : ref.url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400 italic">
            위 자료는 AI 에이전트가 수집한 정보를 포함하며, 내용의 정확성은 원문 출처를 통해 직접 확인하시기 바랍니다.
          </p>
        </div>
      )}

    </div>
  );
}
