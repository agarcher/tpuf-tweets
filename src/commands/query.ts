import { Command } from "commander";
import chalk from "chalk";
import { TurbopufferClient } from "../lib/turbopuffer.js";
import { SearchOptions } from "../types/index.js";
import { EmbeddingService } from "../lib/embeddings.js";

export const queryCommand = new Command()
  .name("query")
  .description("Direct query with options")
  .argument("<query...>", "Search query")
  .option(
    "-t, --type <type>",
    "Search type (semantic, keyword, hybrid)",
    "hybrid"
  )
  .option("-l, --limit <limit>", "Maximum number of results", "10")
  .option("--after <date>", "Filter tweets after this date (ISO format)")
  .option("--before <date>", "Filter tweets before this date (ISO format)")
  .option("--min-favorites <count>", "Minimum favorite count")
  .option("--min-retweets <count>", "Minimum retweet count")
  .action(
    async (
      queryWords: string[],
      options: {
        type: "semantic" | "keyword" | "hybrid";
        limit: string;
        after?: string;
        before?: string;
        minFavorites?: string;
        minRetweets?: string;
      }
    ) => {
      try {
        const query = queryWords.join(" ");
        const client = new TurbopufferClient();
        const searchOptions: SearchOptions = {
          query,
          type: options.type,
          limit: parseInt(options.limit, 10),
        };

        if (options.after) {
          searchOptions.dateAfter = options.after;
        }
        if (options.before) {
          searchOptions.dateBefore = options.before;
        }
        if (options.minFavorites) {
          searchOptions.minFavorites = parseInt(options.minFavorites, 10);
        }
        if (options.minRetweets) {
          searchOptions.minRetweets = parseInt(options.minRetweets, 10);
        }

        if (options.type === "semantic" || options.type === "hybrid") {
          const embeddingService = new EmbeddingService();
          const [vector] = await embeddingService.generateEmbeddings([query]);
          if (vector) {
            searchOptions.vector = vector;
          }
        }

        const { vector, ...logOptions } = searchOptions;
        console.log(logOptions);

        const results = await client.search(searchOptions);

        if (results.length === 0) {
          console.log(chalk.yellow("No results found."));
          return;
        }

        console.log(chalk.green(`Found ${results.length} results:`));
        results.forEach((result: any, index: number) => {
          const score = result.dist;
          console.log(
            chalk.cyan(
              `\n[${index + 1}] (Score: ${score ? score.toFixed(4) : "N/A"})`
            )
          );
          console.log(chalk.white(result.text));
          console.log(
            chalk.gray(
              `  Favorites: ${result.favorite_count}, Retweets: ${result.retweet_count}, Date: ${result.created_at}`
            )
          );
        });
      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    }
  );
