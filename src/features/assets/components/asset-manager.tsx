"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { fetchAssets, removeAsset, sendAsset } from "../client";
import { IMAGE_MIME_TYPES, MAX_PRODUCT_ASSETS, validateFile } from "../schemas";
import type { AssetList } from "../types";
import { requestAssetAnalysis } from "@/features/asset-analysis/client";
import { AnalysisResultCard, ASSET_TYPE_LABELS } from "@/features/asset-analysis/components/analysis-result";
import { isActiveAnalysis, readAnalysis } from "@/features/asset-analysis/schemas";
import { ExtractionPanel } from "@/features/detail-extraction/components/extraction-panel";
import { isDerived, isExtractionActive, isSaveActive, readExtraction } from "@/features/detail-extraction/schemas";
import { assetProvenanceLabel } from "@/features/visual-assets/policy";
import { imageCategory } from "@/features/detail-extraction/policy";

type Selection = { file: File; status: "ready" | "uploading" | "success" | "error"; message?: string };
const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "이미지 작업을 완료하지 못했습니다.";

function AssetThumbnail({ url, filename, onDimensions }: { url: string | null; filename: string; onDimensions: (width: number, height: number) => void }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <Image src={url} alt={filename} fill unoptimized className="object-contain p-3" onError={() => setFailed(true)} onLoad={e => onDimensions(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />
    : <p className="px-4 text-center text-xs leading-5 text-zinc-500">미리보기를 불러올 수 없습니다.<br />목록을 새로고침해 주세요.</p>;
}

export function AssetManager({ projectId, initialList }: { projectId: string; initialList: AssetList }) {
  const [list, setList] = useState(initialList);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const extractionItem = list.items.find(item => item.asset.id === extractionId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const locked = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number; success: number; failed: number } | null>(null);
  const hasActiveAnalysis = list.items.some(({ asset }) => isActiveAnalysis(readAnalysis(asset.metadata), now) || isExtractionActive(readExtraction(asset.metadata), now) || isSaveActive(readExtraction(asset.metadata), now));
  const analysisTargets = list.items.filter(({ asset }) => {
    const state = readAnalysis(asset.metadata);
    return state?.status !== "completed" && !isActiveAnalysis(state, now);
  }).map(({ asset }) => asset.id);

  async function refresh() { setList(await fetchAssets(projectId)); }

  useEffect(() => {
    if (!hasActiveAnalysis) return;
    const interval = window.setInterval(async () => {
      setNow(Date.now());
      if (locked.current || document.visibilityState !== "visible") return;
      locked.current = true;
      try { setList(await fetchAssets(projectId)); }
      catch { setError("분석 진행 상태를 확인하지 못했습니다. 목록을 새로고침해 주세요."); }
      finally { locked.current = false; }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [hasActiveAnalysis, projectId]);

  async function analyze(ids: string[]) {
    if (locked.current || !ids.length) return;
    locked.current = true; setBusy(true); setError(""); setMessage(""); setConfirmId(null);
    setProgress({ done: 0, total: ids.length, success: 0, failed: 0 });
    try {
      for (const id of ids) {
        setAnalyzingId(id); setAnalysisErrors((current) => ({ ...current, [id]: "" }));
        const reply = await requestAssetAnalysis(projectId, id);
        const updated = reply.asset;
        if (updated) setList((current) => ({ ...current, items: current.items.map((item) => item.asset.id === id ? { ...item, asset: updated } : item) }));
        if (!reply.ok) setAnalysisErrors((current) => ({ ...current, [id]: reply.message }));
        setProgress((current) => current && ({ ...current, done: current.done + 1, success: current.success + (reply.ok ? 1 : 0), failed: current.failed + (reply.ok ? 0 : 1) }));
        setNow(Date.now());
      }
      await refresh();
    } catch { setError("분석 목록을 갱신하지 못했습니다. 목록 새로고침으로 저장 결과를 확인해 주세요."); }
    finally { locked.current = false; setBusy(false); setAnalyzingId(null); }
  }

  useEffect(() => {
    // 5분 URL 만료 전에 갱신하며, 백그라운드 탭에서 복귀할 때도 다시 발급한다.
    async function renew() {
      if (locked.current || document.visibilityState !== "visible") return;
      locked.current = true;
      try { setList(await fetchAssets(projectId)); }
      catch { setError("미리보기를 갱신하지 못했습니다. 목록 새로고침을 눌러 주세요."); }
      finally { locked.current = false; }
    }
    if (Date.now() >= initialList.expiresAt - 30_000) void renew();
    const interval = window.setInterval(renew, 240_000);
    document.addEventListener("visibilitychange", renew);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", renew); };
  }, [projectId, initialList.expiresAt]);

  async function upload() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setMessage(""); setConfirmId(null);
    let succeeded = 0, failed = selection.filter((item) => item.status === "error").length;
    try {
      for (let index = 0; index < selection.length; index++) {
        const item = selection[index];
        if (item.status !== "ready") continue;
        setSelection((current) => current.map((entry, position) => position === index ? { ...entry, status: "uploading" } : entry));
        try {
          await sendAsset(projectId, item.file); succeeded++;
          setSelection((current) => current.map((entry, position) => position === index ? { ...entry, status: "success" } : entry));
        } catch (cause) {
          failed++;
          setSelection((current) => current.map((entry, position) => position === index ? { ...entry, status: "error", message: errorMessage(cause) } : entry));
        }
      }
      setMessage(`업로드 결과: 성공 ${succeeded}개${failed ? `, 실패 ${failed}개` : ""}.`);
      await refresh();
    } catch { setError("목록 갱신에 실패했습니다. 다시 업로드하기 전에 목록 새로고침으로 저장 여부를 확인해 주세요."); }
    finally { locked.current = false; setBusy(false); }
  }

  async function deleteImage(id: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try { await removeAsset(projectId, id); setConfirmId(null); setMessage("이미지를 삭제했습니다."); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }

  return (
    <div className="space-y-6" aria-busy={busy}>
      <section className="panel p-6 sm:p-8" aria-labelledby="upload-title">
        <h2 id="upload-title" className="text-lg font-semibold">제품 이미지 등록</h2>
        <p id="upload-hint" className="mt-2 text-sm leading-6 text-zinc-500">JPEG, PNG, WebP · 파일당 최대 10MB · 상품당 최대 30개. 여러 장을 선택하면 선택 순서대로 업로드합니다.</p>
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 sm:p-6">
          <label htmlFor="product-images" className="mb-3 block text-sm font-medium">이미지 파일 선택</label>
          <input id="product-images" type="file" multiple accept={IMAGE_MIME_TYPES.join(",")} disabled={busy}
            aria-describedby="upload-hint" className="block w-full min-w-0 text-sm text-zinc-600 file:mr-4 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-4 file:py-3 file:text-sm file:font-medium file:text-zinc-900 disabled:opacity-50"
            onChange={(event) => {
              if (locked.current) { event.target.value = ""; return; }
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (!files.length) return;
              let available = Math.max(0, MAX_PRODUCT_ASSETS - list.items.length);
              setSelection(files.map((file): Selection => {
                try {
                  validateFile(file.type, file.size);
                  if (available <= 0) throw new Error("상품당 이미지는 최대 30개입니다. 기존 이미지를 삭제한 뒤 다시 선택해 주세요.");
                  available--;
                  return { file, status: "ready" };
                } catch (cause) { return { file, status: "error", message: errorMessage(cause) }; }
              }));
              setError(""); setMessage("");
            }} />
        </div>
        {selection.length > 0 && (
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-medium">선택한 파일 {selection.length}개</h3>
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 px-4" aria-live="polite" aria-relevant="text">
              {selection.map((item, index) => (
                <li key={index} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-all">{item.file.name} <span className="text-xs text-zinc-500">({sizeLabel(item.file.size)})</span></span>
                    <span className={item.status === "error" ? "text-red-700" : item.status === "success" ? "text-emerald-800" : "text-zinc-500"}>
                      {{ ready: "대기", uploading: "업로드 중…", success: "업로드 완료", error: "실패" }[item.status]}
                    </span>
                  </div>
                  {item.message && <p className="mt-1 text-xs leading-5 text-red-700">{item.message}</p>}
                </li>
              ))}
            </ul>
            <button type="button" className="button-primary" disabled={busy || !selection.some((item) => item.status === "ready")} onClick={upload}>
              {busy ? "처리 중…" : `선택 이미지 업로드 (${selection.filter((item) => item.status === "ready").length})`}
            </button>
            <p className="text-xs leading-5 text-zinc-500">실패한 파일은 원인을 확인한 뒤 다시 선택하세요. 이미 업로드한 파일은 목록에 유지됩니다.</p>
          </div>
        )}
      </section>

      <div aria-live="polite" className="empty:hidden">
        {message && <p role="status" className="text-sm text-zinc-700">{message}</p>}
        {error && <p role="alert" className="mt-2 text-sm leading-6 text-red-700">{error}</p>}
      </div>

      <section className="panel p-6 sm:p-8" aria-labelledby="image-list-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="image-list-title" className="text-lg font-semibold">등록된 이미지 <span className="ml-2 text-sm font-normal text-zinc-500">{list.items.length} / {MAX_PRODUCT_ASSETS}</span></h2>
          <button type="button" className="button-secondary" disabled={busy} onClick={async () => {
            if (locked.current) return;
            locked.current = true; setBusy(true); setError("");
            try { await refresh(); setAnalysisErrors({}); } catch (cause) { setError(errorMessage(cause)); }
            finally { locked.current = false; setBusy(false); }
          }}>목록 새로고침</button>
        </div>
        {list.items.length > 0 && <div className="mt-5 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">AI 이미지 분석</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">미분석·실패 이미지를 순서대로 분석합니다. 완료 이미지는 카드에서 재분석할 수 있습니다.</p>
            </div>
            <button type="button" className="button-primary" disabled={busy || !analysisTargets.length} onClick={() => analyze(analysisTargets)}>
              AI 이미지 분석 ({analysisTargets.length})
            </button>
          </div>
          <p className="text-xs leading-5 text-zinc-500">AI 결과는 시각적 관찰이며 상품 사실정보가 아닙니다. 대표 이미지 적합도는 최종 대표 이미지 선택을 의미하지 않습니다.</p>
          {progress && <p role="status" className="text-sm text-zinc-700">{progress.done} / {progress.total} 분석 처리 · 성공 {progress.success}개 · 실패 {progress.failed}개</p>}
        </div>}
        {!list.items.length ? <p className="py-16 text-center text-sm text-zinc-500">아직 등록된 이미지가 없습니다.</p> : (
          <ul className="mt-6 grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.items.map(({ asset, previewUrl }, index) => (
              <li key={asset.id} className="min-w-0 overflow-hidden rounded-lg border border-zinc-200">
                <div className="relative flex aspect-square items-center justify-center border-b border-zinc-100 bg-zinc-50">
                  <AssetThumbnail key={previewUrl} url={previewUrl} filename={asset.originalFilename} onDimensions={(width, height) => setDimensions(current => current[asset.id]?.width === width && current[asset.id]?.height === height ? current : { ...current, [asset.id]: { width, height } })} />
                </div>
                <div className="space-y-3 p-4">
                  <p className="break-all text-sm font-medium">{index + 1}. {asset.originalFilename}</p>
                  <p className="text-xs text-zinc-500">{asset.sizeBytes === null ? "크기 정보 없음" : sizeLabel(asset.sizeBytes)} · 저장 분류: {ASSET_TYPE_LABELS[asset.assetType]}</p>
                  {isDerived(asset.metadata) ? <p className="text-xs font-medium text-zinc-600">{assetProvenanceLabel(asset, list.items.map(item => item.asset))} · {asset.width} × {asset.height}px</p>
                    : (readExtraction(asset.metadata) || imageCategory(dimensions[asset.id]?.width ?? asset.width ?? 0, dimensions[asset.id]?.height ?? asset.height ?? 0) !== "normal") && <button type="button" className="button-secondary w-full" disabled={busy} onClick={() => setExtractionId(asset.id)}>제품컷 추출{readExtraction(asset.metadata)?.latestResult ? " 후보 보기" : ""}</button>}
                  <AnalysisResultCard asset={asset} now={now} pending={analyzingId === asset.id} disabled={busy}
                    error={analysisErrors[asset.id]} onAnalyze={() => analyze([asset.id])} />
                  {confirmId === asset.id ? <div className="space-y-3">
                    <p className="text-sm text-zinc-700">이 이미지를 삭제할까요?</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy} className="button-secondary text-red-700" onClick={() => deleteImage(asset.id)}>삭제 확인</button>
                      <button type="button" disabled={busy} className="button-secondary" onClick={() => setConfirmId(null)}>취소</button>
                    </div>
                  </div> : <button type="button" disabled={busy} className="button-secondary w-full" aria-label={`${asset.originalFilename} 삭제`} onClick={() => setConfirmId(asset.id)}>삭제</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {extractionItem && <ExtractionPanel key={extractionItem.asset.id} projectId={projectId} {...extractionItem} assets={list.items.map(item => item.asset)} busy={busy} currentContextFingerprint={list.extractionContextFingerprint}
        begin={() => { if (locked.current) return false; locked.current = true; setBusy(true); return true; }} end={() => { locked.current = false; setBusy(false); setNow(Date.now()); }}
        refresh={refresh} update={asset => setList(current => ({ ...current, items: current.items.map(item => item.asset.id === asset.id ? { ...item, asset } : item) }))} close={() => setExtractionId(null)} />}
      <p className="text-sm leading-6 text-zinc-500">완료된 이미지 분석은 다음 상품 분석 단계에서 사용합니다. 상세페이지 구성은 이후 단계에서 제공됩니다.</p>
    </div>
  );
}
