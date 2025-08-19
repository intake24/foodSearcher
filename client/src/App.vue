<template>
  <h1>Food Searcher</h1>
  <p>Type any food name in the search box below to find it in the database.</p>
  <FoodSearch />
</template>
<script setup lang="ts">
import FoodSearch from './components/FoodSearch.vue'
</script>

<style scoped></style>
<style scoped>
body {
  background: #f8fafc;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  margin: 0;
  padding: 0;
}

h1 {
  color: #2563eb;
  font-size: 2.5rem;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
  font-weight: 700;
  letter-spacing: -1px;
}

p {
  color: #64748b;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.FoodSearch {
  width: 100%;
  max-width: 500px;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.07);
  padding: 2rem 1.5rem;
  margin-bottom: 2rem;
}
</style>
