# Internal User Feedback Report: LLM Search Integration

## Executive Summary

Feedback from advanced users indicates that while LLM integration improves upon legacy search, the performance gap between paid (Gemini) and local (Mixbread, Xenova) models is negligible. User input patterns remain a significant challenge for retrieval accuracy.

## Current Implementation Status

- **Architecture**: Basic "out-of-the-box" LLM integration.
- **No fine-tuning**: Does not yet utilize metadata such as food choice frequency or domain-specific acronyms.

## Key Observations

### 1. Model Performance

- **Paid vs. Local**: Surprisingly, **Google Gemini** shows no significant advantage over open-source local models (**Mixbread**, **Xenova**).
- **Local Comparison**: **Mixbread** appears to slightly outperform Xenova.
- **VS Legacy Search**: LLMs successfully identify food entries that the current search misses (though regression testing is pending).

### 2. User Input Patterns

Users often provide unstructured data that challenges standard retrieval:

- **Vague**: Single-word generic inputs.
- **Ambiguous**: Multiple food items concatenated in one query.
- **Noisy**: Inclusion of non-searchable details (e.g., portion sizes, preparation methods).
- _Insight_: Many queries currently require human-level intuition to decipher.

## Action Plan

### 🚀 Process Improvements

- **Brainstorming Session**: Develop UI strategies to guide users toward providing cleaner, keyword-focused inputs.

### 🛠 Technical Improvements

- **Metadata Integration**: Investigate weighing search results by food frequency data to promote more likely matches.
  // filepath: /Users/anguschiu/dev/foodSearcher/comments from advanced users.md

# User Feedback Report: LLM Search Integration

## Executive Summary

Feedback from advanced users indicates that while LLM integration improves upon legacy search, the performance gap between paid (Gemini) and local (Mixbread, Xenova) models is negligible. User input patterns remain a significant challenge for retrieval accuracy.

## Current Implementation Status

- **Architecture**: Basic "out-of-the-box" LLM integration.
- **Limitations**: No fine-tuning; does not yet utilize metadata such as food choice frequency or domain-specific acronyms.

## Key Observations

### 1. Model Performance

- **Paid vs. Local**: Surprisingly, **Google Gemini** shows no significant advantage over open-source local models (**Mixbread**, **Xenova**).
- **Local Comparison**: **Mixbread** appears to slightly outperform Xenova.
- **Vs. Legacy Search**: LLMs successfully identify food entries that the current search misses (though regression testing is pending).

### 2. User Input Patterns

Users often provide unstructured data that challenges standard retrieval:

- **Vague**: Single-word generic inputs.
- **Ambiguous**: Multiple food items concatenated in one query.
- **Noisy**: Inclusion of non-searchable details (e.g., portion sizes, preparation methods).
- _Insight_: Many queries currently require human-level intuition to decipher.

## Action Plan

### 🚀 Process Improvements

- **Brainstorming Session**: Develop UI strategies to guide users toward providing cleaner, keyword-focused inputs.

### 🛠 Technical Improvements

- **Metadata Integration**: Investigate weighing search results by food frequency data to promote more likely matches.
