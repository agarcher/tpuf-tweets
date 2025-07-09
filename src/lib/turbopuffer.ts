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

  private _reciprocalRankFusion(resultLists: any[], k: number = 60): any[] {
    const scores: { [key: string]: number } = {};
    const allResults: { [key: string]: any } = {};
    for (const results of resultLists) {
      if (!results) continue;
      for (let rank = 1; rank <= results.length; rank++) {
        const item = results[rank - 1];
        scores[item.id] = (scores[item.id] || 0) + 1.0 / (k + rank);
        allResults[item.id] = item;
      }
    }
    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([docId, score]) => {
        allResults[docId].dist = score;
        return allResults[docId];
      });
  }

  async search(options: SearchOptions): Promise<any[]> {
    try {
      const {
        query,
        vector,
        type,
        limit = 10,
        dateAfter,
        dateBefore,
        minFavorites,
        minRetweets,
      } = options;

      const filters = [];
      if (dateAfter) {
        filters.push(["created_at", "Gte", dateAfter]);
      }
      if (dateBefore) {
        filters.push(["created_at", "Lte", dateBefore]);
      }
      if (minFavorites) {
        filters.push(["favorite_count", "Gte", minFavorites]);
      }
      if (minRetweets) {
        filters.push(["retweet_count", "Gte", minRetweets]);
      }

      const filterPayload: any =
        filters.length > 1
          ? ["And", filters]
          : filters.length > 0
          ? filters[0]
          : undefined;

      const baseQuery: any = {
        top_k: limit,
        include_attributes: [
          "text",
          "created_at",
          "favorite_count",
          "retweet_count",
          "has_urls",
          "has_mentions",
          "has_hashtags",
        ],
      };

      if (filterPayload) {
        baseQuery.filters = filterPayload;
      }

      if (type === "hybrid") {
        if (!vector) {
          throw new Error("Vector is required for hybrid search.");
        }
        if (!query) {
          throw new Error("Query is required for hybrid search.");
        }

        const result = await this.namespace.multiQuery({
          queries: [
            { ...baseQuery, rank_by: ["vector", "ANN", vector] },
            { ...baseQuery, rank_by: ["text", "BM25", query] },
          ],
        });

        const vectorResults = result.results[0]?.rows ?? [];
        const ftsResults = result.results[1]?.rows ?? [];

        const combinedResults = this._reciprocalRankFusion([
          vectorResults,
          ftsResults,
        ]);

        return combinedResults.slice(0, limit);
      }

      let rank_by: ["vector", "ANN", number[]] | ["text", "BM25", string];
      if (type === "semantic") {
        if (!vector) {
          throw new Error("Vector is required for semantic search.");
        }
        rank_by = ["vector", "ANN", vector];
      } else if (type === "keyword") {
        if (!query) {
          throw new Error("Query is required for keyword search.");
        }
        rank_by = ["text", "BM25", query];
      } else {
        throw new Error(`Unknown search type: ${type}`);
      }

      const queryPayload: any = { ...baseQuery, rank_by };
      if (filterPayload) {
        queryPayload.filters = filterPayload;
      }

      const results = await this.namespace.query(queryPayload);
      return results.rows ?? [];
    } catch (error) {
      console.error(`❌ Search failed: ${error}`);
      throw error;
    }
  }
}
