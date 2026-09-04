-- ============================================================
-- Migración 04 · Cargo de los docentes planta
-- Ejecutar en Supabase → SQL Editor → New query → Run.
-- Es idempotente y NO borra ni altera los docentes ya cargados:
-- solo agrega una columna que queda vacía hasta que la
-- coordinación asigne el cargo desde la pestaña Docentes.
-- ============================================================

alter table profesores add column if not exists cargo text;

-- Restricción de valores permitidos (se recrea para poder reejecutar)
alter table profesores drop constraint if exists profesores_cargo_check;
alter table profesores add constraint profesores_cargo_check
  check (cargo is null or cargo in (
    'Directivo',
    'Académico regular',
    'Académico docente',
    'Secretario académico'
  ));

comment on column profesores.cargo is
  'Cargo institucional del docente de planta. Ordena la prioridad para presidir '
  'comisiones: Directivo > Académico regular > Académico docente > Secretario académico. '
  'Nulo en profesores hora y en fichas aún sin clasificar (quedan al final de la prioridad).';
