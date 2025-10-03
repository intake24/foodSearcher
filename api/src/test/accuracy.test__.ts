/**
 * API accuracy Tests using Vitest
 * Tests the accuracy of the Food Search API across reference datasets
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = 'http://localhost:3000';
const API_TIMEOUT = 30000; // 30 seconds for API to be ready

// Helper function to wait for API to be ready
async function waitForAPI(maxAttempts = 30, delay = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });

      // If we get any response (including 503), the server is running
      if (response.status !== 0) {
        return true;
      }
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
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  return {
    status: response.status,
    headers: response.headers,
    json: async () => {
      try {
        return await response.json();
      } catch (error) {
        return null;
      }
    },
    text: async () => await response.text(),
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
  }, API_TIMEOUT);

  describe('🏥 Basic Health', () => {
    it('should respond to POST /search endpoint', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      // Should respond with 200 (success) or 503 (extractor loading)
      expect([200, 503]).toContain(response.status);
    });

    it('should return JSON content-type', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    it('should handle CORS for allowed origin', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ query: 'test' }),
      });

      expect(response.headers.get('access-control-allow-origin')).toBe(
        'http://localhost:5173'
      );
    });
  });

  describe('🔍 Search Functionality', () => {
    it('should handle valid search query', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'apple' }),
      });

      const data = await response.json();

      if (response.status === 200) {
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeLessThanOrEqual(10);

        if (data.length > 0) {
          // Check structure of first result
          expect(data[0]).toHaveProperty('code');
          expect(data[0]).toHaveProperty('name');
          expect(data[0]).toHaveProperty('distance');
          expect(typeof data[0].distance).toBe('number');
        }
      } else if (response.status === 503) {
        // Extractor still loading
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('initializing');
      }
    });

    it('should handle empty query', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: '' }),
      });

      expect([200, 503]).toContain(response.status);
    });

    it('should handle special characters', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'café & naïve 🍎' }),
      });

      expect([200, 503]).toContain(response.status);
    });

    it('should handle long queries', async () => {
      const longQuery = 'apple banana cherry '.repeat(100);
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: longQuery }),
      });

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('🚨 Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await makeRequest('/nonexistent', {
        method: 'GET',
      });

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });

    it('should handle missing request body', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
      });

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('⚡ Performance', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'performance test' }),
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBeDefined();
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        makeRequest('/search', {
          method: 'POST',
          body: JSON.stringify({ query: `concurrent test ${i}` }),
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect([200, 503]).toContain(response.status);
      });
    });
  });

  describe('🛡️ Data Validation', () => {
    it('should return results in correct format when ready', async () => {
      const response = await makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'banana' }),
      });

      const data = await response.json();

      if (response.status === 200 && data.length > 0) {
        // Validate result structure
        data.forEach((item: any) => {
          expect(typeof item.code).toBe('string');
          expect(typeof item.name).toBe('string');
          expect(typeof item.distance).toBe('number');
          expect(item.distance).toBeGreaterThanOrEqual(0);
        });

        // Validate results are sorted by distance
        for (let i = 1; i < data.length; i++) {
          expect(data[i].distance).toBeGreaterThanOrEqual(data[i - 1].distance);
        }
      }
    });
  });
});
