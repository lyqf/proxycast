import type { ChatInputAdapter } from "./types";

interface CreateGeneralInputAdapterOptions {
  text: string;
  setText: (value: string) => void;
  isSending: boolean;
  disabled?: boolean;
  providerType: string;
  model: string;
  setProviderType: (providerType: string) => void;
  setModel: (model: string) => void;
  send: (options?: { textOverride?: string }) => void;
  stop?: () => void;
}

export const createGeneralInputAdapter = (
  options: CreateGeneralInputAdapterOptions,
): ChatInputAdapter => {
  const {
    text,
    setText,
    isSending,
    disabled,
    providerType,
    model,
    setProviderType,
    setModel,
    send,
    stop,
  } = options;

  return {
    state: {
      text,
      isSending,
      disabled,
    },
    model: {
      providerType,
      model,
    },
    actions: {
      setText,
      send,
      stop,
      setProviderType,
      setModel,
    },
    ui: {
      showModelSelector: true,
      showToolBar: false,
    },
  };
};
