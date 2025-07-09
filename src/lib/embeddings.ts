import { OpenAI } from "openai";
import { getConfig } from "./config.js";

export class EmbeddingService {
  private _client: OpenAI;
  private _model: string;

  constructor() {
    const config = getConfig();
    this._client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this._model = config.openai.model;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implement embedding generation with this._client and this._model
    console.log(
      `Generating embedding for text: ${text.substring(0, 50)}... using ${
        this._model
      }`
    );
    return [];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // TODO: Implement batch embedding generation using this._client
    console.log(
      `Generating embeddings for ${texts.length} texts with ${
        this._model
      } using client: ${!!this._client}`
    );
    return [];
  }
}
