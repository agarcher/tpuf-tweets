# Advanced Hybrid Search

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Chunking and Indexing                                  │
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ PDF Parsing │─▶│   Chunking    │─▶│ Embeddings  │─▶│   turbopuffer       │   │
│  └─────────────┘  └───────────────┘  └─────────────┘  └─────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────────┐
│                          Hybrid Search Retrieval                                │
│                       ┌──────────────┐                                          │
│                    ┌─▶│   Vector     │──┐                                       │
│                    │  │   Search     │  │                                       │
│  ┌─────────────┐   │  └──────────────┘  │  ┌──────────────┐    ┌─────────────┐  │
│  │ User Query  │───┤                    │─▶│ Rank Fusion  │───▶│ Re-ranking  │  │
│  └─────────────┘   │  ┌──────────────┐  │  └──────────────┘    └─────────────┘  │
│                    │  │ BM25 Search  │  │                                       │
│                    └─▶│   (FTS)      │──┘                                       │
│                       └──────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

This expands on our [Hybrid Search guide](https://turbopuffer.com/docs/hybrid) and explores techniques for improving search accuracy with large datasets of unstructured documents. We'll compare different chunking strategies and evaluate their impact on search quality using turbopuffer's vector and BM25 full-text search capabilities, then explore multiple rank fusion, reranking approaches, and evaluation methodologies.

We will use [this collection](https://example.com/link/to/zip) of PDF papers on large language models from https://arxiv.org/ for the purposes of this guide.

## Chunking and Indexing

As the source doucments are PDFs we will first need to extract their text. We'll use [LangChain](https://www.langchain.com/)'s PDF parser for this guide. We'll contrast three basic chunking strategies, generate embeddings using OpenAI's `text-embedding-3-small` model, and index everything in turbopuffer for hybrid search capabilities.

```typescript
// Load PDF documents from directory, don't split pages as we will chunk later
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
const directoryLoader = new DirectoryLoader("./data", {
  ".pdf": (path: string) => new PDFLoader(path, { splitPages: false }),
});
const docs = await directoryLoader.load();

// Chunk documents using fixed length character blocks
import { CharacterTextSplitter } from "langchain/text_splitter";
const textSplitter = new CharacterTextSplitter({
  chunkSize: 5000,
  chunkOverlap: 1000,
});
const splitDocs = await textSplitter.splitDocuments(docs);
console.log(`Split ${docs.length} documents into ${splitDocs.length} chunks`);
// Split 100 documents into 1873 chunks

// Generate embeddings using OpenAI (in practice you'll need to work in batches to avoid timeouts)
import OpenAI from "openai";
const openai = new OpenAI();
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: splitDocs.map((doc) => doc.pageContent),
});
const embeddings = response.data.map((item) => item.embedding);

// Prepare data for turbopuffer ingestion
import { v4 as uuidv4 } from "uuid";
const validRows = splitDocs.map((doc, i) => ({
  id: uuidv4(),
  vector: embeddings[i],
  text: doc.pageContent,
  title: doc.metadata.pdf.info.Title,
}));

// Create turbopuffer client and ingest data
import { Turbopuffer } from "@turbopuffer/turbopuffer";
const tpuf = new Turbopuffer({
  apiKey: process.env.TURBOPUFFER_API_KEY,
  region: "gcp-us-central1",
});
const ns = tpuf.namespace("chunk-character");

await ns.write({
  upsert_rows: validRows,
  schema: {
    text: { type: "string", full_text_search: true },
  },
  distance_metric: "cosine_distance",
});

// Recursive character-based chunking
// Attempt to preserve semantic document structure while respecting character limits
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
const characterSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 5000,
  chunkOverlap: 1000,
});
// Split 100 documents into 2032 chunks
// ... repeat embedding and ingestion process with namespace "chunk-structure"

// Token based chunking
// Chunk with fixed lengths based on tokens instead of characters
import { TokenTextSplitter } from "langchain/text_splitter";
const tokenSplitter = new TokenTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
// Split 100 documents into 2784 chunks
// ... repeat embedding and ingestion process with namespace "chunk-token"
```

We created three namespaces in turbopuffer each with the documents chunked with slightly different strategies:

- `chunk-character`: Documents are chunked into fixed length based on character count with a small overlap.
- `chunk-structure`: Documents are chunked with an attempt to keep semantic structure (e.g. paragraphs, sentences, etc.) intact while respecting fixed length limits where possible.
- `chunk-token`: Documents are chunked into fixed length based on token count with a small overlap.

Character and token based chunking strategies with fixed limits perform similarly. One advantage of token based chunking is that the results will yield a consistent token count which is useful in building context for large language model queries.

Let's try some searches against the `chunk-structure` and `chunk-token` namespaces and see how they perform.

```typescript
// Query token-based chunking approach
const query = "effective strategies for benchmarking llm generated code quality";
const queryEmbedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: [query],
});

const tokenNs = tpuf.namespace("chunk-token");
const tokenResults = await tokenNs.query({
  rank_by: ["vector", "ANN", queryEmbedding.data[0].embedding],
  top_k: 3,
  include_attributes: ["text", "title"],
});

// Log results
tokenResults.forEach((result, i) => {
  const truncatedText = `${result.text.substring(0, 100)}...`;
  const dist = result.$dist.toFixed(4);
  console.log(`[${i + 1}] Distance: ${dist}\n📄 ${result.title}\n${truncatedText}\n`);
});

/* Token-based results:
[1] Distance: 0.4230
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
arXiv:2505.24826v1  [cs.CL]  30 May 2025
LegalEval-Q: A New Benchmark for The Quality Evaluation of
...

[2] Distance: 0.4428
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
 resultant textual
quality remains poorly understood. These gaps hin-
der model selection and optimi...

[3] Distance: 0.4512
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
 natural language generation(NLG) studies
(Kasai et al., 2021), these metrics exhibit fundamen-
tal ...
*/

// Query structure-based chunking approach
const structureNs = tpuf.namespace("chunk-structure");
const structureResults = await structureNs.query({
  rank_by: ["vector", "ANN", queryEmbedding.data[0].embedding],
  top_k: 3,
  include_attributes: ["text", "title", "author"],
});

/* Structure-based results:
[1] Distance: 0.4218
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
arXiv:2505.24826v1  [cs.CL]  30 May 2025
LegalEval-Q: A New Benchmark for The Quality Evaluation of
...

[2] Distance: 0.4792
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
arXiv:2505.24324v1  [cs.LG]  30 May 2025
© Ivan Petrukha, Yana Kurliak, Nataliia Stulova, accepted f...

[3] Distance: 0.4796
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
A.  Guha,  M.  Greenberg,  and  A.  Jangda,  “MultiPL-E:  A  Scalable  and
Extensible Approach to Be...
*/
```

In theory, the structure based approach should yield better results as it attempts to maintain semantic context. In practice, its ability to do this is negated by the noise introduced in PDF text extraction. This is clear from the lack of sentence structure in the result text. Both chunking approaches perform similarly poorly, with a negligible difference in the top result (distance `0.4218` vs `0.4230`).

To improve the results here, we could preprocessing the PDF to eliminate noise. Smaller chunk sizes may also help to produce focus the results more narrowly on the valuable portions of the text.

In reality, all chunking strategies we explored are primitive and we suggest you reach for more advanced techniques like tuning chunking directly to your specific document structure or using a [semantic meaning based](https://js.langchain.com/docs/concepts/text_splitters/#semantic-meaning-based) approach.

## Hybrid Search Retrieval

While individual vector or BM25 searches can be effective, combining them through hybrid search often yields superior results by leveraging both semantic understanding and keyword matching. turbopuffer's `multiQuery` allows us to execute both search types simultaneously.

We'll explore how to implement hybrid search and fuse results using a couple different algorithms (RRF and DBSF), and then enhance the results using external reranking services like [Cohere](https://cohere.com/rerank) or [Voyage](https://docs.voyageai.com/docs/reranker).

```typescript
// Hybrid search with simultaneous vector and BM25 queries
const query = "effective strategies for benchmarking llm generated code quality";
const queryEmbedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: [query],
});

// Execute both searches simultaneously using multiQuery
const ns = tpuf.namespace("chunk-token");
const multiQueryResult = await ns.multiQuery({
  queries: [
    {
      rank_by: ["vector", "ANN", queryEmbedding.data[0].embedding],
      top_k: 10,
      include_attributes: ["id", "text", "title"],
    },
    {
      rank_by: ["text", "BM25", query],
      top_k: 10,
      include_attributes: ["id", "text", "title"],
    },
  ],
});
const vectorResults = multiQueryResult.results[0]?.rows ?? [];
const ftsResults = multiQueryResult.results[1]?.rows ?? [];

// Fuse results with Reciprocal Rank Fusion (RRF)
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
      result.rrfScore = score;
      return result;
    });
}
const rrfResults = reciprocalRankFusion([vectorResults, ftsResults]);

// Log top 5 results
rrfResults.slice(0, 5).forEach((result, i) => {
  const score = result.rrfScore.toFixed(4);
  console.log(`[${i + 1}] RRF Score: ${score}\n📄 ${result.title}\n🔍 ${result.id}\n`);
});

/* RRF Results:
[1] RRF Score: 0.0307
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
🔍 f8960925-d30e-411b-ab27-86fdf9c182d6

[2] RRF Score: 0.0164
📄 VietMix: A Naturally Occurring Vietnamese-English Code-Mixed Corpus with Iterative Augmentation for Machine Translation
🔍 54cf1c73-7909-43ec-b4e1-c70c18c001d9

[3] RRF Score: 0.0161
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
🔍 e05117e3-daba-4400-a8cd-75dac9e6cf4a

[4] RRF Score: 0.0161
📄 Bench4KE: Benchmarking Automated Competency Question Generation
🔍 3ac70531-6dea-46ed-a507-0d83e206985e

[5] RRF Score: 0.0159
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
🔍 8f2b0dd3-dac1-4905-939c-b80f8c7f37ae
*/
```

These results are okay. They are about benchmarking LLMs, but the results focus on language and legal documents, not code. We can improve on this without reaching for robust reranking models (yet) by simply pulling more results.

```typescript
// Execute both searches with top_k at 25 (up from 10)
const ns = tpuf.namespace("chunk-token");
const multiQueryResult = await ns.multiQuery({
  queries: [
    {
      rank_by: ["vector", "ANN", queryEmbedding.data[0].embedding],
      top_k: 25,
      include_attributes: ["id", "text", "title"],
    },
    {
      rank_by: ["text", "BM25", query],
      top_k: 25,
      include_attributes: ["id", "text", "title"],
    },
  ],
});
// ... fuse results with RRF and log like before

/* RRF Results:
[1] RRF Score: 0.0307
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
🔍 f8960925-d30e-411b-ab27-86fdf9c182d6

[2] RRF Score: 0.0284
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 3513ea1d-28f9-42fd-89f8-9a862d1ccfd2

[3] RRF Score: 0.0276
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 06997b72-b270-4de6-98b4-19a501283a21

[4] RRF Score: 0.0243
📄 Bench4KE: Benchmarking Automated Competency Question Generation
🔍 71cf486c-d875-49a4-a6c4-c3805c9e450a

[5] RRF Score: 0.0164
📄 VietMix: A Naturally Occurring Vietnamese-English Code-Mixed Corpus with Iterative Augmentation for Machine Translation
🔍 54cf1c73-7909-43ec-b4e1-c70c18c001d9
*/
```

With this approach, results 2 and 3 seem like more direct hits for our query. By including more results in the vector and full text searches, we are now hitting documents that were in both result sets, but farther down the list. Before we look at reranking, let's try another algorithm to fuse results.

```typescript
// ... hybrid search with top_k 25 like before
// Fuse results with Distribution-Based Score Fusion (DBSF)
function distributionBasedScoreFusion(resultLists: any[]): any[] {
  const scores: { [key: string]: number } = {};
  const allResults: { [key: string]: any } = {};

  // Process each query result list
  for (const results of resultLists) {
    if (!results || results.length === 0) continue;

    // Calculate mean (μ) and standard deviation (σ) for result set
    const queryScores = results.map((result: any) => result.$dist);
    const mean = queryScores.reduce((sum: number, score: number) => sum + score, 0) / queryScores.length;
    const variance = queryScores.reduce((sum: number, score: number) => sum + Math.pow(score - mean, 2), 0) / queryScores.length;
    const stdDev = Math.sqrt(variance);

    // Compute limits: L = μ - 3σ, U = μ + 3σ
    const lowerLimit = mean - 3 * stdDev;
    const upperLimit = mean + 3 * stdDev;
    const denominator = upperLimit - lowerLimit;

    // Normalize scores for this query
    for (let i = 0; i < results.length; i++) {
      const id = results[i].id;
      const score = results[i].$dist;
      let normalizedScore: number;
      if (denominator === 0) {
        normalizedScore = 0.5;
      } else if (score < lowerLimit) {
        normalizedScore = 0;
      } else if (score > upperLimit) {
        normalizedScore = 1;
      } else {
        normalizedScore = (score - lowerLimit) / denominator;
      }

      // Sum normalized scores across queries
      scores[id] = (scores[id] || 0) + normalizedScore;
      allResults[id] = results[i];
    }
  }

  // Sort by combined normalized scores
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([docId, score]) => {
      const result = allResults[docId];
      result.dbsfScore = score;
      return result;
    });
}
const dbsfResults = distributionBasedScoreFusion([vectorResults, ftsResults]);

/* DBSF Results:
[1] DBSF Score: 1.0711
📄 Bench4KE: Benchmarking Automated Competency Question Generation
🔍 71cf486c-d875-49a4-a6c4-c3805c9e450a

[2] DBSF Score: 1.0000
📄 VietMix: A Naturally Occurring Vietnamese-English Code-Mixed Corpus with Iterative Augmentation for Machine Translation
🔍 54cf1c73-7909-43ec-b4e1-c70c18c001d9

[3] DBSF Score: 0.7794
📄 Bench4KE: Benchmarking Automated Competency Question Generation
🔍 3ac70531-6dea-46ed-a507-0d83e206985e

[4] DBSF Score: 0.7288
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 3513ea1d-28f9-42fd-89f8-9a862d1ccfd2

[5] DBSF Score: 0.6997
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 06997b72-b270-4de6-98b4-19a501283a21
*/
```

Looking at the results we can see that RRF and DBSF performed similarly. They included the same two chunks from the SwiftEval doc in the top 5 results, though RRF ranked them higher.

Each algorithm offers distinct advantages:

- RRF excels in its simplicity and robustness, being rank-based rather than score-dependent, making it effective when score distributions are unreliable or inconsistent.
- DBSF leverages the actual score distributions through statistical normalization, potentially capturing more nuanced signal when scores are well-calibrated.

The choice between these fusion methods depends on your specific problem domain, the characteristics of your search systems, and the nature of your dataset. RRF tends to be a safer default choice for mixed or unknown score quality, while DBSF may provide better results when you have confidence in your scoring systems and need to capture subtle relevance distinctions. To learn more about these algorithms check out [Understanding The Math Behind RRF and DBSF with Examples](https://dev.to/irajjelodari/understanding-math-behind-rrf-and-dbsf-with-examples-4bec).

While RRF and DBSF alone provide a solid foundation for result fusion, external reranking services can further refine the results using sophisticated neural relevance models.

The reranking examples that follow build on our `rrfResults` set generated with `top_k` set to `25` for both queries.

```typescript
// Cohere Reranking using rerank-english-v3.0 model
import { CohereClient } from "cohere-ai";
const co = new CohereClient({ token: process.env.COHERE_API_KEY });
const reranked = await co.rerank({
  query: query,
  documents: rrfResults.map((result) => result.text);,
  topN: 5,
  model: "rerank-english-v3.0",
});

const cohereResults = reranked.results.map((r: any) => ({
  ...rrfResults[r.index],
  cohereScore: r.relevanceScore,
}));

/* Cohere Results:
[1] Cohere Score: 0.9798
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 3513ea1d-28f9-42fd-89f8-9a862d1ccfd2

[2] Cohere Score: 0.9693
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 06997b72-b270-4de6-98b4-19a501283a21

[3] Cohere Score: 0.9613
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
🔍 f8960925-d30e-411b-ab27-86fdf9c182d6

[4] Cohere Score: 0.9132
📄 AlphaOne: Reasoning Models Thinking Slow and Fast at Test Time
🔍 249d5c23-a792-43aa-a358-3305a70bafa3

[5] Cohere Score: 0.9031
📄 Bench4KE: Benchmarking Automated Competency Question Generation
🔍 71cf486c-d875-49a4-a6c4-c3805c9e450a
*/

// Voyage AI Reranking using rerank-2-lite model
import { VoyageAIClient } from "voyageai";
const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
const reranked = await client.rerank({
  query: query,
  documents: rrfResults.map((result) => result.text),
  model: "rerank-2-lite",
  topK: 5,
  returnDocuments: false,
});

const voyageResults = reranked.data.map((r: any) => ({
  ...rrfResults[r.index],
  voyageScore: r.relevanceScore,
}));

/* Voyage Results:
[1] Voyage Score: 0.6172
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 8b7e76fc-7915-4c43-87bd-a43c2743ac7b

[2] Voyage Score: 0.6133
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
🔍 f8960925-d30e-411b-ab27-86fdf9c182d6

[3] Voyage Score: 0.6133
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 b52e3979-3c55-45f5-b2de-461013a06219

[4] Voyage Score: 0.6094
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 257c4d7e-99d2-4bef-9132-0de2e849d611

[5] Voyage Score: 0.5977
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
🔍 3513ea1d-28f9-42fd-89f8-9a862d1ccfd2
*/
```

Both Cohere and Voyage performed well: Cohere placed two relevant SwiftEval chunks at the top positions, while Voyage identified 4 out of 5 results from the SwiftEval paper. The neural rerankers elevated the code evaluation content above the legal benchmarking results that RRF alone ranked higher.

Local algorithms like RRF or DBSF provide speed and simplicity with no external dependencies or costs, while neural reranking offers improved accuracy at the expense of additional complexity and API costs. For optimal results, we suggest a cascade approach like we user here: use algorithmic approaches to quickly filter candidates, then apply neural reranking to refine the most promising results.

## Evaluation Methodologies

So far we have manually inspected search results to assess quality. While this qualitative assessment provides some insights, manual evaluation faces key limitations: subjectivity in "good" results, impracticality at scale, and difficulty quantifying improvements. For robust evalution, we need automated methods that can objectively compare quality of search results as various parts of the system are changed.

Effective evaluation starts with creating a dataset of queries with known relevant documents. Some possible approaches to this include:

- **Expert annotation**: Domain experts craft queries and identify relevant document chunks with relevance scores on a fixed scale. This approach works best for high-stakes applications where accuracy is critical and resources allow for manual curation.
- **Synthetic query generation**: Use LLMs to programmatically generate queries from document chunks, creating larger evaluation datasets at scale. This approach is ideal for initial development, A/B testing, and when manual annotation is too expensive or time-consuming.

```typescript
// Example evaluation query structure
{
  query: "effective strategies for benchmarking llm generated code quality",
  relevant_chunks: [
    { chunk_id: "3513ea1d-28f9-42fd-89f8-9a862d1ccfd2", relevance_score: 3 },
    { chunk_id: "06997b72-b270-4de6-98b4-19a501283a21", relevance_score: 3 },
    { chunk_id: "f8960925-d30e-411b-ab27-86fdf9c182d6", relevance_score: 1 }
  ]
}
```

With the known expected results, there are several approaches to assess the quality of your search, including:

- **NDCG (Normalized Discounted Cumulative Gain)** is the gold standard for evaluating ranked retrieval results, measuring both relevance and ranking position while giving higher scores to relevant results that appear earlier.
- **Mean Reciprocal Rank (MRR)** measures the average reciprocal rank of the first relevant result, useful for scenarios where finding any relevant result quickly is most important.
- **Hit Rate @ K** measures the percentage of queries that have at least one relevant result in the top K, providing a simple binary success metric.

It can be helpful to test multiple metrics to get a complete picture of your search performance. To go deeper on these algorithms (and more), read [How to Evaluate Search Relevance and Ranking](https://towardsdatascience.com/metrics-that-matter-a-simple-guide-to-search-ranking-evaluation-4030084c35b4)
