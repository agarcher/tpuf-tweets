import { Command } from "commander";
import chalk from "chalk";
import { validateConfig } from "../lib/config.js";
import { EmbeddingService } from "../lib/embeddings.js";
import { Turbopuffer } from "@turbopuffer/turbopuffer";

export const queryPdfsCommand = new Command()
  .name("query-pdfs")
  .description("Query PDF documents using semantic search")
  .argument(
    "<strategy>",
    "Chunking strategy: 'character', 'token', or 'recursive'"
  )
  .argument("<query...>", "Search query")
  .option("-l, --limit <limit>", "Maximum number of results", "10")
  .action(
    async (
      strategy: "character" | "token" | "recursive",
      queryWords: string[],
      options: {
        limit: string;
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

        if (isNaN(limit) || limit <= 0) {
          throw new Error("Limit must be a positive number");
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

        // Generate embedding for the query
        const embeddingService = new EmbeddingService();
        const [vector] = await embeddingService.generateEmbeddings([query]);

        if (!vector) {
          throw new Error("Failed to generate embedding for query");
        }

        console.log(
          chalk.gray(`Generated embedding vector (length: ${vector.length})`)
        );

        // Initialize Turbopuffer client
        const tpuf = new Turbopuffer({
          apiKey: process.env.TURBOPUFFER_API_KEY,
          region: process.env.TURBOPUFFER_REGION,
        });
        const ns = tpuf.namespace(namespaceName);

        // Perform semantic search
        const searchResult = await ns.query({
          rank_by: ["vector", "ANN", vector],
          top_k: limit,
          include_attributes: ["text", "title", "author"],
        });

        const results = searchResult.rows ?? [];

        if (results.length === 0) {
          console.log(chalk.yellow("No results found."));
          return;
        }

        // Display structured results
        console.log(chalk.green(`\n📄 Found ${results.length} results:`));
        console.log(
          chalk.gray(`Strategy: ${strategy} | Namespace: ${namespaceName}\n`)
        );

        results.forEach((result: any, index: number) => {
          const distance = result.$dist;
          const similarity = 1 / (1 + distance);

          console.log(
            chalk.cyan(
              `[${index + 1}] Distance: ${distance.toFixed(
                4
              )} | Similarity: ${similarity.toFixed(4)}`
            )
          );

          // Display title and author if available
          if (result.title || result.author) {
            const title = result.title || "Unknown Title";
            const author = result.author || "Unknown Author";
            console.log(chalk.magenta(`📄 ${title}`));
            console.log(chalk.blue(`👤 ${author}`));
          }

          // Display text content (truncated if too long)
          const text = result.text || "";
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
