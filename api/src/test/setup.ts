// Test setup file for Vitest
import { beforeAll, afterAll } from 'vitest'

// Global test setup
beforeAll(async () => {
  // Any global setup logic can go here
  console.log('Setting up tests...')
})

afterAll(async () => {
  // Any global cleanup logic can go here
  console.log('Cleaning up tests...')
})