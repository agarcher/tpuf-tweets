import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { validateConfig } from "../lib/config.js";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {
  RecursiveCharacterTextSplitter,
  CharacterTextSplitter,
  TokenTextSplitter,
} from "langchain/text_splitter";
import { EmbeddingService } from "../lib/embeddings.js";
import { v4 as uuidv4 } from "uuid";
import { Turbopuffer } from "@turbopuffer/turbopuffer";

export const ingestPdfsCommand = new Command()
  .name("ingest-pdfs")
  .description(
    "Ingest PDFs from a directory using a specific chunking strategy"
  )
  .argument("<directory>", "Path to directory of PDFs")
  .argument(
    "<strategy>",
    "Chunking strategy: 'character', 'token', or 'recursive'"
  )
  .option(
    "-c, --chunk-size <size>",
    "Size of text chunks (characters for 'character' and 'recursive', tokens for 'token')",
    "1000"
  )
  .option(
    "-o, --chunk-overlap <overlap>",
    "Overlap between chunks (characters for 'character' and 'recursive', tokens for 'token')",
    "200"
  )
  .option(
    "-l, --limit <number>",
    "Limit the number of documents to process (default: process all documents)",
    (value) => parseInt(value, 10)
  )
  .action(
    async (
      directory: string,
      strategy: "character" | "token" | "recursive",
      options: { chunkSize: string; chunkOverlap: string; limit?: number }
    ) => {
      try {
        // Validate configuration
        if (!validateConfig()) {
          throw new Error(
            "Invalid configuration. Please check your environment variables."
          );
        }

        const chunkSize = parseInt(options.chunkSize, 10);
        const chunkOverlap = parseInt(options.chunkOverlap, 10);

        if (isNaN(chunkSize) || chunkSize <= 0) {
          throw new Error("Chunk size must be a positive number");
        }

        if (isNaN(chunkOverlap) || chunkOverlap < 0) {
          throw new Error("Chunk overlap must be a non-negative number");
        }

        if (chunkOverlap >= chunkSize) {
          throw new Error("Chunk overlap must be less than chunk size");
        }

        if (
          options.limit !== undefined &&
          (isNaN(options.limit) || options.limit <= 0)
        ) {
          throw new Error("Document limit must be a positive number");
        }

        console.log(`Loading PDFs from ${directory}...`);

        // Load all PDFs within the specified directory
        const directoryLoader = new DirectoryLoader(directory, {
          ".pdf": (path: string) => new PDFLoader(path, { splitPages: false }),
        });

        let docs = await directoryLoader.load();

        // Apply document limit if specified
        if (options.limit !== undefined && options.limit < docs.length) {
          console.log(`Limiting to first ${options.limit} documents...`);
          docs = docs.slice(0, options.limit);
        }

        console.log(`✔ Loaded ${docs.length} PDF documents`);

        let textSplitter;
        let namespaceName;

        switch (strategy) {
          case "character":
            textSplitter = new CharacterTextSplitter({
              chunkSize,
              chunkOverlap,
              separator: " ",
            });
            namespaceName = "chunk-character";
            break;
          case "token":
            textSplitter = new TokenTextSplitter({
              chunkSize,
              chunkOverlap,
            });
            namespaceName = "chunk-token";
            break;
          case "recursive":
            textSplitter = new RecursiveCharacterTextSplitter({
              chunkSize,
              chunkOverlap,
            });
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

        console.log(`Using '${strategy}' chunking strategy.`);

        // Split text into chunks
        const splittingSpinner = ora(
          "Splitting documents into chunks..."
        ).start();
        const splitDocs = await textSplitter.splitDocuments(docs);
        splittingSpinner.succeed(
          `Split ${docs.length} documents into ${splitDocs.length} chunks`
        );

        // Create embeddings
        console.log(`Creating embeddings for ${splitDocs.length} chunks...`);
        const embeddingService = new EmbeddingService();
        const embeddings = await embeddingService.generateEmbeddings(
          splitDocs.map((doc) => doc.pageContent)
        );
        console.log("✔ Embeddings created successfully");

        const validRows: {
          id: string;
          vector: number[];
          text: string;
          [key: string]: any;
        }[] = [];
        for (let i = 0; i < splitDocs.length; i++) {
          const doc = splitDocs[i];
          const embedding = embeddings[i];
          if (doc && embedding) {
            validRows.push({
              id: uuidv4(),
              vector: embedding,
              text: doc.pageContent,
              title: doc.metadata.pdf.info.Title,
              author: doc.metadata.pdf.info.Author,
            });
          }
        }

        // Ingest to Turbopuffer
        const tpuf = new Turbopuffer({
          apiKey: process.env.TURBOPUFFER_API_KEY,
          region: process.env.TURBOPUFFER_REGION,
        });
        const ns = tpuf.namespace(namespaceName);

        const spinner = ora(
          `Deleting all documents from namespace: ${namespaceName}...`
        ).start();
        try {
          await ns.deleteAll();
          spinner.succeed("Namespace deleted successfully");
        } catch (error) {
          spinner.succeed("Namespace does not exist yet");
        }

        const ingestSpinner = ora(
          `Ingesting embeddings into Turbopuffer namespace: ${namespaceName}...`
        ).start();

        await ns.write({
          upsert_rows: validRows,
          schema: {
            text: {
              type: "string",
              full_text_search: true,
            },
            title: {
              type: "string",
              full_text_search: true,
            },
            author: {
              type: "string",
              full_text_search: true,
            },
          },
          distance_metric: "cosine_distance",
        });

        ingestSpinner.succeed(
          `Successfully ingested ${validRows.length} documents into namespace "${namespaceName}"`
        );
      } catch (error) {
        console.error(chalk.red("❌ Error:"), error);
        process.exit(1);
      }
    }
  );
