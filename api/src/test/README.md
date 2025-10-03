# 🧪 API Tests with Vitest

This directory contains comprehensive tests for the Food Search API using Vitest.

## 🚀 Quick Start

```bash
# Run all tests
pnpm test

# Run tests in watch mode (reruns on file changes)
pnpm test:watch

# Run tests once and exit
pnpm test:run

# Run tests with UI (if @vitest/ui is installed)
pnpm test:ui
```

## 📋 Test Files

### `health.test.ts` - API Health Checks
- **Basic Health**: Server connectivity, CORS, JSON responses
- **Search Functionality**: Valid queries, edge cases, response format
- **Error Handling**: 404s, malformed JSON, missing data
- **Performance**: Response times, concurrent requests
- **Data Validation**: Result structure and sorting

### `utils.test.ts` - Unit Tests
- Array operations and calculations
- String handling including Unicode
- JSON parsing and stringification
- Environment checks

## 🔧 Prerequisites

**Before running tests, ensure:**

1. **API Server is Running**
   ```bash
   # In a separate terminal
   pnpm api
   ```

2. **Database is Available**
   - PostgreSQL running on port 55432
   - `foods` table populated with embeddings

3. **Dependencies Installed**
   ```bash
   pnpm install
   ```

## 📊 Test Results

### ✅ Expected Behavior
- **Server Starting**: Tests wait up to 30 seconds for API to be ready
- **Extractor Loading**: Handles 503 responses while ML model loads
- **Data Validation**: Verifies response structure and sorting
- **Error Handling**: Tests various failure scenarios

### 🔍 Test Categories

| Category | Description | Tests |
|----------|-------------|--------|
| 🏥 Basic Health | Server connectivity, CORS | 3 tests |
| 🔍 Search | Query handling, edge cases | 4 tests |
| 🚨 Error Handling | Invalid requests, 404s | 3 tests |
| ⚡ Performance | Response time, concurrency | 2 tests |
| 🛡️ Data Validation | Result format, sorting | 1 test |
| 🧮 Unit Tests | Utility functions | 8 tests |

## 🐛 Troubleshooting

### Common Issues

**Tests failing with connection errors?**
```bash
# Make sure API server is running
pnpm api

# Check if server is accessible
curl http://localhost:3000/search -X POST -H "Content-Type: application/json" -d '{"query":"test"}'
```

**Tests timing out?**
- The API server might be loading the ML model
- Wait for "Feature extractor ready!" message in server logs
- Tests handle 503 responses during initialization

**Database connection errors?**
```bash
# Check if PostgreSQL is running
psql -h localhost -p 55432 -U postgres -d postgres -c "SELECT COUNT(*) FROM foods;"
```

## ⚙️ Configuration

### `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: 'node',    // Node.js environment
    globals: true,          // Global test functions
    testTimeout: 10000,     // 10 second timeout
    setupFiles: ['./src/test/setup.ts']
  },
})
```

### Test Timeout
- Default: 10 seconds per test
- API readiness check: 30 seconds
- Adjust in `vitest.config.ts` if needed

## 📝 Adding New Tests

### Health Check Tests
```typescript
it('should test new functionality', async () => {
  const response = await makeRequest('/new-endpoint', {
    method: 'POST',
    body: JSON.stringify({ data: 'test' })
  })
  
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data).toHaveProperty('expectedField')
})
```

### Unit Tests
```typescript
it('should test utility function', () => {
  const result = myUtilityFunction('input')
  expect(result).toBe('expected output')
})
```

## 🎯 Test Coverage

Run with coverage reporting:
```bash
# Add to package.json scripts:
"test:coverage": "vitest run --coverage"
```

## 🤖 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run API Tests
  run: |
    pnpm api &
    sleep 10  # Wait for server to start
    pnpm test:run
```

### Local Testing Script
```bash
#!/bin/bash
# test-api.sh
echo "Starting API server..."
pnpm api &
API_PID=$!

echo "Waiting for server to be ready..."
sleep 10

echo "Running tests..."
pnpm test:run

echo "Stopping API server..."
kill $API_PID
```