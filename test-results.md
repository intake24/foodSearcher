# Test Results

## Testing Scenarios

- **Environment**: All tests run on a local LLM installed on an M4 MacBook Pro.
- **Database**: PostgreSQL with `pgvector` extension for embedding vector search.
- **Data Source**: 22,133 food names collected from DEV environments, used to generate embeddings.
- **Test Dataset**: ~9,000 pairs of `Search Term` → `Expected Food Name`.

  **Examples:**

  ```csv
  SEARCH TERM, CUSTOM EVENT:FOOD
  6 Magnesium, Magnesium (250/300 mg)
  Chips, Oven chips
  Noodles, "Instant noodles (e.g. Supernoodles, Soba, Kabuto, Itsu, Naked)"
  beer, "Lager / beer, around 4% abv (e.g. Carlsberg/Amstel)"
  ```

- **Load Testing**: 10 concurrent workers initiating 5,000 API requests total, querying for the top 50 ranked results.
- **Matching Logic**: We use a "loose matching" strategy to account for dataset inconsistencies and naming variations.
  - A match is considered successful if **any significant word (length ≥ 3)** from the _expected food name_ appears in the _search result_.
  - **Example**:
    - **Expected Food**: "idared apple" → Key tokens: `["idared", "apple"]`
    - **Search Result**: "apple pie"
    - **Verdict**: **Match** (because "apple" matches).

---

### Performance Tests

#### Concurrent Testing (using Vitest)

| Concurrent Workers | Total Requests | Time Taken | Status  |
| ------------------ | -------------- | ---------- | :------ |
| **1**              | 5000           | 42,827ms   | ✅ Pass |
| **10**             | 5000           | 34,771ms   | ✅ Pass |
| **20**             | 5000           | 34,569ms   | ✅ Pass |
| **50**             | 5000           | 34,162ms   | ✅ Pass |

#### Latency

- **Round-trip Delay**: 6.9ms – 8.5ms (in a co-hosted DB and API server environment).

#### Throughput (Sustained Load)

**Model**: `Xenova/all-MiniLM-L6-v2`

- **Configuration**: 10 concurrent threads, 5000 requests.
- **Time**: 34.72s.
- **Throughput**: ~**144 requests/sec**.

---

### Accuracy & Relevance

#### "Loose Match" Accuracy

Using the loose matching definition described above:

- **Model**: `Xenova/all-MiniLM-L6-v2`
- **Result**: **92.52%** of queries returned a matching food item within the first 50 suggestions.

#### Mean Reciprocal Rank (MRR)

The **Mean Reciprocal Rank (MRR)** is a statistical measure for evaluating any process that produces a list of possible responses to a sample of queries, ordered by probability of correctness. The reciprocal rank of a query response is the multiplicative inverse of the rank of the first correct answer:

- 1st place = 1
- 2nd place = 1/2
- 3rd place = 1/3
- ...and so on.

> [!TIP] > **Interpretation**:
>
> - **MRR > 0.8**: Very Good. The correct answer is usually in the top 1-2 results.
> - **MRR > 0.9**: Excellent. Almost always the top result.

### Comparative Results

| Model                                            | Description                                                | Dimensions | Size (MB) | Loose Match Accuracy | MRR (Cut-off @ 1, 10, 50)                  | Req/Sec (Sustained) |
| :----------------------------------------------- | :--------------------------------------------------------- | :--------- | :-------- | :------------------- | :----------------------------------------- | :------------------ |
| **gemini-embedding-001**                         | Paid Google Gemini Embedding service ($0.15/1M tokens).    | 3072       | Cloud     | 93.8%                | 0.7580 <br> 0.7958 <br> 0.7979             | ~7.2                |
| **Xenova/all-MiniLM-L6-v2**                      | Standard sentence-transformer model. Fast and lightweight. | 384        | 91        | 92.8%                | 0.7274 <br> 0.7712 <br> 0.7741             | **144**             |
| **Xenova/paraphrase-multilingual-MiniLM-L12-v2** | Multilingual model for clustering/semantic search.         | 384        | 487       | 81.56%               | 0.6178 <br> 0.6523 <br> 0.6563             | 18.31               |
| **Xenova/bge-m3**                                | Open source model from BAAI-BGE.                           | 1024       | 2280      | 93.34%               | 0.7478 <br> 0.7872 <br> 0.7901             | 12.35–19.7          |
| **onnx-community/Qwen3-Embedding-0.6B-ONNX**     | Qwen family, designed for ranking.                         | 1024       | 2410      | 83.36%               | 0.5212 <br> 0.5837 <br> 0.5888             | 11.9–15.3           |
| **onnx-community/embeddinggemma-300m-ONNX**      | Google's open embedding model (Gemma 3).                   | 768        | 1260      | 89.26%               | 0.6020 <br> 0.6662 <br> 0.6704             | 14.9–21             |
| **mixedbread-ai/mxbai-embed-large-v1**           | Highly popular sentence transformer.                       | 1024       | 1340      | **94.24%**           | **0.7684** <br> **0.8053** <br> **0.8080** | 13.5–17.4           |
| **Xenova/bge-reranker-base**                     | (Reranking model)                                          | -          | -         | _Fail_               | _Fail_                                     | -                   |
| **dssjon/Qwen3-Embedding-4B-ONNX**               | (Large model)                                              | -          | -         | _Init Fail_          | _Init Fail_                                | -                   |

---

## Remarks

### High-Dimensionality Benefits

Models with higher dimensionality (e.g., **Gemini-001** @ 3072 dim) demonstrate superior **multilingual support** without needing a separate translation layer. They can semantic match across languages effectively:

| Input Query (Food Name)   | Matched Concept in Other Languages                        |
| :------------------------ | :-------------------------------------------------------- |
| **White bread**           | _pain blanc_ (French)                                     |
| **Butter on toast**       | _Du beurre sur du pain grillé_ (French)                   |
| **Tofu**                  | 豆腐 (Traditional Chinese), <br>豆付 (Simplified Chinese) |
| **Kidney beans**          | فاصوليا حمراء (Arabic)                                    |
| **Pasta with meat sauce** | 肉醬意粉 (Cantonese: "Meat sauce spaghetti")              |

- **Semantic search functionality**: The search can accommodate nickname of foods.

| Food           | Alternative Name |
| -------------- | ---------------- |
| Tofu           | bean curd, Mufu  |
| Bacon sandwich | Bacon Butty      |
| Sandwich       | Sarnie           |
| Mini toast     | Toastie          |
| Chips n.s.     | Chippy           |
