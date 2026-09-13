export type JsonObject = Record<string, unknown>;

export const PROJECT_STATUSES = [
  "draft",
  "analyzing",
  "generated",
  "editing",
  "completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  projectId: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  sourceType: string;
  sourceUrl: string | null;
  rawData: JsonObject;
  aiAnalysis: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFacts {
  id: string;
  productId: string;
  facts: JsonObject;
  sourceSnapshot: JsonObject;
  version: number;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ASSET_TYPES = [
  "unclassified",
  "hero",
  "product",
  "detail",
  "usage",
  "specification",
  "option",
  "notice",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export interface Asset {
  id: string;
  projectId: string;
  productId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  assetType: AssetType;
  sortOrder: number;
  metadata: JsonObject;
  createdAt: string;
}

export const DETAIL_PAGE_STATUSES = [
  "draft",
  "generated",
  "editing",
  "completed",
] as const;

export type DetailPageStatus = (typeof DETAIL_PAGE_STATUSES)[number];

export interface DetailPage {
  id: string;
  projectId: string;
  status: DetailPageStatus;
  width: number;
  themeId: string | null;
  settings: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export const SECTION_TYPES = [
  "hero",
  "keyBenefits",
  "feature",
  "imageText",
  "gallery",
  "useCase",
  "detail",
  "specification",
  "option",
  "notice",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export interface Section {
  id: string;
  detailPageId: string;
  type: SectionType;
  sortOrder: number;
  content: JsonObject;
  style: JsonObject;
  createdAt: string;
  updatedAt: string;
}
