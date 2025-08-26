# Minimal Local Food Search Proof-of-Concept

A full-stack application for searching foods using semantic embeddings and vector similarity in PostgreSQL (with pgvector).

<p align="center">
   <img src="BERT-Intake24.png" alt="BERT Intake24 Architecture" width="500"/>
</p>

## Features

- Vue 3 frontend for searching foods
- Node.js/Express API server with semantic search endpoint
- PostgreSQL with pgvector for vector similarity search
- Embedding generation using HuggingFace Transformers
- Docker Compose for easy local development

## Project Structure

```
app/                # Vue 3 frontend
api/            # Node.js/Express API server, embedding scripts, utilities
compose.yaml           # Docker Compose setup
init/                  # Initialization scripts for database
db/                    # Database schema and sample data (via `pg_restore`)
```

## Getting Started

### Prerequisites

- Node.js (22+ recommended)
- pnpm (or npm/yarn)
- Docker & Docker Compose

### Setup

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd foodSearcher
   ```
2. **Install dependencies:**
   ```sh
   pnpm install
   ```
3. **Start the database and Adminer:**

   You may install PostgreSQL with Pgvector by

   ```bash
   # On Ubuntu
   # Note: Replace `17` with your Postgres server version
   sudo apt install postgresql-17-pgvector
   ```

   Or using Docker (recommended in this test)

   ```docker
   docker compose up -d
   # Adminer available at http://localhost:8080
   ```

   To reset the database AND remove volume it created, you can run:

   ```sh
   docker compose down -v
   ```

   After imported `foods` table from `public.foods` in `Intake24`, add vectors to it by

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector; // Enable pgvector

   ALTER TABLE foods ADD CONSTRAINT unique_code UNIQUE (code);
   ALTER TABLE foods ADD COLUMN embedding vector(384); -- 384 for MiniLM, adjust for your model
   ```

   Or, for merely testing purposes, instead of importing `foods` table from `public.foods` in `Intake24`, you can also use `pg_restore` to import a sample foods dataset

   ```sh
   pg_restore -h localhost -p 55432 -U postgres -d postgres -v db/dump-postgres.sql
   ```

4. **Run the embedding script:**

   ```sh
   pnpm db:embed
   ```

   > [!NOTE]
   > Occassionally, you will need to run this to refresh the embeddings (e.g. new foods added).

5. **Start the web app**
   You can run both API server and web server in a single line:

```sh
pnpm start
```

If you wish to start separately, you can

**_Start the API server:_**

```sh
pnpm api
```

API available at http://localhost:3000

**_Start the frontend:_**

```sh
pnpm app
```

App available at http://localhost:5173

## Usage

- Search for foods using the web UI.
- The backend will return the most similar foods using vector search.

## Development

- Edit frontend in `app`
- Edit embedding scripts and API server in `api`

## License

MIT
