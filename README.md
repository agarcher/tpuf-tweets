# tpuf tweets

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
cd tpuf-tweets
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

## Getting Your Tweet Data

This tool is designed to work with your personal X (formerly Twitter) data archive.

### 1. Download Your Archive from X

1.  Log in to your X account on the web or mobile app.
2.  Go to **Settings and privacy**.
3.  Select **Your account**.
4.  Choose **Download an archive of your data**.
5.  Confirm your password and request the archive. You will receive an email or in-app notification when your archive is ready.
6.  Download the `.zip` file containing your data.

### 2. Prepare `tweets.json`

Inside the downloaded archive, you will find a `data/tweets.js` file. This is a JavaScript file, not a valid JSON file. You need to modify it to create a `tweets.json` file that this tool can use.

1.  Unzip the archive you downloaded from X.
2.  Find the file located at `data/tweets.js`.
3.  This file contains your tweets assigned to a `window.YTD.tweets.part0` variable. Open it in a text editor.
4.  Remove the `window.YTD.tweets.part0 = ` prefix from the beginning of the file to leave only the raw JSON array of tweets.
5.  Save this modified file as `tweets.json` in the root of this project.

After performing these steps and setting up your environment variables as described below, you can ingest your tweets.

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

### Development Workflow

There are several ways to run the CLI during development:

1. **Watch Mode** - Automatically rebuild on changes:

```bash
npm run watch
```

2. **Direct CLI Usage** - Run commands directly from source:

```bash
npm run cli -- <command> [options]
# Example: npm run cli -- query my query
```

Note: The `--` is important as it separates arguments meant for `npm` from arguments meant for your script. This ensures that options are passed correctly to your CLI tool instead of being intercepted by npm.

3. **Global Installation** - Make the CLI available system-wide:

```bash
# Install globally
npm run link

# Use from anywhere
tpuf-tweets <command> [options]

# Remove global installation
npm run unlink
```

### Commands

#### Ingest Tweets

```bash
# Using direct CLI
npm run cli -- ingest tweets.json

# If globally installed
tpuf-tweets ingest tweets.json

# Test with limited number of tweets
npm run cli -- ingest tweets.json --limit 10

# Test with dry run and limited tweets
npm run cli -- ingest tweets.json --limit 5 --dry-run --skip-embeddings
```

#### Interactive Search

```bash
npm run cli -- search
# Or if globally installed: tpuf-tweets search
```

#### Direct Query

```bash
# Semantic search
npm run cli -- query "machine learning" --type semantic --limit 10

# Hybrid search with date filter
npm run cli -- query "AI trends" --type hybrid --after 2023-01-01 --before 2023-12-31

# Keyword search
npm run cli -- query "typescript" --type keyword --limit 5
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
- `npm run watch` - Watch mode: automatically rebuild on changes
- `npm run clean` - Clean the build directory
- `npm run cli --` - Run CLI commands directly from TypeScript source
- `npm run link` - Install the CLI globally
- `npm run unlink` - Remove global CLI installation

### Project Structure

```
tpuf-tweets/
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
