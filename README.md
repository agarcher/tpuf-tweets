# Tweet Search CLI

A TypeScript CLI tool that ingests tweets, generates embeddings using OpenAI, stores them in turbopuffer with full-text search capabilities, and provides a hybrid search interface.

## Features

- **Tweet Ingestion**: Load tweets from JSON files and process them for search
- **Embedding Generation**: Generate semantic embeddings using OpenAI
- **Hybrid Search**: Combine semantic search, keyword search, and metadata filtering
- **Interactive Interface**: Command-line interface for easy searching
- **Turbopuffer Integration**: Store and search tweets using turbopuffer's vector database

## Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Turbopuffer API key
- OpenAI API key

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd tweet-search-cli
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp env.example .env
# Edit .env with your API keys
```

4. Build the project:

```bash
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Turbopuffer Configuration
TURBOPUFFER_API_KEY=your_turbopuffer_key_here
TURBOPUFFER_REGION=gcp-us-central1
TURBOPUFFER_NAMESPACE=tweets-agarcher

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=text-embedding-3-small
```

## Usage

### Development

Run the CLI in development mode:

```bash
npm run dev <command> [options]
```

### Production

Build and run the CLI:

```bash
npm run build
npm start <command> [options]
```

### Commands

#### Ingest Tweets

```bash
# Full ingestion
npx tweet-search ingest tweets.json

# Test with limited number of tweets
npx tweet-search ingest tweets.json --limit 10

# Test with dry run and limited tweets
npx tweet-search ingest tweets.json --limit 5 --dry-run --skip-embeddings
```

#### Interactive Search

```bash
npx tweet-search search
```

#### Direct Query

```bash
# Semantic search
npx tweet-search query "machine learning" --type semantic --limit 10

# Hybrid search with date filter
npx tweet-search query "AI trends" --type hybrid --after 2023-01-01 --before 2023-12-31

# Keyword search
npx tweet-search query "typescript" --type keyword --limit 5
```

### Query Options

- `--type`: Search type (semantic, keyword, hybrid) - default: hybrid
- `--limit`: Maximum number of results - default: 10
- `--after`: Filter tweets after this date (ISO format)
- `--before`: Filter tweets before this date (ISO format)
- `--min-favorites`: Minimum favorite count
- `--min-retweets`: Minimum retweet count

### Ingest Options

- `-b, --batch-size <size>`: Batch size for processing - default: 100
- `-l, --limit <count>`: Limit number of tweets to process (for testing)
- `--dry-run`: Process tweets but don't store in turbopuffer
- `--skip-embeddings`: Skip embedding generation (for testing)

## Tweet JSON Format

The tool expects tweets in the following JSON format:

```json
[
  {
    "tweet": {
      "id_str": "1942579514904592803",
      "full_text": "Tweet content here...",
      "created_at": "Tue Jul 08 13:40:22 +0000 2025",
      "favorite_count": "0",
      "retweet_count": "0",
      "retweeted": false,
      "favorited": false,
      "lang": "en",
      "possibly_sensitive": false,
      "entities": {
        "hashtags": [],
        "symbols": [],
        "user_mentions": [],
        "urls": []
      }
    }
  }
]
```

## Development

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run in development mode with hot reload
- `npm run clean` - Clean the build directory
- `npm start` - Run the built CLI

### Project Structure

```
tweet-search-cli/
├── src/
│   ├── commands/          # CLI command implementations
│   │   ├── ingest.ts      # Tweet ingestion command
│   │   ├── search.ts      # Interactive search command
│   │   └── query.ts       # Direct query command
│   ├── lib/               # Core libraries
│   │   ├── turbopuffer.ts # Turbopuffer client wrapper
│   │   ├── embeddings.ts  # OpenAI embedding generation
│   │   ├── tweets.ts      # Tweet processing utilities
│   │   └── config.ts      # Configuration management
│   ├── types/             # TypeScript interfaces
│   │   └── index.ts       # Data type definitions
│   └── index.ts           # Main CLI entry point
├── dist/                  # Built JavaScript files
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── env.example           # Environment variable template
└── README.md             # This file
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
