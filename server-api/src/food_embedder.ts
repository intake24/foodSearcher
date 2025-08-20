#!/usr/bin/env node
import { pipeline } from '@huggingface/transformers';
import { Client } from 'pg';

let foods: string[] = [];
async function main(): Promise<void> {
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { dtype: 'fp32' }
  );

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
      await client.query('UPDATE foods SET embedding = $2 WHERE name = $1;', [
        food,
        `[${embeddings[i].join(',')}]`,
      ]);
      counter++;
    }
    console.log(`Processed ${counter} / ${foods.length} embeddings...`);
  }
  console.log(`${counter} embeddings inserted into the database.`);
  await client.end();
}
main();
