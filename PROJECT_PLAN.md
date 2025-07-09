# Tweet Search CLI with Turbopuffer - Project Plan

## Overview

Build a TypeScript CLI tool that ingests tweets, generates embeddings using OpenAI, stores them in turbopuffer with full-text search capabilities, and provides a hybrid search interface.

## Project Structure

```
tweet-search-cli/
├── src/
│   ├── commands/
│   │   ├── ingest.ts      # Tweet ingestion command
│   │   ├── search.ts      # Interactive search command
│   │   └── query.ts       # Direct query command
│   ├── lib/
│   │   ├── turbopuffer.ts # Turbopuffer client wrapper
│   │   ├── embeddings.ts  # OpenAI embedding generation
│   │   ├── tweets.ts      # Tweet processing utilities
│   │   └── config.ts      # Configuration management
│   ├── types/
│   │   └── index.ts       # TypeScript interfaces
│   └── index.ts           # Main CLI entry point
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Phase 1: Project Foundation ✅

### Tasks

- [x] Initialize TypeScript project with proper configuration
- [x] Set up package.json with required dependencies
- [x] Create tsconfig.json with appropriate compiler options
- [x] Set up build system and executable configuration

### Dependencies

```json
{
  "dependencies": {
    "@turbopuffer/turbopuffer": "latest",
    "openai": "latest",
    "commander": "latest",
    "dotenv": "latest",
    "chalk": "latest",
    "ora": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "typescript": "latest",
    "tsx": "latest"
  }
}
```

### ✅ Phase 1 Completion Status

**Date Completed**: January 2025

**Key Accomplishments:**

- ✅ Complete TypeScript project setup with ES2020 modules
- ✅ Working CLI with commander.js framework
- ✅ All dependencies installed and configured
- ✅ Build system functional (`npm run build` works)
- ✅ CLI executable working (`node dist/index.js --help`)
- ✅ Project structure matches planned architecture
- ✅ TypeScript interfaces defined for all data structures
- ✅ Configuration management with environment variables
- ✅ Comprehensive README documentation
- ✅ Placeholder implementations ready for Phase 2

**Files Created:**

- `package.json` - Project configuration and dependencies
- `tsconfig.json` - TypeScript compiler configuration
- `src/index.ts` - Main CLI entry point
- `src/commands/` - CLI command implementations
- `src/lib/` - Core library modules
- `src/types/` - TypeScript interface definitions
- `env.example` - Environment variable template
- `README.md` - Project documentation

## Phase 2: Data Architecture ✅

**Date Completed**: January 2025

**Key Accomplishments:**

- ✅ All TypeScript interfaces (`TweetData`, `ProcessedTweet`, `TurbopufferRow`, `SearchOptions`) are defined in `src/types/index.ts`.
- ✅ Data structures accurately reflect the source tweet format and the target format for Turbopuffer.
- ✅ Type safety is established across the entire data processing pipeline.

### TypeScript Interfaces

```typescript
interface TweetData {
  tweet: {
    id_str: string;
    full_text: string;
    created_at: string; // Format: "Tue Jul 08 13:40:22 +0000 2025"
    favorite_count: string; // Note: comes as string, not number
    retweet_count: string; // Note: comes as string, not number
    retweeted: boolean;
    favorited: boolean;
    lang: string;
    possibly_sensitive: boolean;
    entities: {
      hashtags: any[];
      symbols: any[];
      user_mentions: any[];
      urls: any[];
    };
    edit_info?: {
      initial: {
        editTweetIds: string[];
        editableUntil: string;
        editsRemaining: string;
        isEditEligible: boolean;
      };
    };
    // Additional fields from Twitter export
  };
}

interface ProcessedTweet {
  id: string;
  text: string;
  created_at: string; // Converted to ISO string
  favorite_count: number;
  retweet_count: number;
  has_urls: boolean;
  has_mentions: boolean;
  has_hashtags: boolean;
}

interface TurbopufferRow {
  id: string;
  vector: number[];
  text: string;
  created_at: string; // ISO string for filtering
  favorite_count: number;
  retweet_count: number;
  has_urls: boolean;
  has_mentions: boolean;
  has_hashtags: boolean;
}

interface SearchOptions {
  query: string;
  type: "semantic" | "keyword" | "hybrid";
  dateAfter?: string;
  dateBefore?: string;
  limit?: number;
  minFavorites?: number;
  minRetweets?: number;
}
```

## Phase 3: Core Processing Pipeline ✅

**Date Completed**: January 2025

**Key Accomplishments:**

- ✅ **Tweet Ingestion**: Robustly loads tweets from JSON, validates data structures, and handles invalid records gracefully (`tweets.ts`).
- ✅ **Embedding Generation**: Integrates with OpenAI `text-embedding-3-small` model, featuring batch processing, rate-limiting, and retry logic (`embeddings.ts`).
- ✅ **Data Transformation**: Efficiently processes raw tweet data into a clean, searchable format for Turbopuffer (`tweets.ts`).

### Tweet Ingestion Module

- [x] JSON file reader with validation
- [x] Tweet data structure validation
- [x] Progress tracking for large datasets
- [x] Error handling and recovery

### Embedding Generation

- [x] OpenAI API integration
- [x] Batch processing for efficiency
- [x] Rate limiting and retry logic
- [x] Cost optimization (use text-embedding-3-small)

### Data Transformation

- [x] Convert tweets to turbopuffer format
- [x] Handle missing or malformed data
- [x] Prepare metadata for filtering
- [x] Parse Twitter date format ("Tue Jul 08 13:40:22 +0000 2025") to ISO strings
- [x] Convert string numbers (favorite_count, retweet_count) to integers
- [x] Extract boolean flags for content types (has_urls, has_mentions, has_hashtags)
- [x] Handle nested tweet.entities structure for URL/mention/hashtag detection
- [x] Validate required fields (id_str, full_text, created_at)
- [x] Skip processing language and sensitivity fields (not needed for search)

## Phase 4: Turbopuffer Integration 🟡 In Progress

### Schema Configuration

```typescript
const schema = {
  text: {
    type: "string",
    full_text_search: true,
  },
  created_at: {
    type: "string", // ISO date string for filtering
    filterable: true,
  },
  favorite_count: {
    type: "integer",
    filterable: true,
  },
  retweet_count: {
    type: "integer",
    filterable: true,
  },
  has_urls: {
    type: "boolean",
    filterable: true,
  },
  has_mentions: {
    type: "boolean",
    filterable: true,
  },
  has_hashtags: {
    type: "boolean",
    filterable: true,
  },
};
```

### Client Wrapper Tasks

- [x] Turbopuffer client initialization
- [x] Namespace management
- [x] Batch upsert operations
- [ ] Query interface with filtering
- [x] Error handling and retries

## Phase 5: CLI Interface 🟡 In Progress

### Command Structure

```bash
tweet-search <command> [options]

Commands:
  ingest [file]           Ingest tweets from JSON file
  search                  Interactive search interface
  query <query>           Direct query with options

Options:
  --help                  Show help
  --version               Show version
```

### Command Implementation

- [x] Main CLI entry point with commander.js
- [x] Help documentation and examples
- [ ] Configuration file support (Deferred)
- [x] Environment variable handling

## Phase 6: Search Features 🔜

### Search Types

1. **Semantic Search**: Vector similarity using embeddings
2. **Keyword Search**: BM25 full-text search
3. **Hybrid Search**: Combined vector + full-text + date filtering

### Search Interface

- [ ] Interactive prompt system
- [ ] Date range input handling
- [ ] Search type selection
- [ ] Result formatting and pagination

### Query Examples

```bash
# Ingest tweets
npx tweet-search ingest tweets.json

# Interactive search
npx tweet-search search

# Direct semantic search
npx tweet-search query "machine learning" --type semantic --limit 10

# Hybrid search with date filter
npx tweet-search query "AI trends" --type hybrid --after 2023-01-01 --before 2023-12-31

# Keyword search
npx tweet-search query "typescript" --type keyword --limit 5
```

## Phase 7: Advanced Features 🔜

### Additional Functionality

- [ ] Search result export (JSON, CSV)
- [ ] Tweet statistics and analytics
- [ ] Similarity clustering
- [ ] Trending topics analysis

### Performance Optimizations

- [ ] Embedding caching
- [ ] Incremental updates
- [ ] Parallel processing
- [ ] Memory usage optimization

## Phase 8: Build System 🔜

### Build Configuration

- [ ] TypeScript compilation setup
- [ ] Executable binary creation
- [ ] Distribution packaging
- [ ] Cross-platform compatibility

### Development Tools

- [ ] Development server with hot reload
- [ ] Testing framework setup
- [ ] Linting and formatting
- [ ] CI/CD pipeline

## Phase 9: Documentation 🔜

### Documentation Tasks

- [ ] Comprehensive README
- [ ] API documentation
- [ ] Usage examples
- [ ] Tweet JSON format specification
- [ ] Troubleshooting guide

### README Structure

```markdown
# Tweet Search CLI

## Installation

## Configuration

## Usage Examples

## Tweet JSON Format

## Search Types

## Advanced Features

## Troubleshooting
```

### Tweet JSON Format

The actual structure of `tweets.json` file (located in repo root):

```json
[
  {
    "tweet": {
      "id_str": "1942579514904592803",
      "full_text": "did not happen again after upgrade, to rebuild trust though I'm really going to need visibility to the actual state of my mysterious cloak and dagger rate limits",
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
        "urls": [
          {
            "url": "https://t.co/fcOz5nBHxE",
            "expanded_url": "https://x.com/agarcher/status/1942358971714568334",
            "display_url": "x.com/agarcher/statu…",
            "indices": ["162", "185"]
          }
        ]
      },
      "edit_info": {
        "initial": {
          "editTweetIds": ["1942579514904592803"],
          "editableUntil": "2025-07-08T14:40:22.000Z",
          "editsRemaining": "5",
          "isEditEligible": true
        }
      }
    }
  }
]
```

### Search Filter Syntax

```typescript
// Date range filtering
["created_at", "Gte", "2023-01-01T00:00:00Z"][
  // Engagement filtering
  ("favorite_count", "Gt", 100)
][("retweet_count", "Gt", 10)][
  // Content type filtering
  ("has_urls", "Eq", true)
][("has_mentions", "Eq", true)][("has_hashtags", "Eq", true)][
  // Combined filters
  ("And",
  [
    ["created_at", "Gte", "2023-01-01T00:00:00Z"],
    ["favorite_count", "Gt", 10],
    ["has_urls", "Eq", true],
  ])
];
```

## Success Criteria

- [ ] Successfully ingest large tweet datasets (10k+ tweets)
- [ ] Generate embeddings with < 1 second per tweet average
- [ ] Perform hybrid searches with < 500ms response time
- [ ] Handle edge cases and errors gracefully
- [ ] Provide intuitive CLI interface
- [ ] Include comprehensive documentation

## Future Enhancements

- Web interface for search results
- Real-time tweet streaming integration
- Advanced analytics and visualizations
- Multi-language support
- Custom embedding models
- Collaborative filtering features

---

## Getting Started

1. ✅ Set up project structure
2. ✅ Configure environment variables
3. ✅ Install dependencies
4. 🔜 Implement core modules
5. 🔜 Build and test CLI commands
6. 🔜 Deploy and distribute

This plan serves as a living document that will be updated as the project progresses.

## Current Status

**✅ Phase 1 Complete**: Project foundation established with TypeScript setup, CLI framework, and all dependencies installed.

**✅ Phase 2-3 Complete**: Core data architecture and processing pipeline are implemented. Turbopuffer ingestion is functional.

**🟡 Phase 4-5 In Progress**: Turbopuffer client can upsert data, and the `ingest` command is fully functional.

**🔜 Next: Phase 4 & 6**: Complete the Turbopuffer query interface and build out the search features.

## Technical Specifications

### Environment Variables

```bash
TURBOPUFFER_API_KEY=your_turbopuffer_key
OPENAI_API_KEY=your_openai_key
TURBOPUFFER_REGION=gcp-us-central1
TURBOPUFFER_NAMESPACE=tweets-agarcher
```
