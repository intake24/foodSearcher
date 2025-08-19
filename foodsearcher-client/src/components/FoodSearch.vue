<template>
  <div>
    <input v-model="query" @keyup.enter="search" placeholder="Type a food..." />
    <button @click="search">Search</button>
    <ul>
      <li v-for="food in results" :key="food.id">
        {{ food.name }} (distance: {{ food.distance }})
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
