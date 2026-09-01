-- ============================================================
-- Migración 02 · CSV nuevo, cuentas creadas por coordinación
-- y edición manual de tesis.
-- Ejecutar en Supabase → SQL Editor → New query → Run.
-- Es idempotente: puede correrse más de una vez.
-- ============================================================

-- ---------- Campos nuevos del List ----------
alter table examenes add column if not exists estado_portal text;
alter table examenes add column if not exists resultado_portal text;
alter table examenes add column if not exists apto_rendir boolean not null default true;

-- Campos de la migración 01, por si se ejecuta esta primero
alter table examenes add column if not exists raw jsonb;
alter table examenes add column if not exists clave_dedup text;
alter table examenes add column if not exists modalidad_carrera text;
alter table examenes add column if not exists presidente_texto text;
alter table examenes add column if not exists experto_texto text;
create index if not exists idx_examenes_clave on examenes (clave_dedup);

-- ---------- Cuentas creadas por la coordinación ----------
-- Marca que el docente debe definir su propia contraseña al primer ingreso.
alter table profesores add column if not exists debe_cambiar_clave boolean not null default false;

-- La coordinación puede crear la ficha del docente antes de que exista la
-- cuenta (auth_id nulo). Al ingresar por primera vez, la app llama a esta
-- función y enlaza la cuenta con la ficha que ya tenía preparada.
create or replace function vincular_perfil() returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
  v_id uuid;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return null; end if;

  update profesores
     set auth_id = auth.uid()
   where auth_id is null
     and (lower(correo_ms) = lower(v_email) or lower(correo_gmail) = lower(v_email))
   returning id into v_id;

  return v_id;
end;
$$;

grant execute on function vincular_perfil() to authenticated;

-- ---------- Trigger de privilegios (corrección migración 01) ----------
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
