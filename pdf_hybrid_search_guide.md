# Advanced Hybrid Search for PDF Documents

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PDF Document Collection                               │
│                               arxiv_100.zip                                     │
│                       https://example.com/link/to/zip                           │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────────┐
│                        Document Processing Pipeline                             │
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ PDF Parsing │─▶│   Chunking    │─▶│ Embeddings  │─▶│   turbopuffer       │   │
│  │ (LangChain) │  │ (3 Strategies)│  │ (OpenAI)    │  │   (3 Namespaces)    │   │
│  └─────────────┘  └───────────────┘  └─────────────┘  └─────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────────┐
│                           Hybrid Search Evaluation                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │   Vector     │  │ BM25 Search  │  │ Rank Fusion  │  │   Evaluation     │     │
│  │   Search     │  │   (FTS)      │  │ (Multiple)   │  │   (NDCG, etc)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

This expands on our [Hybrid Search guide](https://turbopuffer.com/docs/hybrid) and explores techniques for improving search accuracy with large datasets of unstructured documents. We'll compare different chunking strategies and evaluate their impact on search quality using turbopuffer's vector and BM25 full-text search capabilities, then explore multiple rank fusion approaches and evaluation methodologies.

We will use [this collection](https://example.com/link/to/zip) of PDF papers on large language models from https://arxiv.org/ for the purposes of this guide.

## Document Processing Pipeline

As the source doucments are PDFs we will first need to extract their text. We'll use [LangChain](https://www.langchain.com/)'s PDF parser for this guide. We'll contrast three basic chunking strategies, generate embeddings using OpenAI's `text-embedding-3-small` model, and index everything in turbopuffer for hybrid search capabilities.

```typescript
// Load PDF documents from directory, don't split pages as we will chunk later
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
const directoryLoader = new DirectoryLoader("./data", {
  ".pdf": (path: string) => new PDFLoader(path, { splitPages: false }),
});
const docs = await directoryLoader.load();
console.log(`Loaded ${docs.length} PDF documents`);

// Chunk documents using fixed length character blocks
import { CharacterTextSplitter } from "langchain/text_splitter";
const textSplitter = new CharacterTextSplitter({
  chunkSize: 5000,
  chunkOverlap: 1000,
});
const splitDocs = await textSplitter.splitDocuments(docs);
console.log(`Split ${docs.length} documents into ${splitDocs.length} chunks`);
// Split 100 documents into 1873 chunks

// Generate embeddings using OpenAI (in reality you'll need to work in batches to avoid timeouts)
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
  author: doc.metadata.pdf.info.Author,
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
    title: { type: "string", full_text_search: true },
    author: { type: "string", full_text_search: true },
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

- `chunk-character`: Documents are chunked into fixed length based on character count with a small overlap (5000 character chunks, with 1000 character overlap).
- `chunk-structure`: Documents are chunked with an attempt to keep semantic structure (e.g. paragraphs, sentences, etc.) intact while respecting fixed length limits where possible (5000 character chunks, with 1000 character overlap).
- `chunk-token`: Documents are chunked into fixed length based on token count with a small overlap (1000 token chunks, with 200 token overlap).

Character and token based chunking strategies with fixed limits are nearly identical in performance. One advantage of token based chunking is that the results will yield a consistent token count which is useful in building queries for large language model.

Let's try some queries against the `chunk-character` and `chunk-token` namespaces and see how they perform.

```typescript
// Query token-based chunking approach
const query =
  "effective strategies for benchmarking llm generated code quality";
const queryEmbedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: [query],
});

const tokenNs = tpuf.namespace("chunk-token");
const tokenResults = await tokenNs.query({
  rank_by: ["vector", "ANN", queryEmbedding.data[0].embedding],
  top_k: 3,
  include_attributes: ["text", "title", "author"],
});

tokenResults.forEach((result, i) => {
  console.log(`[${i + 1}] Distance: ${result.$dist.toFixed(4)}`);
  console.log(`📄 ${result.attributes.title}`);
  console.log(`👤 ${result.attributes.author}\n`);
  console.log(`${result.text.substring(0, 100)}...`);
});

/* Token-based results:
[1] Distance: 0.4230
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
👤 Li yunhan; Wu gengshen
arXiv:2505.24826v1  [cs.CL]  30 May 2025
LegalEval-Q: A New Benchmark for The Quality Evaluation of
...

[2] Distance: 0.4428
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
👤 Li yunhan; Wu gengshen
 resultant textual
quality remains poorly understood. These gaps hin-
der model selection and optimi...

[3] Distance: 0.4512
📄 LegalEval-Q: A New Benchmark for The Quality Evaluation of LLM-Generated Legal Text
👤 Li yunhan; Wu gengshen
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
👤 Li yunhan; Wu gengshen
arXiv:2505.24826v1  [cs.CL]  30 May 2025
LegalEval-Q: A New Benchmark for The Quality Evaluation of
...

[2] Distance: 0.4792
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
👤 Ivan Petrukha; Yana Kurliak; Nataliia Stulova
arXiv:2505.24324v1  [cs.LG]  30 May 2025
© Ivan Petrukha, Yana Kurliak, Nataliia Stulova, accepted f...

[3] Distance: 0.4796
📄 SwiftEval: Developing a Language-Specific Benchmark for LLM-generated Code Evaluation
👤 Ivan Petrukha; Yana Kurliak; Nataliia Stulova
A.  Guha,  M.  Greenberg,  and  A.  Jangda,  “MultiPL-E:  A  Scalable  and
Extensible Approach to Be...
*/
```

In theory, the structure based approach should yield better results as it maintains semantic context. In practice, its ability to preserve semantic structure is negated by the noise introduced in PDF text extraction. This is clear from the lack of sentence structure in the first 100 characters printed from both result sets. Both chunking approaches perform similarly poorly, with a negligible difference in the top result's distance (`0.4218` vs `0.4230`), and for other queries it sometimes performed worse.

To improve the results here, we add preprocessing to eliminate noise from the PDF extraction process. Smaller chunk sizes may also help to produce focus the results more narrowly on the valuable portions of the text.

In reality, all chunking strategies shown are quite primitive strategies and to improve results you will likely want to reach for more advanced techniques like tuning chunking based on your specific document structure or using a [semantic meaning based](https://js.langchain.com/docs/concepts/text_splitters/#semantic-meaning-based) approach.
