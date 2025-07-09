import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { TurbopufferRow, SearchOptions } from "../types/index.js";
import { getConfig } from "./config.js";

export class TurbopufferClient {
  private namespace: Turbopuffer.Namespace;

  constructor() {
    const config = getConfig();
    const client = new Turbopuffer({
      apiKey: config.turbopuffer.apiKey,
      region: config.turbopuffer.region,
    });
    this.namespace = client.namespace(config.turbopuffer.namespace);
  }

  async upsertTweets(tweets: TurbopufferRow[]): Promise<void> {
    if (tweets.length === 0) {
      return;
    }

    try {
      // Prepare rows for turbopuffer in the correct format
      const rows = tweets.map((tweet) => ({
        id: tweet.id,
        vector: tweet.vector,
        text: tweet.text,
        created_at: tweet.created_at,
        favorite_count: tweet.favorite_count,
        retweet_count: tweet.retweet_count,
        has_urls: tweet.has_urls,
        has_mentions: tweet.has_mentions,
        has_hashtags: tweet.has_hashtags,
      }));

      // Write rows with schema definition
      await this.namespace.write({
        upsert_rows: rows,
        schema: {
          text: {
            type: "string",
            full_text_search: true,
          },
        },
        distance_metric: "cosine_distance",
      });

      console.log(`✅ Successfully upserted ${tweets.length} tweets`);
    } catch (error) {
      console.error(`❌ Failed to upsert tweets: ${error}`);
      throw error;
    }
  }

  async search(options: SearchOptions): Promise<any[]> {
    try {
      const { query, type, limit = 10 } = options;

      // For now, return empty results with a message
      console.log(`🔍 Search functionality not fully implemented yet`);
      console.log(`📋 Query: "${query}", Type: ${type}, Limit: ${limit}`);

      return [];
    } catch (error) {
      console.error(`❌ Search failed: ${error}`);
      throw error;
    }
  }
}
