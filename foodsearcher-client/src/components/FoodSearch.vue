<template>
  <div>
    <input v-model="query" @keyup.enter="search" placeholder="Type a food..." />
    <button @click="search">Search</button>
    <ul>
      <li v-for="food in results" :key="food.id">
        {{ food.name }} (distance: {{ food.distance.toFixed(3) }})
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

const query = ref('')
const results = ref([])

async function search() {
  const res = await axios.post('http://localhost:3000/search', {
    query: query.value,
  })
  results.value = res.data
}
</script>
