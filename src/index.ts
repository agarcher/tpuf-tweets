#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { ingestCommand } from "./commands/ingest.js";
import { searchCommand } from "./commands/search.js";
import { queryCommand } from "./commands/query.js";
import { ingestPdfsCommand } from "./commands/ingest-pdfs.js";
import { queryPdfsCommand } from "./commands/query-pdfs.js";

// Load environment variables
config();

const program = new Command();

program
  .name("tweet-search")
  .description("A CLI tool for ingesting tweets and performing hybrid search")
  .version("1.0.0");

// Add commands
program.addCommand(ingestCommand);
program.addCommand(searchCommand);
program.addCommand(queryCommand);
program.addCommand(ingestPdfsCommand);
program.addCommand(queryPdfsCommand);

// Parse arguments
program.parse(process.argv);
