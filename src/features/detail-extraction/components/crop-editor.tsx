"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Dimensions, ManualInsets, Rect } from "../schemas";
import { ZERO_INSETS, cropValidation, keyboardInsetDelta, maxEdgeInset, moveCropEdge, pointerInset, type CropEdge } from "../manual-crop-client";

const EDGES = ["left", "top", "right", "bottom"] as const;
const LABELS = { left: "왼쪽", top: "위쪽", right: "오른쪽", bottom: "아래쪽" };
const fieldsOf = (insets: ManualInsets) => Object.fromEntries(EDGES.map(edge => [edge, String(insets[edge])])) as Record<CropEdge, string>;
type Props = { base: Rect; dimensions: Dimensions; previewUrl: string | null; ready: boolean; loadError: boolean; blocked: boolean;
  initial: ManualInsets; number: number; apply: (insets: ManualInsets) => void; cancel: () => void };

export function CropEditor(props: Props) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), svg = useRef<SVGSVGElement>(null);
  const [fields, setFields] = useState(() => fieldsOf(props.initial));
  const [handleSize, setHandleSize] = useState(44);
  const insets = Object.fromEntries(EDGES.map(edge => [edge, fields[edge].trim() === "" ? NaN : Number(fields[edge])])) as ManualInsets;
  const validation = cropValidation(props.base, props.dimensions, insets), rect = validation.rect;
  const disabled = !props.ready || props.blocked, valid = !disabled && !!rect;
  const drag = useRef<{ pointerId: number; edge: CropEdge; start: DOMPoint; insets: ManualInsets; matrix: string; target: Element } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<ManualInsets | null>(null);
  function flush() { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null;
    if (pending.current) setFields(fieldsOf(pending.current)); pending.current = null; }
  function abortDrag() { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; pending.current = null;
    const current = drag.current; drag.current = null;
    if (current) { setFields(fieldsOf(current.insets)); if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId); }
  }
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null, element = dialog.current!;
    element.showModal();
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const resize = () => abortDrag(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, []);
  useEffect(() => {
    const measure = () => { const matrix = svg.current?.getScreenCTM();
      if (matrix) setHandleSize(44 / Math.hypot(matrix.a, matrix.b)); };
    const observer = new ResizeObserver(measure); observer.observe(svg.current!); measure();
    return () => observer.disconnect();
  }, []);
  const base = props.base;
  function point(event: React.PointerEvent) { return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse()); }
  function start(edge: CropEdge, event: React.PointerEvent<SVGRectElement>) {
    if (!valid || event.button !== 0 || !svg.current?.getScreenCTM()) return;
    event.preventDefault(); event.currentTarget.focus();
    drag.current = { edge, pointerId: event.pointerId, start: point(event), insets: { ...insets }, matrix: svg.current.getScreenCTM()!.toString(), target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: React.PointerEvent<SVGRectElement>) {
    const current = drag.current; if (!current || event.pointerId !== current.pointerId) return;
    if (disabled || svg.current?.getScreenCTM()?.toString() !== current.matrix) { abortDrag(); return; }
    const next = point(event);
    pending.current = moveCropEdge(base, current.insets, current.edge, pointerInset(current.edge, current.insets, { x: next.x - current.start.x, y: next.y - current.start.y }));
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (pending.current) setFields(fieldsOf(pending.current)); pending.current = null; });
  }
  const drawn = rect ?? { ...base };
  const sx = drawn.x, sy = drawn.y, ex = drawn.x + drawn.width, ey = drawn.y + drawn.height;
  return <dialog ref={dialog} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const targets = dialog.current!.querySelectorAll<HTMLElement | SVGRectElement>('button:not(:disabled), input:not(:disabled), [role="slider"][tabindex="0"]');
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={event => { event.preventDefault(); props.cancel(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-zinc-300 bg-white p-4 text-zinc-900 shadow-xl backdrop:bg-black/50 sm:p-6">
    <h2 id={`${id}-title`} className="text-lg font-semibold">후보 {props.number} 자르기 조정</h2>
    <p id={`${id}-help`} className="mt-2 text-sm leading-6">저장할 영역을 조정하세요. 원본 후보 영역 밖으로 확장할 수 없습니다.</p>
    <p className="mb-3 text-xs leading-5 text-zinc-600">수동 조정한 영역은 추가 경계 정리 없이 저장됩니다. 적용 후 후보를 선택하여 저장해 주세요.</p>
    <div className="relative flex h-[min(32dvh,420px)] min-h-40 items-center justify-center overflow-hidden rounded bg-zinc-100 sm:h-[min(40dvh,420px)]">
      <svg ref={svg} viewBox={`${base.x} ${base.y} ${base.width} ${base.height}`} className="h-full w-full" style={{ touchAction: "none" }} preserveAspectRatio="xMidYMid meet" aria-label="포함 영역과 어둡게 표시한 제외 영역">
        <defs><clipPath id={`${id}-clip`}><rect x={base.x} y={base.y} width={base.width} height={base.height} /></clipPath></defs>
        <g clipPath={`url(#${id}-clip)`}>
          {props.previewUrl && <image href={props.previewUrl} x="0" y="0" width={props.dimensions.width} height={props.dimensions.height} preserveAspectRatio="none" />}
          <path d={`M${base.x},${base.y}h${base.width}v${base.height}h${-base.width}Z M${sx},${sy}v${drawn.height}h${drawn.width}v${-drawn.height}Z`} fill="black" fillOpacity=".55" fillRule="evenodd" />
          <rect x={sx} y={sy} width={drawn.width} height={drawn.height} fill="none" stroke="black" strokeWidth="5" vectorEffect="non-scaling-stroke" />
          <rect x={sx} y={sy} width={drawn.width} height={drawn.height} fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>
        {EDGES.map(edge => {
          const x = edge === "left" ? sx : edge === "right" ? ex : sx + drawn.width / 2;
          const y = edge === "top" ? sy : edge === "bottom" ? ey : sy + drawn.height / 2;
          const size = Math.min(base.width, base.height, handleSize);
          return <rect key={edge} role="slider" tabIndex={disabled || !rect ? -1 : 0} aria-label={`${LABELS[edge]} 자르기 경계`} aria-disabled={disabled || !rect}
            aria-orientation={edge === "left" || edge === "right" ? "horizontal" : "vertical"} aria-valuemin={0}
            aria-valuemax={maxEdgeInset(base, rect ? insets : ZERO_INSETS, edge)} aria-valuenow={Number.isFinite(insets[edge]) ? insets[edge] : 0} aria-valuetext={`${insets[edge]}픽셀 제외`}
            x={Math.max(base.x, Math.min(base.x + base.width - size, x - size / 2))} y={Math.max(base.y, Math.min(base.y + base.height - size, y - size / 2))}
            width={size} height={size} rx={size * .18} fill="white" fillOpacity=".85" stroke="#18181b" strokeWidth="2" vectorEffect="non-scaling-stroke"
            style={{ touchAction: "none", cursor: edge === "left" || edge === "right" ? "ew-resize" : "ns-resize" }}
            onPointerDown={event => start(edge, event)} onPointerMove={move}
            onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) { flush(); drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
            onPointerCancel={abortDrag} onLostPointerCapture={() => { if (drag.current) abortDrag(); }}
            onKeyDown={event => { if (!valid) return; const delta = keyboardInsetDelta(edge, event.key, event.shiftKey);
              if (delta) { event.preventDefault(); setFields(fieldsOf(moveCropEdge(base, insets, edge, insets[edge] + delta))); } }} />;
        })}
      </svg>
      {!props.ready && <p role={props.loadError ? "alert" : "status"} className="absolute inset-x-2 bottom-2 rounded bg-white p-2 text-center text-sm">{props.loadError ? "이미지를 불러오지 못했습니다. 취소 후 상태 새로고침을 실행해 주세요." : "이미지 미리보기를 불러온 후 조정할 수 있습니다."}</p>}
    </div>
    <p className="mt-2 text-xs text-zinc-600">경계에서 방향키로 1px, Shift+방향키로 10px 조정할 수 있습니다. 제품이나 글자가 제외 영역에 포함되는지 확인하세요.</p>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{EDGES.map(edge => <label key={edge} className="min-w-0 text-sm" htmlFor={`${id}-${edge}`}>
      {LABELS[edge]} 제외 폭 (px)<input id={`${id}-${edge}`} className="product-input" type="number" min="0" step="1" max={maxEdgeInset(base, rect ? insets : ZERO_INSETS, edge)}
        value={fields[edge]} disabled={disabled} aria-invalid={!rect} aria-describedby={`${id}-validation`}
        onChange={event => { abortDrag(); setFields(current => ({ ...current, [edge]: event.target.value })); }} />
    </label>)}</div>
    <p className="mt-3 text-sm font-medium" aria-live="polite">저장 크기: {rect ? `${rect.width} × ${rect.height} px` : "영역을 다시 조정해 주세요."}</p>
    <p id={`${id}-validation`} className="mt-2 text-sm text-red-700" role={!rect || props.blocked ? "alert" : undefined}>{props.blocked ? "이미지 분석 결과가 변경되었습니다. 최신 후보를 확인한 뒤 다시 조정해 주세요." : validation.error}</p>
    <div className="mt-4 flex flex-wrap justify-between gap-3">
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => { abortDrag(); setFields(fieldsOf(ZERO_INSETS)); }}>후보 전체로</button>
      <div className="flex gap-2"><button type="button" className="button-secondary" onClick={props.cancel}>취소</button>
        <button type="button" className="button-primary" disabled={!valid} onClick={() => props.apply(insets)}>적용</button></div>
    </div>
  </dialog>;
}
