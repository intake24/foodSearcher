import { pipeline } from '@xenova/transformers';
import { Client } from 'pg';

const foods = [
  'beans on toast',
  'chicken curry',
  'cheese pizza',
  'grilled salmon',
  'vegetable stir fry'
];

async function main() {
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const client = new Client({
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
  });
  await client.connect();

  for (const name of foods) {
    const output = await embedder(name);
    // Average pooling over tokens
    const embedding = output[0].map((_, i) =>
      output.reduce((sum, token) => sum + token[i], 0) / output.length
    );
    await client.query(
      'INSERT INTO foods (name, embedding) VALUES ($1, $2)',
      [name, embedding]
    );
    console.log(`Inserted: ${name}`);
  }

  await client.end();
}

main();