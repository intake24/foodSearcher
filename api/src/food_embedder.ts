#!/usr/bin/env node
import { pipeline } from '@huggingface/transformers';
import {
  ensureEmbeddingColumn,
  connectNewClient,
  getFoodTableName,
} from './utils/db';
import path from 'node:path';
import 'dotenv/config';

// Use shared model and cache settings
const MODEL_ID = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2'; // 384-dim default
const CACHE_DIR =
  process.env.TRANSFORMERS_CACHE ??
  path.resolve(process.cwd(), '.cache', 'transformers');
console.log('Using model:', MODEL_ID);
console.log('Using cache dir:', CACHE_DIR);
// Derive a safe SQL column name based on model id, e.g., embedded_onnx_community_embeddinggemma_300m_onnx
const EMBEDDING_COLUMN = `embedded_${MODEL_ID.replace(
  /[^a-zA-Z0-9_]/g,
  '_'
).toLowerCase()}`;
console.log('Using embedding column:', EMBEDDING_COLUMN);

let foods: string[] = [];
async function main(): Promise<void> {
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: 'fp32',
    cache_dir: CACHE_DIR,
  });

  const client = await connectNewClient();
  const FOOD_TABLE = getFoodTableName();

  // Load foods from all locales
  const res = await client.query(
    `SELECT name FROM ${FOOD_TABLE} WHERE ${EMBEDDING_COLUMN} IS NULL`
  );
  const foods: string[] = res.rows
    .map((r) => String(r.name ?? '').trim())
    .filter((n) => n.length > 0);
  if (foods.length === 0) {
    console.log('No foods found.');
    await client.end();
    return;
  }

  if (foods.length === 0) {
    console.log('No foods found. Exiting.');
    await client.end();
    return;
  }

  // Probe dimension using first item to ensure column exists & matches
  const probeOut: any = await extractor([foods[0]]);
  const probeTokens: number[][] = probeOut.tolist()[0];
  const dim = probeTokens[0].length; // features per token
  if (!Number.isFinite(dim) || dim < 1) {
    throw new Error(`Embedding dimension invalid: ${dim}`);
  }
  console.log(`Detected embedding dimension: ${dim}`);
  await ensureEmbeddingColumn(client, FOOD_TABLE, EMBEDDING_COLUMN, dim);

  const BATCH_SIZE = 128;
  let counter = 0;
  // Collect embeddings for export in batches to avoid memory issues
  for (let start = 0; start < foods.length; start += BATCH_SIZE) {
    const batch = foods.slice(start, start + BATCH_SIZE);
    const output: any = await extractor(batch);
    const embeddings: number[][] = output
      .tolist()
      .map((tokenEmbeddings: number[][]) => {
        const numTokens = tokenEmbeddings.length;
        const numFeatures = tokenEmbeddings[0].length;
        // Average pooling: Average over tokens for each feature
        return Array.from(
          { length: numFeatures },
          (_, i) =>
            tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) /
            numTokens
        );
      });
    for (const [i, food] of batch.entries()) {
      await client.query(
        `UPDATE ${FOOD_TABLE}
         SET ${EMBEDDING_COLUMN} = $2
         WHERE name = $1;`,
        [food, `[${embeddings[i].join(',')}]`]
      );
      counter++;
    }
    console.log(`Processed ${counter} / ${foods.length} embeddings...`);
  }
  console.log(`${counter} embeddings inserted into the database.`);
  await client.end();
}
main();
