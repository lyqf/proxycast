export interface ComposerAttachment {
  data: string;
  mediaType: string;
}

export interface ComposerState {
  text: string;
  isSending: boolean;
  disabled?: boolean;
  attachments?: ComposerAttachment[];
}

export interface ModelSelectionState {
  providerType: string;
  model: string;
  providersLoading?: boolean;
  modelsLoading?: boolean;
}

export interface ComposerActions {
  setText: (value: string) => void;
  send: (options?: { textOverride?: string }) => void;
  stop?: () => void;
  setProviderType?: (providerType: string) => void;
  setModel?: (model: string) => void;
}
