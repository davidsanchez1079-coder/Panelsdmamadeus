-- Estado persistente del panel (Vercel/serverless).
-- Ejecuta esto en Supabase SQL Editor (o vía migraciones) antes de usar "Guardar en datos" en producción.

create table if not exists public.panelsdm_state (
  id text primary key,
  v1_json jsonb not null,
  executive_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.panelsdm_state enable row level security;

-- Sin políticas: anon/authenticated no pueden leer/escribir por PostgREST.
-- El SERVICE ROLE (server-side) bypass RLS y es el que usa la app en Vercel.

revoke all on table public.panelsdm_state from anon, authenticated;
