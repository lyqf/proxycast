import type { ResourceItem } from "../services/types";

export type ResourceSortField = "updatedAt" | "createdAt" | "name";

export type ResourceSortDirection = "asc" | "desc";

export interface ResourcesState {
  projectId: string | null;
  items: ResourceItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  currentFolderId: string | null;
  searchQuery: string;
  selectedIds: string[];
  sortField: ResourceSortField;
  sortDirection: ResourceSortDirection;
}

export const initialState: ResourcesState = {
  projectId: null,
  items: [],
  loading: false,
  saving: false,
  error: null,
  currentFolderId: null,
  searchQuery: "",
  selectedIds: [],
  sortField: "updatedAt",
  sortDirection: "desc",
};
