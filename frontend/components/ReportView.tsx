"use client";

import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ArrowRight    from "lucide-react/dist/esm/icons/arrow-right";
import BookOpen      from "lucide-react/dist/esm/icons/book-open";
import Building2     from "lucide-react/dist/esm/icons/building-2";
import ExternalLink  from "lucide-react/dist/esm/icons/external-link";
import Lightbulb     from "lucide-react/dist/esm/icons/lightbulb";
import MapPin        from "lucide-react/dist/esm/icons/map-pin";
import ShieldAlert   from "lucide-react/dist/esm/icons/shield-alert";
import Target        from "lucide-react/dist/esm/icons/target";
import TrendingUp    from "lucide-react/dist/esm/icons/trending-up";
import Zap           from "lucide-react/dist/esm/icons/zap";
import type { AnalysisResult, MarketMaturity, Phase1CompetitorItem } from "@/types/analysis";
import { PdfExportButtons } from "@/components/PdfExportButtons";

interface ReportViewProps {
  result: AnalysisResult;
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="text-slate-500">{icon}</div>
      <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function BulletList({
  items,
  variant = "default",
}: {
  items: string[];
  variant?: "default" | "barrier" | "diff" | "risk" | "action";
}) {
  const dot: Record<string, string> = {
    default: "bg-slate-400",
    barrier: "bg-amber-500",
    diff: "bg-emerald-500",
    risk: "bg-red-500",
    action: "",
  };

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          {variant === "action" ? (
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-brand-600 text-white text-xs font-bold">
              {i + 1}
            </span>
          ) : (
            <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2 ${dot[variant]}`} />
          )}
          <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function MaturityBadge({ maturity }: { maturity: MarketMaturity }) {
  const map: Record<MarketMaturity, { color: string; desc: string }> = {
    도입기: { color: "bg-violet-100 text-violet-700 border-violet-200", desc: "초기 시장 — 선점 기회" },
    성장기: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", desc: "빠른 성장 — 진입 적기" },
    성숙기: { color: "bg-amber-100 text-amber-700 border-amber-200",   desc: "성숙 시장 — 차별화 필수" },
    쇠퇴기: { color: "bg-red-100 text-red-700 border-red-200",         desc: "쇠퇴 — 진입 신중 검토" },
  };
  const { color, desc } = map[maturity] ?? map["성장기"];
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
        {maturity}
      </span>
      <span className="text-xs text-slate-500">{desc}</span>
    </div>
  );
}

function ThreatBar({ score }: { score: number }) {
  const filled = Math.round(score / 2);
  const color = score >= 8 ? "bg-red-500" : score >= 5 ? "bg-amber-500" : "bg-slate-400";
  const textColor = score >= 8 ? "text-red-600" : score >= 5 ? "text-amber-600" : "text-slate-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`w-1.5 h-3.5 rounded-sm ${i < filled ? color : "bg-slate-200"}`} />
        ))}
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{score}/10</span>
    </div>
  );
}

function CompetitorTypeBadge({ type }: { type: Phase1CompetitorItem["type"] }) {
  const map: Record<Phase1CompetitorItem["type"], { label: string; className: string }> = {
    direct:   { label: "직접",   className: "bg-blue-50 text-blue-700 border-blue-200" },
    indirect: { label: "간접",   className: "bg-slate-100 text-slate-600 border-slate-200" },
    adjacent: { label: "인접",   className: "bg-violet-50 text-violet-700 border-violet-200" },
  };
  const { label, className } = map[type] ?? map.indirect;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

export function ReportView({ result }: ReportViewProps) {
  const { final_report, phase1_competitors, competitors, raw_research, market_overview } = result;

  const references = Array.from(
    new Map(raw_research.map((r) => [r.url, r])).values()
  ).slice(0, 10);

  return (
    <div className="space-y-5">

      {/* ── PDF 내보내기 버튼 ────────────────────────────────────────── */}
      <PdfExportButtons result={result} />

      {/* ── 1. 요약 ─────────────────────────────────────────────────── */}
      <div className="card p-5 border-l-4 border-brand-600">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">요약</p>
        <p className="text-sm text-slate-800 leading-relaxed">{final_report.executive_summary}</p>
        {market_overview && (
          <p className="mt-2 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
            {market_overview}
          </p>
        )}
      </div>

      {/* ── 2. 시장 규모 ────────────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="시장 규모" />
        <div className="mb-4">
          <MaturityBadge maturity={final_report.market_maturity} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "TAM", desc: "전체 시장", value: final_report.market_size_tam, color: "border-slate-300" },
            { label: "SAM", desc: "유효 시장", value: final_report.market_size_sam, color: "border-brand-400" },
            { label: "SOM", desc: "획득 가능", value: final_report.market_size_som, color: "border-emerald-400" },
          ].map(({ label, desc, value, color }) => (
            <div key={label} className={`rounded-lg border-2 ${color} p-3`}>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-sm font-bold text-slate-800">{label}</span>
                <span className="text-xs text-slate-400">{desc}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. 경쟁 구도 ────────────────────────────────────────────── */}
      {phase1_competitors.length > 0 && (
        <div className="card p-5">
          <SectionHeader
            icon={<Building2 className="h-4 w-4" />}
            title={`경쟁사 스캔 — ${phase1_competitors.length}개`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-3 font-medium text-slate-500">기업명</th>
                  <th className="py-2 pr-3 font-medium text-slate-500">유형</th>
                  <th className="py-2 pr-3 font-medium text-slate-500 min-w-[160px]">설명</th>
                  <th className="py-2 pr-3 font-medium text-slate-500">점유율</th>
                  <th className="py-2 font-medium text-slate-500">위협도</th>
                </tr>
              </thead>
              <tbody>
                {phase1_competitors.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      {c.website && (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-brand-600 hover:text-brand-700"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span>사이트</span>
                        </a>
                      )}
                    </td>
                    <td className="py-2 pr-3"><CompetitorTypeBadge type={c.type} /></td>
                    <td className="py-2 pr-3 text-slate-600 max-w-xs">{c.description}</td>
                    <td className="py-2 pr-3 text-slate-600">{c.market_share_estimate || "—"}</td>
                    <td className="py-2"><ThreatBar score={c.relevance_score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phase 2 핵심 경쟁사 */}
          {competitors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-3">핵심 경쟁사 심층 분석 ({competitors.length}개)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {competitors.map((c) => (
                  <div key={c.name} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                      <CompetitorTypeBadge type={c.type as Phase1CompetitorItem["type"]} />
                    </div>
                    {c.strengths?.length > 0 && (
                      <div className="mb-1.5">
                        <p className="text-xs font-medium text-emerald-700 mb-1">강점</p>
                        {c.strengths.map((s: string) => (
                          <p key={s} className="text-xs text-slate-600 flex gap-1"><span className="text-emerald-500">+</span>{s}</p>
                        ))}
                      </div>
                    )}
                    {c.weaknesses?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-1">약점 (기회)</p>
                        {c.weaknesses.map((w: string) => (
                          <p key={w} className="text-xs text-slate-600 flex gap-1"><span className="text-red-400">-</span>{w}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. 진입 전략 3분할 ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 진입 장벽 */}
        <div className="card p-5">
          <SectionHeader icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} title="진입 장벽" />
          <BulletList items={final_report.entry_barriers} variant="barrier" />
        </div>
        {/* 차별화 포인트 */}
        <div className="card p-5">
          <SectionHeader icon={<Zap className="h-4 w-4 text-emerald-500" />} title="차별화 포인트" />
          <BulletList items={final_report.differentiation_points} variant="diff" />
        </div>
        {/* GTM */}
        <div className="card p-5">
          <SectionHeader icon={<Target className="h-4 w-4 text-brand-600" />} title="Go-to-Market" />
          <BulletList items={final_report.gtm_channels} variant="default" />
          {final_report.first_customer_hint && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-1">첫 고객 확보</p>
              <p className="text-xs text-slate-600 leading-relaxed">{final_report.first_customer_hint}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. 진입 경로 + 리스크 ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <SectionHeader icon={<MapPin className="h-4 w-4" />} title="권장 진입 경로" />
          <p className="text-sm text-slate-700 leading-relaxed">{final_report.entry_route}</p>
        </div>
        <div className="card p-5">
          <SectionHeader icon={<AlertTriangle className="h-4 w-4 text-red-500" />} title="리스크 시나리오" />
          <BulletList items={final_report.risk_scenarios} variant="risk" />
        </div>
      </div>

      {/* ── 6. 액션 플랜 ────────────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader icon={<Lightbulb className="h-4 w-4 text-brand-600" />} title="액션 플랜" />
        <BulletList items={final_report.strategic_recommendations} variant="action" />
      </div>

      {/* ── 7. 출처 ─────────────────────────────────────────────────── */}
      {references.length > 0 && (
        <div className="card p-5">
          <SectionHeader icon={<BookOpen className="h-4 w-4" />} title="참고 출처" />
          <div className="space-y-0">
            {references.map((ref, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-400 w-4 pt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{ref.title}</p>
                  {ref.url && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-0.5 text-xs text-brand-600 hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {ref.url.length > 55 ? ref.url.slice(0, 55) + "..." : ref.url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
