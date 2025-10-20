<template>
  <div>
    <div
      style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px"
    >
      <input v-model="query" placeholder="Type a food..." />
      <select v-model="selectedModel">
        <option v-for="m in models" :key="m.value" :value="m.value">
          {{ m.label }}
        </option>
      </select>
    </div>
    <div v-if="isLoading" class="loading">Searching...</div>
    <ul>
      <li v-for="food in results" :key="food.id">
        {{ food.name }} - {{ food.id }} - {{ food.code }} - (distance:
        {{ food.distance.toFixed(5) }})
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'

const query = ref('')
const isLoading = ref(false)
let searchTimeout: number | null = null

interface Food {
  id: number
  code: string | number
  name: string
  distance: number
}

const results = ref<Food[]>([])

// Model selection
const models = [
  { label: 'HF: MiniLM-L6-v2 (384d)', value: 'Xenova/all-MiniLM-L6-v2' },
  {
    label: 'HF: mixbreadai/mxbai-embed-large-v1 (1024d)',
    value: 'mixedbread-ai/mxbai-embed-large-v1',
  },
  { label: 'Gemini: gemini-embedding-001 (3072d)', value: 'gemini-embedding-001' },
]
const selectedModel = ref<string>(models[0].value)

async function search(searchQuery: string) {
  if (!searchQuery.trim()) {
    results.value = []
    return
  }

  isLoading.value = true
  try {
    console.log('Searching for:', searchQuery)
    const res = await axios.post('http://localhost:3000/search', {
      query: searchQuery,
      model: selectedModel.value,
    })
    console.log('Search results:', res.data)
    results.value = res.data
  } catch (error) {
    console.error('Search error:', error)
    results.value = []
  } finally {
    isLoading.value = false
  }
}

// Watch for changes in query and debounce the search
function debouncedSearch() {
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Set new timeout for debounced search
  searchTimeout = setTimeout(() => {
    search(query.value)
  }, 300) // 300ms delay
}

watch(query, () => debouncedSearch())
watch(selectedModel, () => debouncedSearch())
</script>

<style scoped>
.food-search-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.07);
  padding: 2rem 1.5rem;
  max-width: 200px;
  margin: 0 auto;
}

input[type='text'],
input[type='search'],
input {
  width: 60%;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 1rem;
  margin-bottom: 1rem;
  outline: none;
  transition: border 0.2s;
}
input:focus {
  border-color: #2563eb;
}

button {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 1.5rem;
}
button:hover {
  background: #1d4ed8;
}

select {
  padding: 0.6rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #fff;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
}
li {
  background: #f1f5f9;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.05rem;
  color: #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading {
  text-align: center;
  color: #6b7280;
  font-style: italic;
  margin: 1rem 0;
}
</style>
