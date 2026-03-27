"use client";

import { AlertCircle, CheckCircle, Circle, Loader2 } from "lucide-react";
import type { AgentStep } from "@/types/analysis";

interface AgentProgressProps {
  steps: AgentStep[];
}

export function AgentProgress({ steps }: AgentProgressProps) {
  return (
    <div className="w-full">
      <div className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const { status, label, description, message } = step;

          return (
            <div key={step.step} className="flex gap-4">
              {/* Icon column with connector line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-full border-2 flex-shrink-0
                    transition-colors duration-300
                    ${status === "complete" ? "bg-brand-600 border-brand-600" : ""}
                    ${status === "active"   ? "bg-white border-brand-600" : ""}
                    ${status === "pending"  ? "bg-white border-slate-200" : ""}
                    ${status === "error"    ? "bg-red-50 border-red-500" : ""}
                  `}
                >
                  {status === "complete" && (
                    <CheckCircle className="w-5 h-5 text-white" />
                  )}
                  {status === "active" && (
                    <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                  )}
                  {status === "pending" && (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                  {status === "error" && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {!isLast && (
                  <div
                    className={`
                      w-0.5 flex-1 min-h-[2rem] mt-1 transition-colors duration-300
                      ${status === "complete" ? "bg-brand-200" : "bg-slate-200"}
                    `}
                  />
                )}
              </div>

              {/* Text content */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className={`
                      text-sm font-semibold transition-colors duration-200
                      ${status === "active"   ? "text-brand-700" : ""}
                      ${status === "complete" ? "text-slate-900" : ""}
                      ${status === "pending"  ? "text-slate-400" : ""}
                      ${status === "error"    ? "text-red-600" : ""}
                    `}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-slate-400">{description}</span>
                </div>

                <p
                  className={`
                    text-sm transition-colors duration-200
                    ${status === "active"   ? "text-brand-600" : ""}
                    ${status === "complete" ? "text-slate-500" : ""}
                    ${status === "pending"  ? "text-slate-400" : ""}
                    ${status === "error"    ? "text-red-500" : ""}
                  `}
                >
                  {message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
