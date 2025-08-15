import express from 'express';
import { pipeline } from '@xenova/transformers';
import { Client } from 'pg';

const app = express();
app.use(express.json());

let embedder;
(async () => {
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
})();

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
});
client.connect();

app.post('/search', async (req, res) => {
  const { query } = req.body;
  const output = await embedder(query);
  const embedding = output[0].map((_, i) =>
    output.reduce((sum, token) => sum + token[i], 0) / output.length
  );

  // Find top 5 similar foods
  const result = await client.query(
    `SELECT id, name, embedding <=> $1 AS distance
     FROM foods
     ORDER BY embedding <=> $1
     LIMIT 5`,
    [embedding]
  );
  res.json(result.rows);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
