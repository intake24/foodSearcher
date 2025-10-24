/**
 * Mean Reciprocal Rank (MRR) evaluation using search-terms-vs-food.json
 * - Computes MRR@1, @5, @10, @50 over a sampled set of queries
 * - Uses a tolerant name matching heuristic to account for naming variations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import 'dotenv/config';
import path from 'node:path';

const API_BASE_URL = process.env.API_HOST + ':' + process.env.API_PORT;
const API_READY_TIMEOUT = 30_000; // 30 seconds for API to be ready
const DEFAULT_LOCALE = 'UK_V2_2022';

// Helper function to wait for API to be ready
async function waitForAPI(maxAttempts = 30, delay = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', locale: DEFAULT_LOCALE }),
      });
      if (response.status !== 0) return true;
    } catch (error) {
      // Server not ready yet, wait and retry
      console.log(`Waiting for API... attempt ${i + 1}/${maxAttempts}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

// Simple request helper with JSON parsing
async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  return {
    status: res.status,
    headers: res.headers,
    json: async () => {
      try {
        return await res.json();
      } catch {
        return null;
      }
    },
  };
}

// Name matching heuristic: normalize strings and check for token overlap
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function nameMatches(candidate: string, expected: string) {
  const cand = normalize(candidate);
  const exp = normalize(expected);
  const tokens = exp.split(' ').filter((t) => t.length >= 3);
  return tokens.some((t) => cand.includes(t));
}

// Compute reciprocal rank of expected within top-k list; returns 0 if not found
function reciprocalRankAtK(
  results: Array<{ name: string }>,
  expected: string,
  k: number
): number {
  const limit = Math.min(k, results.length);
  for (let i = 0; i < limit; i++) {
    const it = results[i];
    if (it && typeof it.name === 'string' && nameMatches(it.name, expected)) {
      return 1 / (i + 1); // ranks are 1-based
    }
  }
  return 0;
}

// Simple concurrency pool
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let i = 0;
  const runners = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) break;
        results[idx] = await worker(items[idx], idx);
      }
    });
  await Promise.all(runners);
  return results;
}

describe('📈 Mean Reciprocal Rank (MRR)', () => {
  beforeAll(async () => {
    const ready = await waitForAPI();
    if (!ready) {
      throw new Error('API server is not running. Start it with: pnpm api');
    }
  }, API_READY_TIMEOUT);

  it('computes MRR@1/10/50 over sampled queries', async () => {
    // Load dataset
    const dataPath = path.resolve(
      process.cwd(),
      'src/test/data/search-terms-vs-food.json'
    );
    const raw = await readFile(dataPath, 'utf-8');
    const events: Array<Record<string, any>> = JSON.parse(raw);

    // Build unique query -> expected pairs (non-empty)
    const pairs: { searchTerm: string; expected: string }[] = [];
    const seen = new Set<string>();
    for (const e of events) {
      const term = typeof e.searchTerm === 'string' ? e.searchTerm.trim() : '';
      const expected =
        typeof e['customEvent:food'] === 'string'
          ? e['customEvent:food'].trim()
          : '';
      if (term.length >= 3 && expected.length >= 3) {
        const key = term.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ searchTerm: term, expected });
        }
      }
      if (pairs.length >= 5000) break; // cap for runtime; adjust as needed
    }

    expect(pairs.length).toBeGreaterThan(0);

    // Worker: query API with retries, return reciprocal ranks at K
    const K = [1, 10, 50] as const;
    type KType = (typeof K)[number];

    const worker = async ({
      searchTerm,
      expected,
    }: {
      searchTerm: string;
      expected: string;
    }) => {
      const maxRetries = 5;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const res = await makeRequest('/search', {
          method: 'POST',
          body: JSON.stringify({ query: searchTerm, locale: DEFAULT_LOCALE }),
        });
        const json = (await res.json()) as any;

        if (res.status === 503) {
          if (attempt === maxRetries)
            return {
              searchTerm,
              expected,
              ranks: { 1: 0, 10: 0, 50: 0 } as Record<KType, number>,
            };
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        expect(res.status).toBe(200);
        expect(Array.isArray(json)).toBe(true);
        const results = (json as Array<{ name: string }>).slice(0, 50); // only need top-50

        const ranks: Record<KType, number> = {
          1: reciprocalRankAtK(results, expected, 1) as number,
          10: reciprocalRankAtK(results, expected, 10) as number,
          50: reciprocalRankAtK(results, expected, 50) as number,
        };
        return { searchTerm, expected, ranks };
      }
      return {
        searchTerm,
        expected,
        ranks: { 1: 0, 10: 0, 50: 0 } as Record<KType, number>,
      };
    };

    const results = await runPool(pairs, 10, worker);

    // Aggregate MRR@K
    const totals: Record<KType, number> = { 1: 0, 10: 0, 50: 0 };
    for (const r of results) {
      totals[1] += r.ranks[1];
      totals[10] += r.ranks[10];
      totals[50] += r.ranks[50];
    }
    const n = results.length || 1;
    const mrr1 = totals[1] / n;
    const mrr10 = totals[10] / n;
    const mrr50 = totals[50] / n;

    // Log nicely for inspection
    console.log('\nMRR results (n=%d):', n);
    console.log('  MRR@1  = %s', mrr1.toFixed(4));
    console.log('  MRR@10 = %s', mrr10.toFixed(4));
    console.log('  MRR@50 = %s', mrr50.toFixed(4));

    // Basic sanity assertions (keep non-opinionated)
    for (const v of [mrr1, mrr10, mrr50]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  }, 600_000); // allow up to 10 minutes for large samples
});
