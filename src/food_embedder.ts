#!/usr/bin/env node
import { pipeline } from '@xenova/transformers';
import { Client } from 'pg';
import { writeFileSync } from 'fs';

const foods: string[] = [
  'Lamb and vegetable soup',
  'Acai berry juice ',
  'Airwaves chewing gum, sugar free',
  'Anchovies, in sauce',
  'Apple cake',
];
async function main(): Promise<void> {
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  );

  const client = new Client({
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    port: 55432,
  });
  await client.connect();

  const output: any = await extractor(foods);
  // Write the output to embeddings.json
  writeFileSync(
    './data/embeddings.json',
    JSON.stringify(output.tolist(), null, 2)
  );
  // Assuming output.tolist() is [ [ [token1], [token2], ... ] ]
  const embeddings: number[][] = output
    .tolist()
    .map((tokenEmbeddings: number[][]) => {
      const numTokens = tokenEmbeddings.length;
      const numFeatures = tokenEmbeddings[0].length;
      // Average over tokens for each feature
      return Array.from(
        { length: numFeatures },
        (_, i) =>
          tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) / numTokens
      );
    });
  // Insert embeddings into the database
  for (const [i, food] of foods.entries()) {
    await client.query('UPDATE foods SET embedding = $2 WHERE name = $1;', [
      food,
      `[${embeddings[i].join(',')}]`,
    ]);
    console.log(
      `name="${food}" and its embeddings inserted into the database.`
    );
  }
  await client.end();
}
main();
