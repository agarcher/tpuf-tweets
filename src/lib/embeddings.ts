import { OpenAI } from "openai";
import ora from "ora";
import { getConfig } from "./config.js";

export class EmbeddingService {
  private _client: OpenAI;
  private _model: string;
  private _requestDelay: number = 50; // 50ms delay between requests to respect rate limits
  private _retryAttempts: number = 3;
  private _retryDelay: number = 1000; // 1 second initial retry delay

  constructor() {
    const config = getConfig();
    this._client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this._model = config.openai.model;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Clean and truncate text if necessary (OpenAI has token limits)
    const cleanText = text.trim().substring(0, 8000); // Conservative limit

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this._retryAttempts; attempt++) {
      try {
        const response = await this._client.embeddings.create({
          model: this._model,
          input: cleanText,
        });

        if (!response.data || response.data.length === 0) {
          throw new Error("No embedding returned from OpenAI");
        }

        const firstResult = response.data[0];
        if (!firstResult) {
          throw new Error("No embedding data returned from OpenAI");
        }

        const embedding = firstResult.embedding;
        if (!embedding || embedding.length === 0) {
          throw new Error("Empty embedding returned from OpenAI");
        }

        return embedding;
      } catch (error) {
        lastError = error as Error;

        if (attempt === this._retryAttempts) {
          throw new Error(
            `Failed to generate embedding after ${this._retryAttempts} attempts: ${lastError.message}`
          );
        }

        // Exponential backoff for retries
        const delay = this._retryDelay * Math.pow(2, attempt - 1);
        console.warn(
          `Embedding generation failed (attempt ${attempt}/${this._retryAttempts}), retrying in ${delay}ms...`
        );
        await this._sleep(delay);
      }
    }

    throw lastError || new Error("Unknown error generating embedding");
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error("Texts array cannot be empty");
    }

    const embeddings: number[][] = [];
    const batchSize = 20; // Process in smaller batches to avoid rate limits

    console.log(
      `🔄 Generating embeddings for ${texts.length} texts using ${this._model}`
    );

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      const spinner = ora(
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} texts)`
      ).start();

      try {
        const batchEmbeddings = await this._processBatch(batch);
        embeddings.push(...batchEmbeddings);

        // Add delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await this._sleep(this._requestDelay * batch.length);
        }

        spinner.succeed(
          `Completed batch ${batchNumber}/${totalBatches} (${batch.length} texts)`
        );
      } catch (error) {
        spinner.fail(`❌ Failed to process batch ${batchNumber}: ${error}`);
        throw error;
      }
    }

    console.log(`✅ Generated ${embeddings.length} embeddings successfully`);
    return embeddings;
  }

  private async _processBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text) {
        console.warn(`⚠️  Skipping undefined text at index ${i}`);
        continue;
      }

      try {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);

        // Small delay between individual requests
        if (i < texts.length - 1) {
          await this._sleep(this._requestDelay);
        }
      } catch (error) {
        console.error(
          `❌ Failed to generate embedding for text index ${i}:`,
          error
        );
        throw error;
      }
    }

    return embeddings;
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Method to estimate cost (useful for large datasets)
  estimateCost(textCount: number): {
    estimatedTokens: number;
    estimatedCost: number;
  } {
    // Very rough estimate: average tweet ~20 tokens
    const avgTokensPerText = 20;
    const estimatedTokens = textCount * avgTokensPerText;

    // text-embedding-3-small pricing (as of 2024): $0.00002 per 1K tokens
    const costPer1KTokens = 0.00002;
    const estimatedCost = (estimatedTokens / 1000) * costPer1KTokens;

    return {
      estimatedTokens,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000, // Round to 4 decimal places
    };
  }

  // Method to test the service configuration
  async testConnection(): Promise<boolean> {
    try {
      const testEmbedding = await this.generateEmbedding("Hello, world!");
      return testEmbedding.length > 0;
    } catch (error) {
      console.error("❌ OpenAI connection test failed:", error);
      return false;
    }
  }
}
