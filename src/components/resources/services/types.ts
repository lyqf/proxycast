export type ResourceKind = "file" | "document" | "folder";

export type ResourceSourceType = "material" | "content";

export interface ResourceMetadata {
  resourceKind?: "document" | "folder";
  parentId?: string | null;
  [key: string]: unknown;
}

export interface ResourceItem {
  id: string;
  projectId: string;
  name: string;
  kind: ResourceKind;
  sourceType: ResourceSourceType;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  size?: number;
  fileType?: string;
  mimeType?: string;
  filePath?: string;
  description?: string;
  tags?: string[];
  metadata?: ResourceMetadata;
}
