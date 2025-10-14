import express, { Request, Response } from 'express';
import cors from 'cors';
import { pipeline } from '@huggingface/transformers';
import { GoogleGenAI } from '@google/genai';
import { Client } from 'pg';
import { ensureEmbeddingColumn } from './utils/db';
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
const MODEL_ID = process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2'; // default HF model
const IS_GEMINI = MODEL_ID.toLowerCase().startsWith('gemini');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_DIR =
  process.env.TRANSFORMERS_CACHE ??
  path.resolve(process.cwd(), '..', '.cache', 'transformers');
console.log(
  'Using model:',
  MODEL_ID,
  IS_GEMINI ? '(Gemini backend)' : '(HF transformers backend)'
);
console.log('Using cache dir:', CACHE_DIR);
const EMBEDDING_COLUMN = `embedded_${MODEL_ID.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
console.log('Using embedding column:', EMBEDDING_COLUMN);

// DB client (must be available before probe)
const client = new Client({
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  port: 55432,
});
client.connect();

let extractor: any; // For HF pipeline
let genAI: GoogleGenAI | null = null; // For Gemini
let ready = false;
(async () => {
  try {
    let dim: number;
    if (IS_GEMINI) {
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required for Gemini models.');
      }
      genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      // Probe embedding dimension using Gemini embedContent
      const probeResp: any = await genAI.models.embedContent({
        model: MODEL_ID,
        contents: ['probe'],
      } as any);
      const embArray: number[] = probeResp.embeddings?.[0]?.values ?? [];
      dim = embArray.length;
      if (!Number.isFinite(dim) || dim < 1)
        throw new Error(`Gemini probe dimension invalid: ${dim}`);
      console.log(`Gemini probe detected embedding dimension: ${dim}`);
    } else {
      extractor = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'fp32',
        cache_dir: CACHE_DIR,
      });
      const probeTensor: any = await extractor(['probe']);
      const tokenEmbeddings: number[][] = probeTensor.tolist()[0];
      dim = tokenEmbeddings[0].length;
      if (!Number.isFinite(dim) || dim < 1)
        throw new Error(`HF probe dimension invalid: ${dim}`);
      console.log(`HF probe detected embedding dimension: ${dim}`);
    }
    await ensureEmbeddingColumn(client, 'foods', EMBEDDING_COLUMN, dim);
    ready = true;
    console.log('Embedding column ready. Server can accept search requests.');
  } catch (e) {
    console.error('Failed to initialize embeddings backend:', e);
  }
})();

let counter = 0;
app.post('/search', async (req: Request, res: Response) => {
  if (!ready) {
    return res
      .status(503)
      .json({ error: 'Model/loading not ready. Retry shortly.' });
  }
  const { query } = req.body as { query: string };
  let embedding: number[];
  if (IS_GEMINI) {
    try {
      const resp: any = await genAI!.models.embedContent({
        model: MODEL_ID,
        contents: [query],
      } as any);
      embedding = resp.embeddings?.[0]?.values ?? [];
      if (!embedding.length) {
        return res.status(500).json({ error: 'Empty embedding from Gemini.' });
      }
    } catch (e: any) {
      console.error('Gemini embed error:', e);
      return res
        .status(500)
        .json({ error: 'Gemini embedding failure', details: e?.message });
    }
  } else {
    const tensor = await extractor(query);
    const tokenEmbeddings: number[][] = tensor.tolist()[0];
    embedding = Array.from(
      { length: tokenEmbeddings[0].length },
      (_, i) =>
        tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) /
        tokenEmbeddings.length
    );
  }
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
