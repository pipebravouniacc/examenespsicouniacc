-- ============================================================
-- Migración 03 · "Apto para rendir" por estudiante
-- (corresponde al pago del arancel de examen)
-- Ejecutar en Supabase → SQL Editor → New query → Run.
-- Es idempotente.
-- ============================================================

alter table estudiantes add column if not exists apto_rendir boolean not null default true;

comment on column estudiantes.apto_rendir is
  'Habilitado para rendir el examen (pago al día). Si es false, el/la estudiante '
  'no se evalúa ni aparece en el acta, aunque el resto del grupo sí rinda.';

comment on column examenes.apto_rendir is
  'Derivado: false solo cuando ningún integrante del grupo está habilitado para rendir.';
