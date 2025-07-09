import { Config } from "../types/index.js";

export function getConfig(): Config {
  const turbopufferApiKey = process.env.TURBOPUFFER_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const turbopufferRegion = process.env.TURBOPUFFER_REGION || "gcp-us-central1";
  const turbopufferNamespace =
    process.env.TURBOPUFFER_NAMESPACE || "tweets-default";
  const openaiModel = process.env.OPENAI_MODEL || "text-embedding-3-small";

  if (!turbopufferApiKey) {
    throw new Error("TURBOPUFFER_API_KEY environment variable is required");
  }

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  return {
    turbopuffer: {
      apiKey: turbopufferApiKey,
      region: turbopufferRegion,
      namespace: turbopufferNamespace,
    },
    openai: {
      apiKey: openaiApiKey,
      model: openaiModel,
    },
  };
}

export function validateConfig(): boolean {
  try {
    getConfig();
    return true;
  } catch (error) {
    console.error("Configuration validation failed:", error);
    return false;
  }
}
