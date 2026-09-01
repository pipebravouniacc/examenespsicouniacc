// Motor de propuestas de agendamiento.
// Cadena de prioridades:
//   a) La disponibilidad del profesor guía manda (sin ella, no hay propuesta).
//   b) Presidente: SIEMPRE planta. Prioridad: planta con especialidad del área;
//      si no hay, planta sin especialidad (aleatorio).
//   c) Docente experto: planta con especialidad → hora con especialidad →
//      planta sin especialidad (aleatorio dentro de cada grupo).
// Restricciones duras: bloque de 90 min dentro de una franja del guía y dentro
// de la ventana definida por la Admin; ningún docente en dos exámenes a la vez;
// presidente, experto y guía son tres personas distintas.

import { aMin, aHHMM, barajar, normalizar } from './util'

const DURACION = 90
const PASO = 30

function disponibleEn(disps, profId, fecha, ini, fin) {
  return disps.some(
    (d) =>
      d.profesor_id === profId &&
      d.fecha === fecha &&
      aMin(d.hora_inicio) <= ini &&
      aMin(d.hora_fin) >= fin
  )
}

function ocupadoEn(ocupaciones, profId, fecha, ini, fin) {
  return ocupaciones.some(
    (o) =>
      o.fecha === fecha &&
      [o.guia_id, o.presidente_id, o.experto_id].includes(profId) &&
      aMin(o.hora_inicio) < fin &&
      aMin(o.hora_fin) > ini
  )
}

function tieneEspecialidad(prof, area) {
  const a = normalizar(area)
  if (!a) return false
  return (prof.especialidades || []).some((e) => normalizar(e) === a)
}

// Genera una propuesta para un examen. `descartes` = propuestas ya rechazadas
// (se evita repetir exactamente la misma combinación fecha+hora+comisión).
export function proponer(examen, ctx, descartes = []) {
  const { ventanas, disponibilidades, profesores, ocupaciones } = ctx
  if (!examen.guia_id)
    return { ok: false, motivo: 'El profesor guía no está vinculado a un docente registrado.' }

  const guia = profesores.find((p) => p.id === examen.guia_id)
  const dispGuia = disponibilidades.filter((d) => d.profesor_id === examen.guia_id)
  if (!dispGuia.length)
    return {
      ok: false,
      motivo: `${guia ? guia.nombre : 'El profesor guía'} no ha ingresado disponibilidad horaria.`,
    }

  const ventanasOrd = [...ventanas].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const esDescartada = (prop) =>
    descartes.some(
      (d) =>
        d.fecha === prop.fecha &&
        d.hora_inicio === prop.hora_inicio &&
        d.presidente_id === prop.presidente_id &&
        d.experto_id === prop.experto_id
    )

  for (const v of ventanasOrd) {
    const vIni = aMin(v.hora_inicio)
    const vFin = aMin(v.hora_fin)
    const franjasGuia = dispGuia.filter((d) => d.fecha === v.fecha)

    for (const f of franjasGuia) {
      const desde = Math.max(aMin(f.hora_inicio), vIni)
      const hasta = Math.min(aMin(f.hora_fin), vFin)

      for (let ini = desde; ini + DURACION <= hasta; ini += PASO) {
        const fin = ini + DURACION
        if (ocupadoEn(ocupaciones, examen.guia_id, v.fecha, ini, fin)) continue

        const libre = (p) =>
          p.id !== examen.guia_id &&
          disponibleEn(disponibilidades, p.id, v.fecha, ini, fin) &&
          !ocupadoEn(ocupaciones, p.id, v.fecha, ini, fin)

        // --- Presidente: siempre planta habilitado ---
        const plantas = profesores.filter((p) => p.tipo === 'planta' && p.habilitado && libre(p))
        const presConEsp = barajar(plantas.filter((p) => tieneEspecialidad(p, examen.area)))
        const presSinEsp = barajar(plantas.filter((p) => !tieneEspecialidad(p, examen.area)))
        const candidatosPres = [...presConEsp, ...presSinEsp]

        for (const pres of candidatosPres) {
          // --- Experto: planta c/esp → hora c/esp → planta s/esp ---
          const pool = (cond) =>
            barajar(profesores.filter((p) => p.id !== pres.id && cond(p) && libre(p)))
          const candidatosExp = [
            ...pool((p) => p.tipo === 'planta' && p.habilitado && tieneEspecialidad(p, examen.area)),
            ...pool((p) => p.tipo === 'hora' && tieneEspecialidad(p, examen.area)),
            ...pool(
              (p) => p.tipo === 'planta' && p.habilitado && !tieneEspecialidad(p, examen.area)
            ),
          ]
          if (!candidatosExp.length) continue

          for (const exp of candidatosExp) {
            const prop = {
              fecha: v.fecha,
              hora_inicio: aHHMM(ini),
              hora_fin: aHHMM(fin),
              presidente_id: pres.id,
              experto_id: exp.id,
            }
            if (!esDescartada(prop)) return { ok: true, propuesta: prop }
          }
        }
      }
    }
  }
  return {
    ok: false,
    motivo:
      'No se encontró un bloque de 90 minutos con guía disponible y comisión completa en las fechas habilitadas.',
  }
}
