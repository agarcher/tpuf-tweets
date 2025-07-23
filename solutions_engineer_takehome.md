# Solutions Engineer Take Home

Many turbopuffer customers are using hybrid search today. This requires combining semantic and lexical search. In this take-home, you will build on the [hybrid search](https://turbopuffer.com/docs/hybrid) guide to go further. The guide you will write up will be on searching over a set of PDF documents. The areas you should cover are the following.

### Chunking and Indexing

Chunk the attached PDF documents for the take-home exercise and create embeddings, using your provider of choice, for only the text. Insert the embeddings into turbopuffer. In this step, you should also create a BM25 index of the PDF documents.

Try different chunking strategies, and in the guide, cover the tradeoffs between at least two different approaches.

### Rank Fusion

Try different approaches to combining the results from the vector and BM25 searches. Explore at least two other options and discuss their trade-offs.

### Evaluation

Create a way to evaluate your search results and write up what other methods a user can take to go further.

### Final Product

This advanced hybrid search guide should be written in a Markdown document covering the areas above, with code taking the user through each step.
