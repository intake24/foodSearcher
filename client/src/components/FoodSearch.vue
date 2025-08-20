<template>
  <div>
    <input v-model="query" @keyup.enter="search" placeholder="Type a food..." />
    <button @click="search">Search</button>
    <ul>
      <li v-for="food in results" :key="food.id">
        {{ food.name }} (distance: {{ food.distance.toFixed(5) }})
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

const query = ref('')
interface Food {
  id: number
  name: string
  distance: number
}

const results = ref<Food[]>([])

async function search() {
  console.log('Searching for:', query.value)
  const res = await axios.post('http://localhost:3000/search', {
    query: query.value,
  })
  console.log('Search results:', res.data)
  results.value = res.data
}
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
</style>
