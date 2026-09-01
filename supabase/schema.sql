-- ============================================================
-- Plataforma Exámenes de Título y Grado · Psicología UNIACC
-- Ejecutar completo en Supabase: SQL Editor > New query > Run
-- ============================================================

-- ---------- TABLAS ----------

create table if not exists profesores (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  correo_ms text,
  correo_gmail text,
  tipo text not null default 'planta' check (tipo in ('planta','hora')),
  especialidades text[] not null default '{}',
  habilitado boolean not null default false,
  es_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists especialidades (
  id serial primary key,
  nombre text not null unique
);

create table if not exists ventanas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  hora_inicio time not null default '09:00',
  hora_fin time not null default '18:00'
);

create table if not exists disponibilidades (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores(id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  check (hora_fin > hora_inicio)
);

create table if not exists examenes (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nombre_trabajo text,
  area text,
  guia_texto text,
  guia_id uuid references profesores(id),
  presidente_id uuid references profesores(id),
  experto_id uuid references profesores(id),
  fecha date,
  hora_inicio time,
  hora_fin time,
  modalidad text,
  sala text,
  link_reunion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','propuesto','agendado','realizado')),
  propuesta jsonb,
  descartes jsonb not null default '[]'::jsonb,
  intento int not null default 1,
  examen_padre uuid references examenes(id),
  raw jsonb,
  clave_dedup text,
  modalidad_carrera text,
  presidente_texto text,
  experto_texto text,
  grupal_puntajes jsonb,
  retro_obs text,
  registro_obs text,
  realizado_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists estudiantes (
  id uuid primary key default gen_random_uuid(),
  examen_id uuid not null references examenes(id) on delete cascade,
  nombre text not null,
  rut text,
  orden int not null default 1,
  puntajes jsonb,
  apto_rendir boolean not null default true,
  nota_presentacion numeric(3,1),
  nota_defensa numeric(3,1),
  aprobado boolean
);

-- ---------- FUNCIONES DE APOYO ----------

create or replace function es_admin_actual() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select es_admin from profesores where auth_id = auth.uid() limit 1),
    false
  );
$$;

create or replace function mi_profesor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profesores where auth_id = auth.uid() limit 1;
$$;

-- Impide que un no-admin se auto-asigne privilegios al crear/editar su perfil
create or replace function proteger_privilegios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Solo aplica cuando hay sesion autenticada; las operaciones desde el
  -- SQL Editor o con service_role deben poder asignar privilegios.
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

drop trigger if exists trg_proteger_privilegios on profesores;
create trigger trg_proteger_privilegios
  before insert or update on profesores
  for each row execute function proteger_privilegios();

-- ---------- RLS ----------

alter table profesores enable row level security;
alter table especialidades enable row level security;
alter table ventanas enable row level security;
alter table disponibilidades enable row level security;
alter table examenes enable row level security;
alter table estudiantes enable row level security;

-- Lectura: cualquier usuario autenticado (herramienta interna)
create policy sel_profesores on profesores for select to authenticated using (true);
create policy sel_especialidades on especialidades for select to authenticated using (true);
create policy sel_ventanas on ventanas for select to authenticated using (true);
create policy sel_disponibilidades on disponibilidades for select to authenticated using (true);
create policy sel_examenes on examenes for select to authenticated using (true);
create policy sel_estudiantes on estudiantes for select to authenticated using (true);

-- profesores: cada quien crea/edita su propia fila; admin todo
create policy ins_profesor_propio on profesores for insert to authenticated
  with check (auth_id = auth.uid() or es_admin_actual());
create policy upd_profesor_propio on profesores for update to authenticated
  using (auth_id = auth.uid() or es_admin_actual());
create policy del_profesor_admin on profesores for delete to authenticated
  using (es_admin_actual());

-- especialidades y ventanas: solo admin escribe
create policy wr_especialidades on especialidades for all to authenticated
  using (es_admin_actual()) with check (es_admin_actual());
create policy wr_ventanas on ventanas for all to authenticated
  using (es_admin_actual()) with check (es_admin_actual());

-- disponibilidades: dueño o admin
create policy wr_disponibilidades on disponibilidades for all to authenticated
  using (profesor_id = mi_profesor_id() or es_admin_actual())
  with check (profesor_id = mi_profesor_id() or es_admin_actual());

-- examenes: admin todo; presidente puede actualizar (evaluación)
create policy ins_examenes_admin on examenes for insert to authenticated
  with check (es_admin_actual());
create policy upd_examenes on examenes for update to authenticated
  using (es_admin_actual() or presidente_id = mi_profesor_id());
create policy del_examenes_admin on examenes for delete to authenticated
  using (es_admin_actual());

-- estudiantes: admin todo; presidente del examen puede actualizar notas
create policy ins_estudiantes_admin on estudiantes for insert to authenticated
  with check (es_admin_actual());
create policy upd_estudiantes on estudiantes for update to authenticated
  using (
    es_admin_actual() or exists (
      select 1 from examenes e
      where e.id = examen_id and e.presidente_id = mi_profesor_id()
    )
  );
create policy del_estudiantes_admin on estudiantes for delete to authenticated
  using (es_admin_actual());

-- ---------- SEED ----------

insert into especialidades (nombre) values
  ('Psicología educacional'),
  ('Psicología clínica adultos'),
  ('Psicología clínica infanto-juvenil'),
  ('Psicología organizacional'),
  ('Psicología social y comunitaria'),
  ('Psicología jurídica y forense'),
  ('Neuropsicología'),
  ('Metodología cuantitativa'),
  ('Metodología cualitativa'),
  ('Psicometría')
on conflict (nombre) do nothing;

-- ============================================================
-- DESPUÉS DEL PRIMER REGISTRO DE LA COORDINADORA EN LA APP,
-- ejecutar (reemplazando el correo) para darle rol de admin:
--
-- update profesores set es_admin = true, habilitado = true
-- where correo_ms = 'coordinadora@uniacc.cl';
-- ============================================================
