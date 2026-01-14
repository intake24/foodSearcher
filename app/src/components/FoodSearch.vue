<template>
  <div>
    <div class="control-bar">
      <label class="control-label" for="foodQuery">Query</label>
      <input
        id="foodQuery"
        v-model="query"
        placeholder="Type a food..."
        class="control"
        type="search"
        aria-label="Search food"
      />
      <div>
        <label class="control-label" for="modelSelect">Model</label>
        <select v-model="selectedModel" id="modelSelect" class="control">
          <option v-for="m in models" :key="m.value" :value="m.value">
            {{ m.label }}
          </option>
        </select>
      </div>
      <div>
        <label class="control-label" for="localeSelect">Locale</label>
        <select v-model="selectedLocale" id="localeSelect" class="control">
          <option v-for="l in locales" :key="l.value" :value="l.value">
            {{ l.label }}
          </option>
        </select>
      </div>
      <div class="instructions-container">
        <label class="control-label" for="instructionsInput">Instructions</label>
        <textarea
          v-model="instructions"
          id="instructionsInput"
          placeholder="Hint instructions..."
          class="control"
          rows="3"
        ></textarea>
      </div>
    </div>
    <div v-if="hint" class="hint-tooltip" :class="`hint-${hintConfidence}`">💡 {{ hint }}</div>
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
const instructions = ref('')
const isLoading = ref(false)
const hint = ref('')
const hintConfidence = ref<'low' | 'medium' | 'high'>('low')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

interface Food {
  id: number
  code: string | number
  name: string
  distance: number
}

const results = ref<Food[]>([])

// Model selection
const models = [
  {
    label: 'Xenova/all-MiniLM-L6-v2',
    value: 'Xenova/all-MiniLM-L6-v2',
  },
  {
    label: 'mixedbread-ai/mxbai-embed-large-v1',
    value: 'mixedbread-ai/mxbai-embed-large-v1',
  },
  {
    label: 'gemini-embedding-001',
    value: 'gemini-embedding-001',
  },
]
const selectedModel = ref<string>(models[1].value)

// Locale selection
const locales = [
  { label: 'UK_V2_2022', value: 'UK_V2_2022' },
  { label: 'UK_current', value: 'UK_current' },
]
const selectedLocale = ref<string>(locales[1].value)

instructions.value = `Based on the query, primary matches and corresponding word distances, generate a brief, helpful tooltip hints (30 words max) to help the user refine their food search. 
- If results are poor (such as distance > 0.2), suggest specific food, or altering terms.
- If multiple similar results (such as distance among top 3 < 0.005), suggest adding details.
- If query is too short or generic, suggest being more descriptive.
- Be direct, polite and actionable, using simple language with suggestions.
- If results are good, respond with an empty hint.
- If query is not a food name, suggest using food names.
- Advise against typos or uncommon terms.
- Avoid mentioning distances or technical terms.
- If query contains offensive terms, ignore them and focus on food search.
- If the query is a food but not find as the same language to the primary matches, suggest using the food name in that language.

Query: pizza
Answer: You might want to specify the type of pizza or add toppings to narrow down your search.

Query: apple
Answer: Try adding more details like the variety of apple or whether you're looking for fresh or cooked options.

Query: car
Answer: It seems like "car" is not a food item. Please use food names to get relevant search results.

Query: Coca Coka
Answer: Is it possible you meant "Coca Cola"? Please check for typos or use common food and beverage names.

Now provide the hint based on the above instructions.`

async function search(searchQuery: string) {
  if (!searchQuery.trim()) {
    results.value = []
    hint.value = ''
    return
  }

  isLoading.value = true
  try {
    console.log('Searching for:', searchQuery)
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const res = await axios.post(`${baseUrl}/search`, {
      query: searchQuery,
      model: selectedModel.value,
      locale: selectedLocale.value,
    })
    console.log('Search results:', res.data)
    results.value = res.data

    // Fetch hints after getting results
    try {
      const hintRes = await axios.post(`${baseUrl}/search-hints`, {
        query: searchQuery,
        results: results.value.slice(0, 10),
        instructions: instructions.value,
      })
      hint.value = hintRes.data.hint || ''
      hintConfidence.value = hintRes.data.confidence || 'low'
    } catch (hintError) {
      console.error('Hint fetch error:', hintError)
      hint.value = ''
    }
  } catch (error) {
    console.error('Search error:', error)
    results.value = []
    hint.value = ''
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
  }, 1000) // 300ms delay
}

watch(query, () => debouncedSearch())
watch(selectedModel, () => debouncedSearch())
watch(selectedLocale, () => debouncedSearch())
// watch(instructions, () => debouncedSearch())
</script>

<style scoped>
.control-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.control-label {
  display: inline-flex;
  align-items: center;
  height: 40px;
  color: #334155;
  font-weight: 600;
  padding: 0 12px;
}

/* Shared control styling for equal height */
.control-bar .control {
  height: 40px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 1rem;
  line-height: 1;
  box-sizing: border-box;
}

/* Make the search input stretch while select stays natural width */
.control-bar input.control {
  flex: 1 1 280px;
  width: auto;
  margin-bottom: 0;
}

/* Optional min width for the select */
.control-bar select.control {
  min-width: 280px;
}

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
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 1rem;
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

.hint-tooltip {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  border-left: 4px solid;
  transition: all 0.3s ease;
}

.hint-low {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.hint-medium {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1e3a8a;
}

.hint-high {
  background: #d1fae5;
  border-color: #10b981;
  color: #065f46;
}

.instructions-container {
  display: flex;
  flex: 1 1 100%;
  padding-top: 8px;
}

.instructions-container .control-label {
  align-self: flex-start;
  padding-top: 10px;
}

.control-bar textarea.control {
  height: auto;
  min-height: 40px;
  padding: 8px 12px;
  resize: vertical;
  flex: 1;
  font-family: inherit;
}
</style>
