import { invoke } from "@tauri-apps/api/core";
import {
  createContent,
  deleteContent,
  getContent,
  listContents,
  updateContent,
  type ContentListItem,
} from "@/lib/api/project";
import type { MaterialType } from "@/types/material";
import type { ResourceItem, ResourceMetadata } from "./types";

type RawMaterial = {
  id: string;
  name?: string;
  type?: string;
  material_type?: string;
  projectId?: string;
  project_id?: string;
  filePath?: string;
  file_path?: string;
  fileSize?: number;
  file_size?: number;
  mimeType?: string;
  mime_type?: string;
  description?: string;
  tags?: string[];
  createdAt?: number;
  created_at?: number;
};

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
]);

const DATA_EXTENSIONS = new Set(["csv", "json", "xml", "xlsx", "xls"]);

const TEXT_EXTENSIONS = new Set(["txt", "md"]);

const toTimestampMs = (value: number | undefined): number => {
  if (!value || Number.isNaN(value)) {
    return Date.now();
  }
  // 部分旧数据可能是秒级时间戳
  return value < 1_000_000_000_000 ? value * 1000 : value;
};

const parseResourceMetadata = (value: unknown): ResourceMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { parentId: null, resourceKind: "document" };
  }

  const metadata = value as Record<string, unknown>;
  const parentId =
    typeof metadata.parentId === "string" && metadata.parentId.trim().length > 0
      ? metadata.parentId
      : null;
  const resourceKind =
    metadata.resourceKind === "folder" ? "folder" : "document";

  return {
    ...metadata,
    parentId,
    resourceKind,
  };
};

const mapContentToResource = (item: ContentListItem): ResourceItem | null => {
  const metadata = parseResourceMetadata(item.metadata);

  return {
    id: item.id,
    projectId: item.project_id,
    name: item.title,
    kind: metadata.resourceKind === "folder" ? "folder" : "document",
    sourceType: "content",
    parentId: metadata.parentId ?? null,
    createdAt: toTimestampMs(item.created_at),
    updatedAt: toTimestampMs(item.updated_at),
    size: item.word_count,
    metadata,
  };
};

const mapMaterialToResource = (
  item: RawMaterial,
  fallbackProjectId: string,
): ResourceItem => {
  const materialType = (item.type ?? item.material_type ?? "document").toString();
  const projectId = (item.projectId ?? item.project_id ?? fallbackProjectId).toString();

  return {
    id: item.id,
    projectId,
    name: item.name ?? "未命名文件",
    kind: "file",
    sourceType: "material",
    parentId: null,
    createdAt: toTimestampMs(item.createdAt ?? item.created_at),
    updatedAt: toTimestampMs(item.createdAt ?? item.created_at),
    size: item.fileSize ?? item.file_size,
    fileType: materialType,
    mimeType: item.mimeType ?? item.mime_type,
    filePath: item.filePath ?? item.file_path,
    description: item.description,
    tags: item.tags ?? [],
  };
};

const extractFileName = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  const name = normalized.split("/").pop();
  return name && name.trim().length > 0 ? name.trim() : "未命名文件";
};

const inferMaterialType = (filePath: string): MaterialType => {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (!extension) {
    return "document";
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (DATA_EXTENSIONS.has(extension)) {
    return "data";
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }
  return "document";
};

export const fetchProjectResources = async (
  projectId: string,
): Promise<ResourceItem[]> => {
  const [contents, materials] = await Promise.all([
    listContents(projectId, {
      sort_by: "updated_at",
      sort_order: "desc",
    }),
    invoke<RawMaterial[]>("list_materials", { projectId, filter: null }),
  ]);

  const contentResources = contents
    .map(mapContentToResource)
    .filter((item): item is ResourceItem => Boolean(item));
  const materialResources = materials.map((item) =>
    mapMaterialToResource(item, projectId),
  );

  return [...contentResources, ...materialResources];
};

export const createFolderResource = async (
  projectId: string,
  name: string,
  parentId: string | null,
): Promise<void> => {
  await createContent({
    project_id: projectId,
    title: name,
    content_type: "document",
    metadata: {
      parentId,
      resourceKind: "folder",
    },
  });
};

export const createDocumentResource = async (
  projectId: string,
  name: string,
  parentId: string | null,
): Promise<void> => {
  await createContent({
    project_id: projectId,
    title: name,
    content_type: "document",
    body: "",
    metadata: {
      parentId,
      resourceKind: "document",
    },
  });
};

export const renameResource = async (
  item: ResourceItem,
  name: string,
): Promise<void> => {
  if (item.sourceType === "material") {
    await invoke("update_material", {
      id: item.id,
      update: { name },
    });
    return;
  }

  await updateContent(item.id, { title: name });
};

export const deleteSingleResource = async (item: ResourceItem): Promise<void> => {
  if (item.sourceType === "material") {
    await invoke("delete_material", { id: item.id });
    return;
  }

  await deleteContent(item.id);
};

export const moveContentResource = async (
  item: ResourceItem,
  parentId: string | null,
): Promise<void> => {
  if (item.sourceType !== "content") {
    return;
  }

  const metadata: ResourceMetadata = {
    ...(item.metadata ?? {}),
    resourceKind: item.kind === "folder" ? "folder" : "document",
    parentId,
  };

  await updateContent(item.id, {
    metadata: metadata as Record<string, unknown>,
  });
};

export const uploadFileResource = async (
  projectId: string,
  filePath: string,
): Promise<void> => {
  await invoke("upload_material", {
    req: {
      projectId,
      name: extractFileName(filePath),
      type: inferMaterialType(filePath),
      filePath,
      tags: [],
    },
  });
};

export const fetchDocumentDetail = async (id: string) => {
  return getContent(id);
};
