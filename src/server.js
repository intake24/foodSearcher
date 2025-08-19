import express from 'express';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';
import { Client } from 'pg';

const app = express();
app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());

let extractor;
(async () => {
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
})();

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  port: 55432
});
client.connect();

app.post('/search', async (req, res) => {
  const { query } = req.body;
  const tensor = await extractor(query);
  const tokenEmbeddings = tensor.tolist()[0];
  const embedding = Array.from(
    { length: tokenEmbeddings[0].length },
    (_, i) =>
      tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) /
      tokenEmbeddings.length
  );
  // Find top 5 similar foods
  const result = await client.query(
    `SELECT code, name, embedding <=> $1 AS distance
     FROM foods
     ORDER BY embedding <=> $1
     LIMIT 5`,
    [`[${embedding.join(',')}]`]
  );
  res.json(result.rows);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
