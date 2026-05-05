-- Permisos explícitos para el rol service_role (API con clave service_role en el servidor).
-- Útil si la tabla se creó a mano y faltaban grants tras un revoke a anon/authenticated.

grant select, insert, update, delete on table public.panelsdm_state to service_role;
grant select, insert, update, delete on table public.panelsdm_state to postgres;
