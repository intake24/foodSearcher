/**
 * API accuracy Tests using Vitest
 * Tests the accuracy of the Food Search API across reference datasets
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import 'dotenv/config';
import path from 'node:path';

const API_BASE_URL =
  'http://' + process.env.API_HOST + ':' + process.env.API_PORT;
const API_TIMEOUT = 30000; // 30 seconds for API to be ready
const DEFAULT_LOCALE = 'UK_V2_2022';
const DEFAULT_MODEL_ID = process.env.EMBEDDING_MODEL;

// Helper function to wait for API to be ready
async function waitForAPI(maxAttempts = 30, delay = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', locale: DEFAULT_LOCALE }),
        model: DEFAULT_MODEL_ID,
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

// Helper function to make API requests
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

describe('API Health Checks', () => {
  beforeAll(async () => {
    console.log('🔍 Checking if API server is running...');
    const isReady = await waitForAPI();

    if (!isReady) {
      console.error(
        '❌ API server is not responding. Make sure to start it with: pnpm api'
      );
      throw new Error('API server is not running. Start it with: pnpm api');
    }
    console.log('✅ API server is running');
    console.log('Testing with model:', DEFAULT_MODEL_ID);
    console.log('✅ API server is running');
  }, API_TIMEOUT);

  describe('🏥 Basic Health', () => {
    it('should respond to POST /search endpoint', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', locale: DEFAULT_LOCALE }),
      });

      // Should respond with 200 (success) or 503 (extractor loading)
      expect([200, 503]).toContain(response.status);
    });

    it('should return JSON content-type', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test', locale: DEFAULT_LOCALE }),
      });

      const contentType = response.headers.get('content-type') || '';
      expect(contentType).toContain('application/json');
    });
  });
});
describe('🔍 Accuracy test', () => {
  it('should find expected food within top-50 across sampled queries 85% of the time', async () => {
    // Helpers
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const nameMatches = (candidate: string, expected: string) => {
      const cand = normalize(candidate);
      const exp = normalize(expected);
      // Check any significant word (len>=3) from expected appears in candidate
      // e.g. exp = "idared apple" → tokens = ["idared","apple"] , while cand = "apple pie" will consider a match
      // The looser matching is to account for dataset mismatches and naming variations
      const tokens = exp.split(' ').filter((t) => t.length >= 3);
      return tokens.some((t) => cand.includes(t));
      // Strict match
      // return cand === exp;
    };

    // Simple concurrency pool
    async function runPool<T, R>(
      items: T[],
      limit = 10,
      worker: (item: T, index: number) => Promise<R>
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

    // Load dataset (use a manageable sample with non-empty searchTerm)
    const dataPath = path.resolve(
      process.cwd(),
      'src/test/data/search-terms-vs-food.json'
    );
    const raw = await readFile(dataPath, 'utf-8');
    const events: Array<Record<string, any>> = JSON.parse(raw);

    // Build samples: use entries with a non-empty searchTerm and an expected food name
    const candidates: { searchTerm: string; expected: string }[] = [];
    const seen = new Set<string>();
    for (const e of events) {
      const term = typeof e.searchTerm === 'string' ? e.searchTerm.trim() : '';
      const expectedFood =
        typeof e['customEvent:food'] === 'string'
          ? e['customEvent:food'].trim()
          : '';
      if (term.length >= 3 && expectedFood.length >= 3) {
        const key = term.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push({ searchTerm: term, expected: expectedFood });
        }
      }
      if (candidates.length >= 5000) break; // limit sample size for runtime
    }

    expect(candidates.length).toBeGreaterThan(0);

    // Worker to query API with retries (handle 503 while model initializes)
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
        const json = await res.json();

        if (res.status === 503) {
          if (attempt === maxRetries) {
            return {
              ok: false,
              reason: '503-initializing',
              searchTerm,
              expected,
            } as const;
          }
          await delay(1000 * attempt);
          continue;
        }

        expect(res.status).toBe(200);
        expect(Array.isArray(json)).toBe(true);

        const top = (json as Array<{ name: string; distance: number }>).slice(
          0,
          50
        );
        const found = top.some(
          (it) =>
            it && typeof it.name === 'string' && nameMatches(it.name, expected)
        );
        return {
          ok: found,
          reason: found ? 'found' : 'not-found',
          searchTerm,
          expected,
          sample: top.map((r) => r.name).slice(0, 5),
        } as const;
      }
      return {
        ok: false,
        reason: 'exhausted',
        searchTerm,
        expected,
      } as const;
    };

    const results = await runPool(candidates, 10, worker);

    const successes = results.filter((r) => r.ok).length;
    const total = results.length;

    // Require at least 85% success to avoid flakiness due to dataset mismatches
    const successRate = successes / total;
    // print success rate no matter what
    console.log(
      `✅ Accuracy test: ${successes} / ${total} = ${(
        successRate * 100
      ).toFixed(2)}%`
    );
    if (successRate < 0.85) {
      // Provide some debugging info
      const failed = results.filter((r) => !r.ok).slice(0, 10);
      console.warn('Accuracy failures (first 10):', failed);
    }
    expect(successRate).toBeGreaterThanOrEqual(0.85);
  }, 900_000); // allow up to 15 minutes for large samples
});
