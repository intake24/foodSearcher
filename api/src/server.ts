import express, { Request, Response } from 'express';
import cors from 'cors';
import { pipeline } from '@huggingface/transformers';
import { Client } from 'pg';
import path from 'node:path'; // added
import 'dotenv/config';

const app = express();
app.use(
  cors({
    origin: 'http://localhost:5173',
  })
);
app.use(express.json());

// Use shared model and cache settings
const MODEL_ID = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2'; // 384-dim default
const CACHE_DIR =
  process.env.TRANSFORMERS_CACHE ??
  path.resolve(process.cwd(), '..', '.cache', 'transformers');
console.log('Using model:', MODEL_ID);
console.log('Using cache dir:', CACHE_DIR);
const EMBEDDING_COLUMN = `embedded_${MODEL_ID.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
console.log('Using embedding column:', EMBEDDING_COLUMN);

let extractor: any;
(async () => {
  extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: 'fp32',
    cache_dir: CACHE_DIR,
  });
})();

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  port: 55432,
});
client.connect();

let counter = 0;
app.post('/search', async (req: Request, res: Response) => {
  const { query } = req.body as { query: string };
  const tensor = await extractor(query);
  const tokenEmbeddings: number[][] = tensor.tolist()[0];
  const embedding = Array.from(
    { length: tokenEmbeddings[0].length },
    (_, i) =>
      tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) /
      tokenEmbeddings.length
  );
  // Find top 100 similar foods
  const result = await client.query(
    `SELECT code, name, ${EMBEDDING_COLUMN} <=> $1 AS distance
     FROM foods
     ORDER BY ${EMBEDDING_COLUMN} <=> $1
     LIMIT 100`,
    [`[${embedding.join(',')}]`]
  );
  res.json(result.rows);
  counter++;
  if (counter % 10 === 0) console.log(`Handled ${counter} requests so far.`);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
