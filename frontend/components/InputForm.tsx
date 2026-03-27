"use client";

import { FileText, Search, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const MIN_LENGTH = 50;
const MAX_LENGTH = 4000;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

interface InputFormProps {
  onSubmit: (productDescription: string) => void;
  isLoading: boolean;
}

// ──────────────────────────────────────────────────────────────────────

export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [value, setValue]           = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [isUploading, setIsUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = value.length;
  const isValid   = charCount >= MIN_LENGTH;
  const remaining = MIN_LENGTH - charCount;

  // ── File handling ─────────────────────────────────────────────────

  function isValidFile(file: File): boolean {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME.includes(file.type);
  }

  const processFile = useCallback(async (file: File) => {
    if (!isValidFile(file)) {
      setUploadError("PDF 또는 Word(.docx) 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("파일 크기는 10MB 이하여야 합니다.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }
      setValue(data.text.slice(0, MAX_LENGTH));
      setUploadedFile(file.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setUploadError(`파일 파싱 오류: ${message}`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Drag & Drop handlers ──────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  function clearFile() {
    setUploadedFile(null);
    setUploadError(null);
    setValue("");
  }

  // ── Form submit ───────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSubmit(value.trim());
  }

  // ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          placeholder={
            "귀하의 제품이나 서비스를 간략히 설명해 주세요. AI가 시장 포지셔닝을 분석하고 경쟁사를 자동 추출합니다.\n\n예시: 저희는 중소기업 인사팀을 위한 클라우드 기반 HR 자동화 SaaS를 개발했습니다. 주요 기능은 전자계약, 급여 계산, 근태 관리이며, 기존 ERP 연동 없이 독립적으로 구동됩니다."
          }
          rows={7}
          disabled={isLoading}
          className="
            w-full resize-none rounded-lg border border-slate-300 bg-white
            px-4 py-3 text-sm text-slate-900 placeholder-slate-400
            focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20
            disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400
            transition-colors duration-150
          "
        />
        <div className="absolute bottom-3 right-3 text-xs text-slate-400 select-none">
          {charCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </div>
      </div>

      {charCount > 0 && !isValid && (
        <p className="text-xs text-slate-500">
          최소 {MIN_LENGTH}자 이상 입력해 주세요.{" "}
          <span className="font-medium text-brand-600">{remaining}자 더 필요합니다.</span>
        </p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 flex-shrink-0">또는 파일 업로드</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Dropzone */}
      {uploadedFile ? (
        /* Uploaded file indicator */
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <FileText className="h-5 w-5 text-brand-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{uploadedFile}</p>
            <p className="text-xs text-slate-500">텍스트 추출 완료 — 위 입력창에서 내용을 확인하고 편집할 수 있습니다.</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* Drop target */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && !isUploading && fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2
            rounded-lg border-2 border-dashed px-6 py-8 text-center
            transition-colors duration-150 cursor-pointer select-none
            ${isDragging
              ? "border-brand-600 bg-brand-50"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
            }
            ${(isLoading || isUploading) ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="sr-only"
            onChange={handleFileInputChange}
            disabled={isLoading || isUploading}
          />

          {isUploading ? (
            <>
              <div className="w-6 h-6 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-sm text-slate-500">파일 파싱 중...</p>
            </>
          ) : (
            <>
              <Upload className={`h-6 w-6 ${isDragging ? "text-brand-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-medium ${isDragging ? "text-brand-700" : "text-slate-600"}`}>
                  파일을 드래그하거나{" "}
                  <span className="text-brand-600 underline underline-offset-2">클릭하여 업로드</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">PDF, Word(.docx) 지원 — 최대 10MB</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <span className="flex-shrink-0 font-bold">!</span>
          {uploadError}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="
          inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5
          text-sm font-semibold text-white shadow-sm
          hover:bg-brand-700 active:bg-brand-800
          disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500
          transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-600/40
        "
      >
        <Search className="h-4 w-4" />
        분석 시작
      </button>
    </form>
  );
}
