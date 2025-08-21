CREATE EXTENSION IF NOT EXISTS vector; // Enable pgvector

CREATE TABLE public.foods (
code character varying(8),
name character varying(128),
food_group_id bigint NOT NULL,
version uuid NOT NULL,
embedding public.vector(384)
);

ALTER TABLE foods ADD CONSTRAINT unique_code UNIQUE (code);


-- Or, after imported `foods` table from `public.foods` in `Intake24`, add vectors to it by

-- ALTER TABLE foods ADD COLUMN embedding vector(384); -- 384 for MiniLM, adjust for your model


