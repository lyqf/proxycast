import type { ChatInputAdapter } from "./types";

interface CreateChatInputAdapterOptions {
  text: string;
  setText: (value: string) => void;
  isSending: boolean;
  disabled?: boolean;
  send: (options?: { textOverride?: string }) => void;
  stop?: () => void;
}

export const createChatInputAdapter = (
  options: CreateChatInputAdapterOptions,
): ChatInputAdapter => {
  const { text, setText, isSending, disabled, send, stop } = options;

  return {
    state: {
      text,
      isSending,
      disabled,
    },
    actions: {
      setText,
      send,
      stop,
    },
    ui: {
      showModelSelector: false,
      showToolBar: false,
    },
  };
};
