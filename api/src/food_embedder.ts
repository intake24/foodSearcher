#!/usr/bin/env node
import { pipeline } from '@huggingface/transformers';
import { Client } from 'pg';
import path from 'node:path';
import 'dotenv/config';

// Use shared model and cache settings
const MODEL_ID = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2'; // 384-dim default
const CACHE_DIR =
  process.env.TRANSFORMERS_CACHE ??
  path.resolve(process.cwd(), '..', '.cache', 'transformers');
console.log('Using model:', MODEL_ID);
console.log('Using cache dir:', CACHE_DIR);
// Derive a safe SQL column name based on model id, e.g., embedded_onnx_community_embeddinggemma_300m_onnx
const EMBEDDING_COLUMN = `embedded_${MODEL_ID.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
console.log('Using embedding column:', EMBEDDING_COLUMN);

let foods: string[] = [];
async function main(): Promise<void> {
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: 'fp32',
    cache_dir: CACHE_DIR,
  });

  const client = new Client({
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    port: 55432,
  });
  await client.connect();

  // Fetch all food names from the database
  const res = await client.query('SELECT name FROM foods;');
  foods = res.rows.map((row) => row.name);

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
        `UPDATE foods SET ${EMBEDDING_COLUMN} = $2 WHERE name = $1;`,
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
