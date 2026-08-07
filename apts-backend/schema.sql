-- APTS local PostgreSQL schema
-- Extracted from apt_backup.sql (public tables only)
--
-- Usage:
--   1. CREATE DATABASE apts;
--   2. psql -U postgres -d apts -f schema.sql
--   3. Set DATABASE_URL in .env, e.g.:
--      DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/apts"

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    openai_api_key text,
    preferred_ai_model text DEFAULT 'gpt-4o'::text,
    deepseek_api_key text,
    theme_preference text DEFAULT 'dark'::text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_role_check CHECK (
        role = ANY (ARRAY['admin'::text, 'developer'::text, 'bidder'::text, 'manager'::text])
    )
);

CREATE TABLE resume_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    file_url text NOT NULL,
    developer_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_count integer DEFAULT 0,
    prompt text,
    demographics jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT resume_templates_pkey PRIMARY KEY (id),
    CONSTRAINT resume_templates_developer_id_fkey
        FOREIGN KEY (developer_id) REFERENCES users(id)
);

CREATE TABLE bidder_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    bidder_id uuid NOT NULL,
    template_id uuid,
    drive_folder_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    rate numeric(10, 2) DEFAULT 0,
    last_paid_at timestamp without time zone,
    CONSTRAINT bidder_configs_pkey PRIMARY KEY (id),
    CONSTRAINT unique_bidder_id UNIQUE (bidder_id),
    CONSTRAINT bidder_configs_bidder_id_fkey
        FOREIGN KEY (bidder_id) REFERENCES users(id),
    CONSTRAINT bidder_configs_developer_id_fkey
        FOREIGN KEY (developer_id) REFERENCES users(id),
    CONSTRAINT bidder_configs_template_id_fkey
        FOREIGN KEY (template_id) REFERENCES resume_templates(id)
);

CREATE TABLE jobapplications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    company_name text,
    job_description_url text,
    resume_url text,
    status text DEFAULT 'submitted'::text,
    submitted_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    job_description text,
    developer_id uuid,
    resume_template_id uuid,
    qualification text,
    CONSTRAINT jobapplications_pkey PRIMARY KEY (id),
    CONSTRAINT jobapplications_developer_id_fkey
        FOREIGN KEY (developer_id) REFERENCES users(id),
    CONSTRAINT jobapplications_submitted_by_fkey
        FOREIGN KEY (submitted_by) REFERENCES users(id)
);

CREATE TABLE interviewstages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_application_id uuid,
    stage_name text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_at timestamp without time zone,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT interviewstages_pkey PRIMARY KEY (id),
    CONSTRAINT interviewstages_job_application_id_fkey
        FOREIGN KEY (job_application_id) REFERENCES jobapplications(id)
);

CREATE TABLE bidder_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bidder_id uuid NOT NULL,
    developer_id uuid NOT NULL,
    paid_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    amount numeric NOT NULL,
    application_count integer NOT NULL,
    CONSTRAINT bidder_payments_pkey PRIMARY KEY (id),
    CONSTRAINT bidder_payments_bidder_id_fkey
        FOREIGN KEY (bidder_id) REFERENCES users(id),
    CONSTRAINT bidder_payments_developer_id_fkey
        FOREIGN KEY (developer_id) REFERENCES users(id)
);

CREATE TABLE bidder_payment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bidder_id uuid NOT NULL,
    developer_id uuid NOT NULL,
    amount numeric(10, 2) NOT NULL,
    paid_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bidder_payment_history_pkey PRIMARY KEY (id),
    CONSTRAINT bidder_payment_history_bidder_id_fkey
        FOREIGN KEY (bidder_id) REFERENCES users(id),
    CONSTRAINT bidder_payment_history_developer_id_fkey
        FOREIGN KEY (developer_id) REFERENCES users(id)
);

CREATE TABLE developer_managers (
    developer_id uuid NOT NULL,
    manager_id uuid NOT NULL,
    CONSTRAINT developer_managers_pkey PRIMARY KEY (developer_id, manager_id),
    CONSTRAINT unique_manager UNIQUE (manager_id),
    CONSTRAINT developer_managers_developer_id_fkey
        FOREIGN KEY (developer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT developer_managers_manager_id_fkey
        FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE
);
