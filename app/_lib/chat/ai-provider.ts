import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { gateway } from "ai";

const providers = {
  anthropic: {
    env: "ANTHROPIC_API_KEY",
    modelEnv: "AI_MODEL_ANTHROPIC",
    defaultModel: "claude-sonnet-4-6",
    model: (modelId: string) => anthropic(modelId),
  },
  openai: {
    env: "OPENAI_API_KEY",
    modelEnv: "AI_MODEL_OPENAI",
    defaultModel: "gpt-5.4",
    model: (modelId: string) => openai(modelId),
  },
  gateway: {
    env: "AI_GATEWAY_API_KEY",
    modelEnv: "AI_MODEL_GATEWAY",
    defaultModel: "anthropic/claude-sonnet-4.6",
    model: (modelId: string) => gateway(modelId),
  },
} as const;

type Provider = keyof typeof providers;

export function getModel(provider?: string) {
  if (provider) {
    if (!(provider in providers)) {
      throw new Error(
        `Unknown provider "${provider}". Supported: ${Object.keys(providers).join(", ")}`
      );
    }
    const p = providers[provider as Provider];
    if (!process.env[p.env]) {
      throw new Error(
        `Provider "${provider}" requires ${p.env} to be set`
      );
    }
    return p.model(process.env[p.modelEnv] || p.defaultModel);
  }

  // Default: use first available provider, preferring anthropic
  for (const p of Object.values(providers)) {
    if (process.env[p.env]) {
      return p.model(process.env[p.modelEnv] || p.defaultModel);
    }
  }

  throw new Error(
    "No AI provider configured. Set at least one of: " +
      Object.values(providers)
        .map((p) => p.env)
        .join(", ")
  );
}
