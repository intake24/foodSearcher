#!/usr/bin/env node
import 'dotenv/config';
import {
  ensureEmbeddingColumn,
  connectNewClient,
  getFoodTableName,
} from './utils/db';
import { GoogleGenAI } from '@google/genai';

// Config
const MODEL_ID = process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(
    'Missing GEMINI_API_KEY in environment. Get one at https://aistudio.google.com/app/apikey and set it in api/.env'
  );
  process.exit(1);
}

// Derive a safe SQL column name based on model id
const EMBEDDING_COLUMN = `embedded_${MODEL_ID.replace(
  /[^a-zA-Z0-9_]/g,
  '_'
).toLowerCase()}`;
console.log('Using Gemini model:', MODEL_ID);
console.log('Embedding column:', EMBEDDING_COLUMN);

// Gemini client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  // Use embeddings API; supports an array of strings for higher throughput
  // Docs: https://ai.google.dev/gemini-api/docs/embeddings
  const resp = await ai.models.embedContent({
    model: MODEL_ID,
    contents: texts as any,
  } as any);

  const embeddings: number[][] =
    (resp as any).embeddings?.map((e: any) => e.values as number[]) ?? [];
  return embeddings;
}

async function main() {
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

  // Probe dim using first item
  // Why Probe First Instead of Hard-Coding
  // Gemini’s embedding dimension can change if you choose a different output_dimensionality or model variant. Probing:
  // Automatically adapts to default (3072) or customized dimension.
  // Ensures you don’t create a column with the wrong length — avoids a wasted run.
  const probe = await getEmbeddings([foods[0]]);
  const dim = probe?.[0]?.length ?? 0;
  if (!Number.isFinite(dim) || dim < 1) {
    throw new Error(`Gemini embedding dimension invalid: ${dim}`);
  }
  console.log(`Detected embedding dimension: ${dim}`);

  await ensureEmbeddingColumn(client, FOOD_TABLE, EMBEDDING_COLUMN, dim);

  const BATCH_SIZE = 100;
  let counter = 0;

  for (let i = 0; i < foods.length; i += BATCH_SIZE) {
    const batch = foods.slice(i, i + BATCH_SIZE);
    const vectors = await getEmbeddings(batch);

    for (let j = 0; j < batch.length; j++) {
      const name = batch[j];
      const vec = vectors[j];
      if (!vec || vec.length !== dim) continue;
      await client.query(
        `UPDATE ${FOOD_TABLE}
         SET ${EMBEDDING_COLUMN} = $2
         WHERE name = $1;`,
        [name, `[${vec.join(',')}]`]
      );
      counter++;
    }
    console.log(`Processed ${counter}/${foods.length} embeddings...`);
  }

  console.log(
    `Inserted/updated ${counter} embeddings into ${EMBEDDING_COLUMN}.`
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
