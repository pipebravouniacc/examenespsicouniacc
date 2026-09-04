-- ============================================================
-- Migración 01 · Ajuste del importador al List real
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Es idempotente: puede correrse más de una vez sin problema.
-- ============================================================

-- Fila original del List, para devolverla intacta al exportar
alter table examenes add column if not exists raw jsonb;

-- Clave de deduplicación (el "ID Examen" del List suele venir como "Pendiente")
alter table examenes add column if not exists clave_dedup text;

-- Datos del List que la plataforma no gestiona pero sí muestra
alter table examenes add column if not exists modalidad_carrera text;
alter table examenes add column if not exists presidente_texto text;
alter table examenes add column if not exists experto_texto text;

create index if not exists idx_examenes_clave on examenes (clave_dedup);

-- Corrección del trigger de privilegios: solo debe actuar cuando hay
-- sesión autenticada, para que el SQL Editor pueda asignar el rol admin.
create or replace function proteger_privilegios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not es_admin_actual() then
    if tg_op = 'INSERT' then
      new.es_admin := false;
      new.habilitado := false;
      new.tipo := 'planta';
    else
      new.es_admin := old.es_admin;
      new.habilitado := old.habilitado;
      new.tipo := old.tipo;
    end if;
  end if;
  return new;
end;
$$;
