"use client";
import { useEffect, useRef, useState } from "react";
import { exportMessages, type ExportErrorCode } from "../errors";
export function ExportPanel({ projectId, warning }: { projectId: string; warning: boolean }) {
  const [format, setFormat] = useState<"png" | "jpg">("png"), [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);
  async function download() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setMessage("상세페이지 이미지를 만들고 있습니다.");
    const timer = setTimeout(() => controller.abort(), 95000);
    try {
      const response = await fetch(`/api/projects/${projectId}/export`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(format === "png" ? { format } : { format, quality }), signal: controller.signal });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.code && Object.hasOwn(exportMessages, error.code) ? exportMessages[error.code as ExportErrorCode] : exportMessages.unavailable);
      }
      if (response.headers.get("content-type") !== (format === "png" ? "image/png" : "image/jpeg")) throw new Error(exportMessages.screenshot);
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
      const encoded = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      link.href = url; link.download = encoded ? decodeURIComponent(encoded) : `detail-page.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("다운로드를 시작했습니다.");
    } catch (error) { setMessage(controller.signal.aborted ? exportMessages.timeout : error instanceof Error && Object.values(exportMessages).some(value => value === error.message) ? error.message : exportMessages.unavailable); }
    finally { clearTimeout(timer); active.current = null; setBusy(false); }
  }
  return <section aria-label="상세페이지 이미지 다운로드" className="panel space-y-4 p-5">
    <h2 className="font-semibold">이미지 다운로드</h2>
    <p className="text-sm text-zinc-600">현재 저장된 상세페이지를 원본 폭으로 출력합니다. 출력 파일은 서버에 저장하지 않습니다.</p>
    {warning && <p className="text-sm text-amber-900">확인이 필요한 내용이 있습니다. 위 준비 상태를 검토한 뒤 출력해 주세요.</p>}
    <fieldset disabled={busy} className="flex flex-wrap items-center gap-5"><legend className="mb-2 text-sm font-medium">파일 형식</legend>
      {(["png", "jpg"] as const).map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="export-format" value={value} checked={format === value} onChange={() => setFormat(value)} />{value.toUpperCase()}</label>)}
      {format === "jpg" && <label className="flex items-center gap-2 text-sm">JPG 품질 (60~100)<input aria-label="JPG 품질" type="number" min={60} max={100} step={1} value={quality} onChange={event => setQuality(Number(event.target.value))} className="w-20 rounded border border-zinc-300 p-2" /></label>}
    </fieldset>
    <button type="button" className="button-primary" disabled={busy || (format === "jpg" && (!Number.isInteger(quality) || quality < 60 || quality > 100))} onClick={download}>{busy ? "이미지 생성 중…" : `${format.toUpperCase()} 다운로드`}</button>
    <p role="status" aria-live="polite" className="text-sm text-zinc-600">{message}</p>
  </section>;
}
