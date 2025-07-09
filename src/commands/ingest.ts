import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { TweetProcessor } from "../lib/tweets.js";
import { EmbeddingService } from "../lib/embeddings.js";
import { TurbopufferClient } from "../lib/turbopuffer.js";
import { TurbopufferRow } from "../types/index.js";
import { validateConfig } from "../lib/config.js";

export const ingestCommand = new Command()
  .name("ingest")
  .description("Ingest tweets from JSON file")
  .argument("<file>", "Path to tweets JSON file")
  .option("-b, --batch-size <size>", "Batch size for processing", "100")
  .option(
    "-l, --limit <count>",
    "Limit number of tweets to process (for testing)"
  )
  .option("--dry-run", "Process tweets but don't store in turbopuffer")
  .option("--skip-embeddings", "Skip embedding generation (for testing)")
  .action(
    async (
      file: string,
      options: {
        batchSize: string;
        limit?: string;
        dryRun?: boolean;
        skipEmbeddings?: boolean;
      }
    ) => {
      try {
        // Validate configuration
        if (!validateConfig()) {
          throw new Error(
            "Invalid configuration. Please check your environment variables."
          );
        }

        const batchSize = parseInt(options.batchSize, 10);
        if (isNaN(batchSize) || batchSize <= 0) {
          throw new Error("Batch size must be a positive number");
        }

        // Parse and validate limit option
        let limit: number | undefined;
        if (options.limit) {
          limit = parseInt(options.limit, 10);
          if (isNaN(limit) || limit <= 0) {
            throw new Error("Limit must be a positive number");
          }
        }

        // Initialize services
        const embeddingService = new EmbeddingService();
        const turbopufferClient = new TurbopufferClient();

        // Test connections
        const connectionSpinner = ora("Testing service connections...").start();
        if (!options.skipEmbeddings) {
          const embeddingTestResult = await embeddingService.testConnection();
          if (!embeddingTestResult) {
            connectionSpinner.fail("Failed to connect to OpenAI");
            throw new Error(
              "Failed to connect to OpenAI. Please check your API key."
            );
          }
        }
        connectionSpinner.succeed("Service connections tested successfully");

        // Load tweets from file
        const loadingSpinner = ora(`Loading tweets from ${file}...`).start();
        let tweetData = await TweetProcessor.loadTweetsFromFile(file);

        if (tweetData.length === 0) {
          loadingSpinner.fail("No tweets found in file");
          throw new Error("No tweets found in the file");
        }
        loadingSpinner.succeed(`Loaded ${tweetData.length} tweets from file`);

        // Apply limit if specified
        const originalCount = tweetData.length;
        if (limit && limit < tweetData.length) {
          tweetData = tweetData.slice(0, limit);
          console.log(
            chalk.yellow(
              `🔢 Limited to ${limit} tweets (from ${originalCount} total)`
            )
          );
        }

        // Process tweets
        const processingSpinner = ora(
          `Processing ${tweetData.length} tweets...`
        ).start();
        const processedTweets = await TweetProcessor.processTweets(
          tweetData,
          (processed, total) => {
            processingSpinner.text = `Processing tweets: ${processed}/${total}`;
          }
        );
        processingSpinner.succeed(
          `Processed ${processedTweets.length} tweets successfully`
        );

        // Initialize turbopuffer if not in dry run mode
        if (!options.dryRun) {
          const initSpinner = ora("Preparing to store tweets...").start();
          initSpinner.succeed("Ready to store tweets");
        }

        // Show embedding cost estimate
        const costEstimate = embeddingService.estimateCost(
          processedTweets.length
        );
        console.log(
          chalk.yellow(
            `💰 Estimated embedding cost: $${costEstimate.estimatedCost} (${costEstimate.estimatedTokens} tokens)`
          )
        );

        // Process in batches: generate embeddings and store in turbopuffer
        const totalBatches = Math.ceil(processedTweets.length / batchSize);
        let totalEmbeddingsGenerated = 0;
        let totalTweetsStored = 0;

        console.log(chalk.blue(`\n🔄 Processing ${totalBatches} batches...`));

        for (let i = 0; i < processedTweets.length; i += batchSize) {
          const batch = processedTweets.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;

          console.log(
            chalk.gray(
              `📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tweets)...`
            )
          );

          // Generate embeddings for this batch
          let batchEmbeddings: number[][] = [];
          if (!options.skipEmbeddings) {
            const tweetTexts = batch.map((tweet) => tweet.text);
            batchEmbeddings = await embeddingService.generateEmbeddings(
              tweetTexts
            );
            totalEmbeddingsGenerated += batchEmbeddings.length;
          } else {
            // Create dummy embeddings for testing
            batchEmbeddings = batch.map(() => new Array(1536).fill(0));
          }

          // Prepare turbopuffer rows for this batch
          const batchTurbopufferRows: TurbopufferRow[] = batch.map(
            (tweet, index) => {
              const embedding = batchEmbeddings[index];
              if (!embedding) {
                throw new Error(
                  `Missing embedding for tweet at index ${index}`
                );
              }

              return {
                id: tweet.id,
                vector: embedding,
                text: tweet.text,
                created_at: tweet.created_at,
                favorite_count: tweet.favorite_count,
                retweet_count: tweet.retweet_count,
                has_urls: tweet.has_urls,
                has_mentions: tweet.has_mentions,
                has_hashtags: tweet.has_hashtags,
              };
            }
          );

          // Store batch in turbopuffer
          if (!options.dryRun) {
            const storageSpinner = ora(
              `Storing batch ${batchNumber}/${totalBatches} (${batch.length} tweets)...`
            ).start();
            await turbopufferClient.upsertTweets(batchTurbopufferRows);
            totalTweetsStored += batch.length;
            storageSpinner.succeed(
              `Stored batch ${batchNumber}/${totalBatches} (${batch.length} tweets)`
            );
          } else {
            console.log(
              chalk.yellow("⚠️  Dry run mode - skipping turbopuffer storage")
            );
          }

          // Clear batch data from memory
          batchEmbeddings = [];
          batchTurbopufferRows.length = 0;
        }

        // Summary
        console.log(chalk.green("\n📊 Ingestion Summary:"));
        if (limit && limit < originalCount) {
          console.log(
            chalk.white(`• Original tweets in file: ${originalCount}`)
          );
          console.log(chalk.white(`• Limited to: ${limit} tweets`));
        }
        console.log(
          chalk.white(`• Tweets processed: ${processedTweets.length}`)
        );
        console.log(
          chalk.white(`• Embeddings generated: ${totalEmbeddingsGenerated}`)
        );
        console.log(chalk.white(`• Tweets stored: ${totalTweetsStored}`));
        console.log(chalk.white(`• Batch size: ${batchSize}`));
        console.log(chalk.white(`• Total batches: ${totalBatches}`));
        console.log(chalk.white(`• Dry run: ${options.dryRun ? "Yes" : "No"}`));
        console.log(
          chalk.white(
            `• Skip embeddings: ${options.skipEmbeddings ? "Yes" : "No"}`
          )
        );

        console.log(
          chalk.green("\n🎉 Tweet ingestion completed successfully!")
        );
      } catch (error) {
        console.error(chalk.red("❌ Error:"), error);

        // Provide helpful error messages
        if (error instanceof Error) {
          if (error.message.includes("ENOENT")) {
            console.error(
              chalk.red(
                "💡 Make sure the file path is correct and the file exists"
              )
            );
          } else if (error.message.includes("JSON")) {
            console.error(
              chalk.red("💡 Make sure the file contains valid JSON")
            );
          } else if (error.message.includes("OpenAI")) {
            console.error(
              chalk.red(
                "💡 Check your OpenAI API key in the environment variables"
              )
            );
          } else if (error.message.includes("TURBOPUFFER")) {
            console.error(
              chalk.red(
                "💡 Check your Turbopuffer API key in the environment variables"
              )
            );
          }
        }

        process.exit(1);
      }
    }
  );
