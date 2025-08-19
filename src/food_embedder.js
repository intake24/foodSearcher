#!/usr/bin/env node
import { pipeline } from '@xenova/transformers';
import { Client } from 'pg';
import { writeFileSync } from 'fs';

const foods = [
  'beans on toast',
  'chicken curry',
  'cheese pizza',
  'grilled salmon',
  'vegetable stir fry',
  'unrelated text'
];

async function main() {
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const client = new Client({
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    port: 55432
  });
  await client.connect();

  const tensors = await embedder(foods);
  // Write the array of tensors to embeddings.json
  writeFileSync('./data/embeddings.json', JSON.stringify(tensors.tolist(), null, 2));
  const embeddings = tensors.tolist().map(tokenEmbeddings => {
    const numTokens = tokenEmbeddings.length;
    const numFeatures = tokenEmbeddings[0].length;
    return Array.from({ length: numFeatures }, (_, i) =>
      tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) / numTokens
    );
  });
  // Insert embeddings into the database
  for (let i = 0; i < foods.length; i++) {
    const name = foods[i];
    await client.query('INSERT INTO foods (name, embedding) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET embedding = EXCLUDED.embedding;',
      [name, `[${embeddings[i].join(',')}]`]);
    console.log(`name="${name}" and its embeddings inserted into the database.`);
  }

  await client.end();
}

main();