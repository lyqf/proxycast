import { safeInvoke } from "@/lib/dev-bridge";

export interface RateLimitConfig {
  enabled: boolean;
  requests_per_minute: number;
  window_secs: number;
}

export interface ConversationConfig {
  trim_enabled: boolean;
  max_messages: number;
  summary_enabled: boolean;
}

export interface HintRouteEntry {
  hint: string;
  provider: string;
  model: string;
}

export interface PairingConfig {
  enabled: boolean;
}

export async function getRateLimitConfig(): Promise<RateLimitConfig> {
  return await safeInvoke("get_rate_limit_config");
}

export async function updateRateLimitConfig(config: RateLimitConfig): Promise<void> {
  return await safeInvoke("update_rate_limit_config", { config });
}

export async function getConversationConfig(): Promise<ConversationConfig> {
  return await safeInvoke("get_conversation_config");
}

export async function updateConversationConfig(config: ConversationConfig): Promise<void> {
  return await safeInvoke("update_conversation_config", { config });
}

export async function getHintRoutes(): Promise<HintRouteEntry[]> {
  return await safeInvoke("get_hint_routes");
}

export async function updateHintRoutes(routes: HintRouteEntry[]): Promise<void> {
  return await safeInvoke("update_hint_routes", { routes });
}

export async function getPairingConfig(): Promise<PairingConfig> {
  return await safeInvoke("get_pairing_config");
}

export async function updatePairingConfig(config: PairingConfig): Promise<void> {
  return await safeInvoke("update_pairing_config", { config });
}
