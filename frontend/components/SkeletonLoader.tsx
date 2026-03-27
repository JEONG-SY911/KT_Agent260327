"use client";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="보고서 로딩 중">
      {/* Executive Summary skeleton */}
      <div className="card p-6 border-l-4 border-brand-600">
        <SkeletonBlock className="h-4 w-40 mb-4" />
        <SkeletonBlock className="h-3 w-full mb-2" />
        <SkeletonBlock className="h-3 w-5/6 mb-2" />
        <SkeletonBlock className="h-3 w-4/6" />
      </div>

      {/* 2-column competitor cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5">
            <SkeletonBlock className="h-4 w-24 mb-3" />
            <SkeletonBlock className="h-3 w-full mb-1.5" />
            <SkeletonBlock className="h-3 w-5/6 mb-3" />
            <div className="flex gap-2 flex-wrap">
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Opportunities / Threats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="card p-5">
            <SkeletonBlock className="h-4 w-32 mb-4" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-start gap-2 mb-2.5">
                <SkeletonBlock className="h-4 w-4 mt-0.5 flex-shrink-0 rounded-full" />
                <SkeletonBlock className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Graph Insights */}
      <div className="card p-5">
        <SkeletonBlock className="h-4 w-48 mb-4" />
        <div className="flex flex-wrap gap-2">
          {[100, 80, 120, 90, 110].map((w, i) => (
            <SkeletonBlock key={i} className={`h-6 w-${w === 100 ? "24" : w === 80 ? "20" : w === 120 ? "28" : w === 90 ? "24" : "28"}`} />
          ))}
        </div>
      </div>

      {/* References */}
      <div className="card p-5">
        <SkeletonBlock className="h-4 w-36 mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
            <SkeletonBlock className="h-3 flex-1" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
