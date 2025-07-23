import { Command } from "commander";
import chalk from "chalk";
import { validateConfig } from "../lib/config.js";
import { EmbeddingService } from "../lib/embeddings.js";
import { Turbopuffer } from "@turbopuffer/turbopuffer";

export const queryPdfsCommand = new Command()
  .name("query-pdfs")
  .description("Query PDF documents using semantic, keyword, or hybrid search")
  .argument(
    "<strategy>",
    "Chunking strategy: 'character', 'token', or 'recursive'"
  )
  .argument("<query...>", "Search query")
  .option(
    "-t, --type <type>",
    "Search type (semantic, keyword, hybrid)",
    "semantic"
  )
  .option("-l, --limit <limit>", "Maximum number of results", "10")
  .option(
    "-r, --rerank <method>",
    "Reranking method for hybrid search (rrf, cohere)",
    "rrf"
  )
  .action(
    async (
      strategy: "character" | "token" | "recursive",
      queryWords: string[],
      options: {
        type: "semantic" | "keyword" | "hybrid";
        limit: string;
        rerank: "rrf" | "cohere";
      }
    ) => {
      try {
        // Validate configuration
        if (!validateConfig()) {
          throw new Error(
            "Invalid configuration. Please check your environment variables."
          );
        }

        const query = queryWords.join(" ");
        const limit = parseInt(options.limit, 10);
        const searchType = options.type;
        const rerankMethod = options.rerank;

        if (isNaN(limit) || limit <= 0) {
          throw new Error("Limit must be a positive number");
        }

        // Validate rerank method for non-hybrid searches
        if (searchType !== "hybrid" && rerankMethod !== "rrf") {
          console.log(
            chalk.yellow(
              "⚠️  Warning: Reranking method only applies to hybrid search. Using default behavior."
            )
          );
        }

        // Map strategy to namespace name
        let namespaceName: string;
        switch (strategy) {
          case "character":
            namespaceName = "chunk-character";
            break;
          case "token":
            namespaceName = "chunk-token";
            break;
          case "recursive":
            namespaceName = "chunk-structure";
            break;
          default:
            console.error(
              chalk.red(
                "❌ Error: Invalid chunking strategy. Use 'character', 'token', or 'recursive'."
              )
            );
            process.exit(1);
        }

        console.log(
          chalk.blue(
            `🔍 Searching in namespace "${namespaceName}" for: "${query}"`
          )
        );
        console.log(chalk.gray(`Search type: ${searchType}`));
        if (searchType === "hybrid") {
          console.log(chalk.gray(`Reranking method: ${rerankMethod}`));
        }

        // Generate embedding for semantic or hybrid search
        let vector: number[] | undefined;
        if (searchType === "semantic" || searchType === "hybrid") {
          const embeddingService = new EmbeddingService();
          [vector] = await embeddingService.generateEmbeddings([query]);

          if (!vector) {
            throw new Error("Failed to generate embedding for query");
          }

          console.log(
            chalk.gray(`Generated embedding vector (length: ${vector.length})`)
          );
        }

        // Initialize Turbopuffer client
        const tpuf = new Turbopuffer({
          apiKey: process.env.TURBOPUFFER_API_KEY,
          region: process.env.TURBOPUFFER_REGION,
        });
        const ns = tpuf.namespace(namespaceName);

        // Build base query configuration
        const baseQuery: any = {
          top_k: limit,
          include_attributes: ["text", "title", "author"],
        };

        let results: any[] = [];

        // Execute search based on type
        if (searchType === "hybrid") {
          if (!vector) {
            throw new Error("Vector is required for hybrid search.");
          }

          console.log(
            chalk.gray("Performing hybrid search (vector + BM25)...")
          );

          // Perform multiQuery for hybrid search
          const multiQueryResult = await ns.multiQuery({
            queries: [
              { ...baseQuery, rank_by: ["vector", "ANN", vector] },
              { ...baseQuery, rank_by: ["text", "BM25", query] },
            ],
          });

          const vectorResults = multiQueryResult.results[0]?.rows ?? [];
          const ftsResults = multiQueryResult.results[1]?.rows ?? [];

          console.log(
            chalk.gray(
              `Vector search: ${vectorResults.length} results, BM25 search: ${ftsResults.length} results`
            )
          );

          // Apply the selected reranking method
          if (rerankMethod === "cohere") {
            console.log(chalk.gray("Applying Cohere reranking..."));

            // First apply RRF to get candidate set
            const candidates = reciprocalRankFusion(
              [vectorResults, ftsResults],
              60
            );

            // Then rerank with Cohere
            const rerankedResults = await cohereRerankOrUnranked(
              candidates,
              query,
              limit
            );

            // Convert Cohere results back to full result objects
            results = rerankedResults.map((reranked: any) => {
              const originalResult = candidates.find(
                (c) => c.id === reranked.id
              );
              if (originalResult) {
                return {
                  ...originalResult,
                  $dist: reranked.score, // Use Cohere relevance score
                  relevanceScore: reranked.score,
                };
              }
              return reranked;
            });
          } else {
            // Use RRF (default)
            console.log(chalk.gray("Applying Reciprocal Rank Fusion..."));
            results = reciprocalRankFusion(
              [vectorResults, ftsResults],
              60
            ).slice(0, limit);
          }
        } else if (searchType === "semantic") {
          if (!vector) {
            throw new Error("Vector is required for semantic search.");
          }

          console.log(chalk.gray("Performing semantic search (vector)..."));

          const searchResult = await ns.query({
            ...baseQuery,
            rank_by: ["vector", "ANN", vector],
          });

          results = searchResult.rows ?? [];
        } else if (searchType === "keyword") {
          console.log(chalk.gray("Performing keyword search (BM25)..."));

          const searchResult = await ns.query({
            ...baseQuery,
            rank_by: ["text", "BM25", query],
          });

          results = searchResult.rows ?? [];
        } else {
          throw new Error(`Unknown search type: ${searchType}`);
        }

        if (results.length === 0) {
          console.log(chalk.yellow("No results found."));
          return;
        }

        // Display structured results
        console.log(chalk.green(`\n📄 Found ${results.length} results:`));
        console.log(
          chalk.gray(
            `Strategy: ${strategy} | Namespace: ${namespaceName} | Type: ${searchType}${
              searchType === "hybrid" ? ` | Rerank: ${rerankMethod}` : ""
            }\n`
          )
        );

        results.forEach((result: any, index: number) => {
          // Handle different score types based on search method
          let scoreDisplay: string;
          if (searchType === "hybrid") {
            const score = result.$dist || result.dist || 0;
            if (rerankMethod === "cohere") {
              scoreDisplay = `Cohere Score: ${score.toFixed(4)}`;
            } else {
              scoreDisplay = `RRF Score: ${score.toFixed(4)}`;
            }
          } else if (searchType === "semantic") {
            const distance = result.$dist || result.dist || 0;
            const similarity = 1 / (1 + distance);
            scoreDisplay = `Distance: ${distance.toFixed(
              4
            )} | Similarity: ${similarity.toFixed(4)}`;
          } else {
            // keyword search
            const score = result.$dist || result.dist || 0;
            scoreDisplay = `BM25 Score: ${score.toFixed(4)}`;
          }

          console.log(chalk.cyan(`[${index + 1}] ${scoreDisplay}`));

          // Display title and author if available
          const title =
            result.title || result.attributes?.title || "Unknown Title";
          const author =
            result.author || result.attributes?.author || "Unknown Author";
          console.log(chalk.magenta(`📄 ${title}`));
          console.log(chalk.blue(`👤 ${author}`));

          // Display text content (truncated if too long)
          const text = result.text || result.attributes?.text || "";
          const truncatedText =
            text.length > 100 ? text.substring(0, 100) + "..." : text;
          console.log(chalk.white(truncatedText));

          console.log(); // Empty line between results
        });
      } catch (error) {
        console.error(chalk.red("❌ Error:"), error);
        process.exit(1);
      }
    }
  );

// Reciprocal Rank Fusion implementation
function reciprocalRankFusion(resultLists: any[], k: number = 60): any[] {
  const scores: { [key: string]: number } = {};
  const allResults: { [key: string]: any } = {};

  for (const results of resultLists) {
    if (!results) continue;
    for (let rank = 1; rank <= results.length; rank++) {
      const item = results[rank - 1];
      const itemId = item.id;
      scores[itemId] = (scores[itemId] || 0) + 1.0 / (k + rank);
      allResults[itemId] = item;
    }
  }

  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([docId, score]) => {
      const result = allResults[docId];
      result.$dist = score; // Store RRF score as distance for consistency
      return result;
    });
}

// Cohere reranking implementation based on the reference in hybrid_search_guide.md
async function cohereRerankOrUnranked(
  rows: any[],
  query: string,
  k?: number
): Promise<any[]> {
  if (!process.env.COHERE_API_KEY) {
    console.warn(
      chalk.yellow(
        "⚠️  Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), falling back to RRF"
      )
    );
    return rows;
  }

  try {
    const { CohereClient } = await import("cohere-ai");
    const co = new CohereClient({ token: process.env.COHERE_API_KEY });

    // Prepare documents for Cohere reranking
    const docs = rows.map((r: any) => {
      // Get text from various possible locations
      const text = r.text || r.attributes?.text || "";
      const title = r.title || r.attributes?.title || "";
      const author = r.author || r.attributes?.author || "";

      // Combine available text fields for better reranking
      const combinedText = [title, author, text].filter(Boolean).join(" ");

      return combinedText || "No content available";
    });

    console.log(
      chalk.gray(`Reranking ${docs.length} documents with Cohere...`)
    );

    const reranked = await co.rerank({
      query: query,
      documents: docs,
      topN: k || docs.length,
      model: "rerank-english-v3.0", // Use the latest Cohere rerank model
    });

    return reranked.results.map((r: any) => ({
      id: rows[r.index].id,
      score: r.relevanceScore,
      originalResult: rows[r.index], // Keep reference to original result
    }));
  } catch (e) {
    console.warn(
      chalk.yellow(
        `⚠️  Warning: Failed to use Cohere reranking (${
          e instanceof Error ? e.message : "Unknown error"
        }), falling back to RRF`
      )
    );
    return rows;
  }
}
