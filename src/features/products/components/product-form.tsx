"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { saveProductAction } from "../actions";
import { MAX_SPECIFICATIONS, type ProductInput } from "../schemas";
import type { ProductSaveState } from "../types";
import { ImportPanel, type ImportPreview } from "@/features/wholesale-import/components/import-panel";
import { saveConfirmedImport } from "@/features/wholesale-import/client";
import { readProductFormData } from "../mappers";

type TextField = "productName" | "brand" | "category" | "description" | "sourceUrl";
const emptyValues: ProductInput = {
  productName: "", brand: "", category: "", description: "", sourceUrl: "", specifications: [],
};
function formValues(values: ProductInput | null) {
  const input = values ?? emptyValues;
  const rows = input.specifications.length ? input.specifications : [{ name: "", value: "" }];
  return { ...input, specifications: rows.map((row, rowKey) => ({ ...row, rowKey })) };
}
const textFields = [
  { name: "productName", label: "상품명", max: 200, required: true, placeholder: "상품명을 입력하세요" },
  { name: "brand", label: "브랜드", max: 100, placeholder: "브랜드명" },
  { name: "category", label: "카테고리", max: 100, placeholder: "예: 생활용품" },
  { name: "sourceUrl", label: "원본 상품 URL", max: 2048, placeholder: "https://", type: "url" },
] as const;

export function ProductForm({ projectId, initialValues, revision }: {
  projectId: string; initialValues: ProductInput | null; revision: string;
}) {
  const [values, setValues] = useState(() => formValues(initialValues));
  const [showFeedback, setShowFeedback] = useState(true);
  const [importPreview,setImportPreview]=useState<ImportPreview|null>(null),[selectedImages,setSelectedImages]=useState<string[]>([]);
  const [importBusy,setImportBusy]=useState(false),[imageResults,setImageResults]=useState<string[]>([]);
  const beforeImport=useRef(values);
  const submitting = useRef(false);
  const nextRowKey = useRef(values.specifications.length);
  const [state, formAction, pending] = useActionState<ProductSaveState, FormData>(
    async (previous, formData) => {
      try {
        const result = importPreview ? await saveConfirmedImport(projectId,{token:importPreview.token,revision:formData.get("revision"),values:readProductFormData(formData),selectedImageUrls:selectedImages},setImageResults) : await saveProductAction(projectId, previous, formData);
        if (result.status === "success" && result.values) {
          const normalized = formValues(result.values);
          setValues(normalized);
          nextRowKey.current = normalized.specifications.length;
          if(importPreview){
            setImportPreview(null);setSelectedImages([]);beforeImport.current=normalized;
          }
        }
        setShowFeedback(true);
        return result;
      } catch {
        setShowFeedback(true);
        return { status: "recovery-required", message: "저장 결과를 확인하지 못했습니다. 화면을 새로 열어 저장 내용을 확인해 주세요." };
      } finally { submitting.current = false; }
    }, { status: "idle" },
  );
  const blocked = pending || importBusy || state.status === "recovery-required";
  const hasSavedProduct = Boolean(state.revision ?? revision);
  const errors = showFeedback && !pending ? state.fieldErrors : undefined;
  const changeField = (field: TextField, value: string) => {
    setShowFeedback(false);
    setValues((current) => ({ ...current, [field]: value }));
  };
  const changeSpecification = (rowKey: number, field: "name" | "value", value: string) => {
    setShowFeedback(false);
    setValues((current) => ({ ...current, specifications: current.specifications.map((row) =>
      row.rowKey === rowKey ? { ...row, [field]: value } : row) }));
  };

  return (
    <div className="space-y-6"><ImportPanel projectId={projectId} disabled={pending||state.status==="recovery-required"} preview={importPreview} selected={selectedImages} onSelection={setSelectedImages} onBusy={setImportBusy}
      onReady={preview=>{if(!importPreview)beforeImport.current=values;setImportPreview(preview);const product=preview.candidate.product;const normalized=formValues({productName:product.name??"",brand:product.brand??"",category:product.category??"",description:product.description??"",sourceUrl:preview.candidate.sourceUrl,specifications:product.specifications});setValues(normalized);nextRowKey.current=normalized.specifications.length;setSelectedImages(preview.candidate.images.filter(image=>image.selected).map(image=>image.url));setShowFeedback(false);setImageResults([]);}}
      onDiscard={()=>{setValues(beforeImport.current);nextRowKey.current=Math.max(0,...beforeImport.current.specifications.map(row=>row.rowKey+1));setImportPreview(null);setSelectedImages([]);setShowFeedback(false);}}/>
    <form action={formAction} aria-busy={pending} className="space-y-6" onSubmit={(event) => {
      if (blocked || submitting.current) event.preventDefault();
      else submitting.current = true;
    }}>
      <input type="hidden" name="revision" value={state.revision ?? revision} />
      <fieldset disabled={blocked} className="space-y-6">
        <legend className="sr-only">상품정보 입력</legend>
        <section aria-labelledby="product-information-title" className="panel p-6 sm:p-8">
          <h2 id="product-information-title" className="text-lg font-semibold">상품정보</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">확인할 수 있는 상품정보를 입력하세요. 상품명만 필수입니다.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {textFields.map((field) => (
              <div key={field.name} className={field.name === "productName" || field.name === "sourceUrl" ? "sm:col-span-2" : ""}>
                <label htmlFor={field.name} className="text-sm font-medium">
                  {field.label} {field.name === "productName" && <span className="text-zinc-500">(필수)</span>}
                </label>
                <input id={field.name} name={field.name} type={field.name === "sourceUrl" ? "url" : "text"}
                  required={field.name === "productName"} maxLength={field.max} placeholder={field.placeholder}
                  readOnly={field.name === "sourceUrl" && !!importPreview}
                  value={values[field.name]} onChange={(event) => changeField(field.name, event.target.value)}
                  aria-invalid={Boolean(errors?.[field.name])}
                  aria-describedby={errors?.[field.name] ? `${field.name}-error` : undefined}
                  className="product-input" />
                {errors?.[field.name] && <p id={`${field.name}-error`} className="mt-2 text-sm text-red-700">{errors[field.name]}</p>}
              </div>
            ))}
            <div className="sm:col-span-2">
              <label htmlFor="description" className="text-sm font-medium">상품 설명</label>
              <textarea id="description" name="description" rows={5} maxLength={5000}
                value={values.description} onChange={(event) => changeField("description", event.target.value)}
                aria-invalid={Boolean(errors?.description)}
                aria-describedby={errors?.description ? "description-hint description-error" : "description-hint"}
                className="product-input resize-y" placeholder="사용자가 제공한 상품 설명을 입력하세요." />
              <p id="description-hint" className="mt-2 text-xs text-zinc-500">최대 5,000자 · 설명은 원본 정보로 저장되며 검증된 사실정보로 자동 분류하지 않습니다.</p>
              {errors?.description && <p id="description-error" className="mt-2 text-sm text-red-700">{errors.description}</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="specifications-title" className="panel p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="specifications-title" className="text-lg font-semibold">상품 스펙</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">재질, 크기 등 확인 가능한 항목과 값을 입력하세요. 최대 50개.</p>
            </div>
            <button type="button" disabled={values.specifications.length >= MAX_SPECIFICATIONS}
              className="button-secondary" onClick={() => {
                setShowFeedback(false);
                const rowKey = nextRowKey.current++;
                setValues((current) => ({ ...current, specifications: [...current.specifications, { name: "", value: "", rowKey }] }));
              }}>스펙 추가</button>
          </div>
          <div className="mt-6 space-y-4">
            {values.specifications.map((row, index) => (
              <div key={row.rowKey} className="grid items-start gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                {(["name", "value"] as const).map((field) => {
                  const id = `spec-${row.rowKey}-${field}`;
                  const error = errors?.[`specifications.${index}.${field}`];
                  return (
                    <div key={field}>
                      <label htmlFor={id} className="text-xs font-medium text-zinc-600">스펙 {index + 1} {field === "name" ? "항목명" : "값"}</label>
                      <input id={id} name={field === "name" ? "specificationName" : "specificationValue"}
                        maxLength={field === "name" ? 100 : 500} value={row[field]}
                        placeholder={field === "name" ? "예: 재질" : "예: ABS"}
                        onChange={(event) => changeSpecification(row.rowKey, field, event.target.value)}
                        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                        className="product-input" />
                      {error && <p id={`${id}-error`} className="mt-2 text-sm text-red-700">{error}</p>}
                    </div>
                  );
                })}
                <button type="button" aria-label={`스펙 ${index + 1} 삭제`}
                  className="button-secondary sm:mt-7" onClick={() => {
                    setShowFeedback(false);
                    setValues((current) => ({ ...current, specifications: current.specifications.filter((item) => item.rowKey !== row.rowKey) }));
                  }}>삭제</button>
              </div>
            ))}
            {values.specifications.length === 0 && <p className="text-sm text-zinc-500">입력된 스펙이 없습니다. 필요한 항목을 추가하세요.</p>}
            {errors?.specifications && <p className="text-sm text-red-700">{errors.specifications}</p>}
          </div>
        </section>
      </fieldset>

      <div className="panel form-actions">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <button type="submit" disabled={blocked} className="button-primary">{pending ? "저장·이미지 가져오는 중…" : importPreview ? "확인한 정보로 저장" : "상품정보 저장"}</button>
          {pending && <p role="status" className="text-sm text-zinc-600">상품정보와 사실정보를 저장하고 있습니다.</p>}
          {!pending && showFeedback && state.message && (
            <p role={state.status === "success" ? "status" : "alert"}
              className={`text-sm leading-6 ${state.status === "success" ? "text-emerald-800" : "text-red-700"}`}>{state.message}</p>
          )}
          {state.status === "recovery-required" && <a className="text-link" href={`/projects/${projectId}`}>저장 내용 다시 확인</a>}
        </div>
        {hasSavedProduct && state.status !== "recovery-required" && !pending ? (
          <Link href={`/projects/${projectId}/images`} className="button-secondary shrink-0">다음: 이미지 등록 →</Link>
        ) : !hasSavedProduct ? (
          <p className="text-xs leading-5 text-zinc-500">상품정보를 저장하면 이미지 등록 단계로 이동할 수 있습니다.</p>
        ) : null}
      </div>
      {imageResults.length>0&&<ul aria-label="이미지 가져오기 결과" className="panel space-y-2 p-5 text-sm">{imageResults.map((message,index)=><li key={index}>{message}</li>)}</ul>}
    </form></div>
  );
}
