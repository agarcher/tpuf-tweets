# Hybrid Search

```
             ┌─{search.py,search.ts}─────────────────────────────────────────────────┐
             │                    ┌─turbopuffer queries────┐                         │
             │                    │  ┌───────────────────┐ │                         │
             │                    ├─▶│  Vector Query 1   │─┤                         │
             │ ┌ ─ ─ ─ ─ ─ ─ ─ ─  │  └───────────────────┘ │  ┌──────┐               │
┌──────────┐ │  Query Rewriting │ │  ┌───────────────────┐ │  │ Rank │   ┌ ─ ─ ─ ─ ┐ │
│User Query│─┼▶│(Language Model) ─┼─▶│  Vector Query 2   │─┼─▶│ Fuse │──▶  Re-Rank   │
└──────────┘ │  ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  └───────────────────┘ │  └──────┘   └ ─ ─ ─ ─ ┘ │
             │                    │  ┌───────────────────┐ │                         │
             │                    ├─▶│   Text Query 1    │─┤                         │
             │                    │  └───────────────────┘ │                         │
             │                    └────────────────────────┘                         │
             └───────────────────────────────────────────────────────────────────────┘
```

To improve search quality, multiple strategies can be used together. This is commonly referred to as hybrid search.

turbopuffer supports vector search and BM25 full-text search. Combining them produces semantically relevant search results (vectors), as well as results matching specific words or strings (i.e. product SKUs, email addresses, weighing exact keywords highly).

Keep search logic in `{search.py, search.ts}`. Use turbopuffer for initial retrieval to narrow millions of results to dozens for rank fusion and re-ranking.

To improve search results further, we suggest:

- Using a re-ranker (such as [Cohere](https://cohere.com/rerank), [MixedBread](https://www.mixedbread.ai/docs/reranking/overview), or [Voyage](https://docs.voyageai.com/docs/reranker))
- Building a test suite of queries and ideal results, and evaluate NDCG ([blog post](https://softwaredoug.com/blog/2021/02/21/what-is-a-judgment-list))
- Building a query rewriting layer ([LlamaIndex resource](https://docs.llamaindex.ai/en/stable/examples/query_transformations/query_transform_cookbook/))
- Trying various chunking strategies ([LangChain resource](https://js.langchain.com/docs/concepts/text_splitters/))
- Trying [contextual retrieval](https://www.anthropic.com/news/contextual-retrieval), or otherwise rewriting the chunks to be embedded
- Adding additional multi-modal data to query, e.g. embeddings of the images ([Cohere image model](https://docs.cohere.com/v2/docs/embeddings#image-embeddings), [Voyage image model](https://docs.voyageai.com/docs/multimodal-embeddings))

```
// $ npm install @turbopuffer/turbopuffer
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { Row } from "@turbopuffer/turbopuffer/resources";

const tpuf = new Turbopuffer({
  // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`hybrid-example-ts`);

// Upsert documents with both FTS and vector search capabilities
await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: await openaiOrRandVector("Muesli: A mix of raw oats, nuts and dried fruit served with cold milk"),
      content: "Muesli: A mix of raw oats, nuts and dried fruit served with cold milk",
    },
    {
      id: 2,
      vector: await openaiOrRandVector("Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"),
      content: "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare",
    },
    {
      id: 3,
      vector: await openaiOrRandVector("Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"),
      content: "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast",
    },
    {
      id: 4,
      vector: await openaiOrRandVector("Hot oatmeal is a quick and healthy breakfast"),
      content: "Hot oatmeal is a quick and healthy breakfast",
    },
    {
      id: 5,
      vector: await openaiOrRandVector("Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"),
      content: "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!",
    },
  ],
  distance_metric: "cosine_distance",
  schema: { content: { type: "string", full_text_search: true } },
});

const query = "quick breakfast like oatmeal but cold";
console.log("Ideal:", [1, 2, 3, 4, 5]);

// ===============================================
// Multi-query: Vector Search + FTS
// combine both vector search and FTS in a single API call
// https://turbopuffer.com/docs/query#multi-queries
const result = await ns.multiQuery({
  queries: [
    {
      rank_by: ["vector", "ANN", await openaiOrRandVector(query)],
      top_k: 10,
      include_attributes: ["content"],
    },
    {
      rank_by: ["content", "BM25", query],
      top_k: 10,
      include_attributes: ["content"],
    },
  ],
});

// FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
// Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
// Ideal:  [1, 2, 3, 4, 5]
const vectorResult = result.results[0].rows!;
const ftsResult = result.results[1].rows!;
console.log(
  "Vector:",
  vectorResult.map((item) => item.id),
);
console.log(
  "FTS:",
  ftsResult.map((item) => item.id),
);

// ===============================================
// Rank Fusion
// ===============================================
// There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms
// That's why it's not built into turbopuffer (yet), as you may otherwise not be
// able to express the fusing you need.
function reciprocalRankFusion(resultLists: any[], k: number = 60): any[] {
  const scores: { [key: string]: number } = {};
  const allResults: { [key: string]: any } = {};
  for (const results of resultLists) {
    for (let rank = 1; rank <= results.length; rank++) {
      const item = results[rank - 1];
      scores[item.id] = (scores[item.id] || 0) + 1.0 / (k + rank);
      allResults[item.id] = item;
    }
  }
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([docId, score]) => {
      allResults[docId].dist = score;
      return allResults[docId];
    });
}

// Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
// To fix that, we need a re-ranker to bring some more FLOPS to the table.
// Ideal: [1, 2, 3, 4, 5]
// Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
const fusedResults = reciprocalRankFusion([vectorResult, ftsResult]);
console.log(
  "Fused:",
  fusedResults.map((item) => item.id),
);

// ===============================================
// Reranking
// ===============================================
// See alternative re-rankers turbopuffer.com/docs/hybrid
async function cohereRerankOrUnranked(
  rows: Row[],
  query: string,
  k?: number,
): Promise<any[]> {
  if (!process.env.COHERE_API_KEY) {
    console.warn(
      "Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results",
    );
    return rows;
  }
  try {
    const { CohereClient } = await import("cohere-ai");
    const co = new CohereClient({ token: process.env.COHERE_API_KEY });
    const docs = rows.map((r) =>
      Object.fromEntries(
        Object.entries(r.attributes!).map(([k, v]) => [k, String(v)]),
      ),
    );

    const reranked = await co.rerank({
      query: query,
      documents: docs,
      topN: k || docs.length,
    });

    return reranked.results.map((r) => ({
      id: rows[r.index].id,
      score: r.relevanceScore,
    }));
  } catch (e) {
    console.warn(
      "Warning: cohere package not installed (`npm install cohere-ai`), returning unranked results",
    );
    return rows;
  }
}

// Weighs the slow overnight oats higher than the chia pudding, but not bad!
// Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
// Ideal: [1, 2, 3, 4, 5]
const cohereResults = await cohereRerankOrUnranked(fusedResults, query);
console.log(
  "Reranked:",
  cohereResults.map((item) => item.id),
);

// Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
// Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
async function openaiOrRandVector(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set, using random vectors");
    return [Math.random(), Math.random()];
  }
  try {
    const { OpenAI } = await import("openai");
    return (
      await new OpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      })
    ).data[0].embedding;
  } catch {
    console.log(
      "OpenAI package not installed, using random vectors (`npm install openai`)",
    );
    return [Math.random(), Math.random()];
  }
}
```
