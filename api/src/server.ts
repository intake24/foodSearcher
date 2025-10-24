import express, { Request, Response } from 'express';
import cors from 'cors';
import { pipeline } from '@huggingface/transformers';
import { GoogleGenAI } from '@google/genai';
import { getClient, getFoodTableName } from './utils/db';
import path from 'node:path'; // added
import 'dotenv/config';

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : false,
  })
);
app.use(express.json());

// Default model and cache settings
const DEFAULT_MODEL_ID =
  process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_DIR =
  process.env.TRANSFORMERS_CACHE ??
  path.resolve(process.cwd(), '.cache', 'transformers');
console.log('Default model:', DEFAULT_MODEL_ID);
console.log('Using cache dir:', CACHE_DIR);
function toEmbeddingColumn(modelId: string) {
  return `embedded_${modelId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
}
console.log('Default embedding column:', toEmbeddingColumn(DEFAULT_MODEL_ID));

// Shared DB client
const clientPromise = getClient();
const FOOD_TABLE = getFoodTableName();

// Caches and backend selector
const HFExtractors = new Map<string, any>(); // modelId -> extractor
const modelDims = new Map<string, number>(); // modelId -> dim
let genAI: GoogleGenAI | null = null;

async function ensureModelReadyFor(
  modelId: string
): Promise<{ backend: 'gemini' | 'hf'; dim: number; column: string }> {
  const isGemini = modelId.toLowerCase().startsWith('gemini');
  let dim = modelDims.get(modelId);
  const column = toEmbeddingColumn(modelId);
  const client = await clientPromise;

  if (isGemini) {
    if (!genAI) {
      if (!GEMINI_API_KEY)
        throw new Error('GEMINI_API_KEY is required for Gemini models.');
      genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
    if (!dim) {
      const probeResp: any = await genAI.models.embedContent({
        model: modelId,
        contents: ['probe'],
      } as any);
      const values: number[] = probeResp.embeddings?.[0]?.values ?? [];
      dim = values.length;
      if (!Number.isFinite(dim) || dim < 1)
        throw new Error(`Gemini probe dimension invalid: ${dim}`);
      modelDims.set(modelId, dim);
      console.log(`[Gemini] ${modelId} dimension: ${dim}`);
    }
    // await ensureEmbeddingColumn(client, FOOD_TABLE, column, dim);
    return { backend: 'gemini', dim, column };
  } else {
    let extractor = HFExtractors.get(modelId);
    if (!extractor) {
      extractor = await pipeline('feature-extraction', modelId, {
        dtype: 'fp32',
        cache_dir: CACHE_DIR,
      });
      HFExtractors.set(modelId, extractor);
    }
    if (!dim) {
      const probeTensor: any = await extractor(['probe']);
      const tokenEmbeddings: number[][] = probeTensor.tolist()[0];
      dim = tokenEmbeddings[0].length;
      if (!Number.isFinite(dim) || dim < 1)
        throw new Error(`HF probe dimension invalid: ${dim}`);
      modelDims.set(modelId, dim);
      console.log(`[HF] ${modelId} dimension: ${dim}`);
    }
    // await ensureEmbeddingColumn(client, FOOD_TABLE, column, dim);
    return { backend: 'hf', dim, column };
  }
}

let counter = 0;
app.post('/search', async (req: Request, res: Response) => {
  const { query, model, locale } = req.body as {
    query?: string;
    model?: string;
    locale?: string;
  };
  if (!query || !query.trim()) return res.status(400).json([]);
  const modelId = (model ?? DEFAULT_MODEL_ID).trim();
  try {
    const { backend, column } = await ensureModelReadyFor(modelId);
    let embedding: number[];
    if (backend === 'gemini') {
      const resp: any = await genAI!.models.embedContent({
        model: modelId,
        contents: [query],
      } as any);
      embedding = resp.embeddings?.[0]?.values ?? [];
      if (!embedding.length)
        return res.status(500).json({ error: 'Empty embedding from Gemini.' });
    } else {
      const extractor = HFExtractors.get(modelId)!;
      const tensor = await extractor(query);
      const tokenEmbeddings: number[][] = tensor.tolist()[0];
      embedding = Array.from(
        { length: tokenEmbeddings[0].length },
        (_, i) =>
          tokenEmbeddings.reduce((sum, token) => sum + token[i], 0) /
          tokenEmbeddings.length
      );
    }
    const client = await clientPromise;
    const effectiveLocale = (locale && String(locale).trim()) || null;
    const result = await client.query(
      `SELECT id, code, name, ${column} <=> $1 AS distance
       FROM ${FOOD_TABLE}
       WHERE ($2::text IS NULL OR "locale_id" = $2)
         AND ${column} IS NOT NULL
       ORDER BY ${column} <=> $1
       LIMIT 100`,
      [`[${embedding.join(',')}]`, effectiveLocale]
    );
    res.json(result.rows);
    counter++;
    if (counter % 10 === 0) console.log(`Handled ${counter} requests so far.`);
  } catch (e: any) {
    console.error('Search error:', e);
    const message = e?.message ?? 'Unknown error';
    if (/GEMINI_API_KEY/.test(message))
      return res.status(400).json({ error: message });
    return res.status(500).json({ error: message });
  }
});

app.listen(process.env.API_PORT, () =>
  console.log(
    `Server running on ${process.env.API_HOST}:${process.env.API_PORT}`
  )
);
