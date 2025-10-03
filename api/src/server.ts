import express, { Request, Response } from 'express';
import cors from 'cors';
import { pipeline } from '@huggingface/transformers';
import { Client } from 'pg';

const app = express();
app.use(
  cors({
    origin: 'http://localhost:5173',
  })
);
app.use(express.json());

let extractor: any;
(async () => {
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
  });
})();

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  port: 55432,
});
client.connect();

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
    `SELECT code, name, embedding <=> $1 AS distance
     FROM foods
     ORDER BY embedding <=> $1
     LIMIT 100`,
    [`[${embedding.join(',')}]`]
  );
  res.json(result.rows);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
