import type { Category, LikelyMaterial, PackagingType } from "./taxonomy";

export type WasteItem = {
  id: string;
  brand: string;
  category: Category;
  packagingType: PackagingType;
  likelyMaterial: LikelyMaterial;
  confidence: number;
};

export type WasteReport = {
  id: string;
  createdAt: string;
  reporterId?: string;
  reporterUsername?: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  imagePreview?: string;
  imagePath?: string;
  source?: "field" | "demo";
  reviewStatus?: "approved" | "rejected";
  reviewedAt?: string;
  reviewHistory?: ReviewAuditEntry[];
  items: WasteItem[];
};

export type AuthSession = {
  id: string;
  email: string;
  username: string;
  role: "reporter" | "reviewer";
  rewardPoints: number;
};

export type ReviewAuditEntry = {
  id: string;
  decision: "approved" | "rejected";
  reviewerEmail: string;
  reviewedAt: string;
  note?: string;
  changes: string[];
};

export type Intervention = {
  id: string;
  areaKey: string;
  areaName: string;
  option: string;
  deployedAt: string;
  createdAt: string;
};

export type AnalyzeResponse = {
  items: Omit<WasteItem, "id">[];
};
