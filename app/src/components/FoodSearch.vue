<template>
  <div>
    <input v-model="query" placeholder="Type a food..." />
    <div v-if="isLoading" class="loading">Searching...</div>
    <ul>
      <li v-for="food in results" :key="food.id">
        {{ food.name }} (distance: {{ food.distance.toFixed(5) }})
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
  name: string
  distance: number
}

const results = ref<Food[]>([])

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
watch(query, (newQuery) => {
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Set new timeout for debounced search
  searchTimeout = setTimeout(() => {
    search(newQuery)
  }, 300) // 300ms delay
})
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
