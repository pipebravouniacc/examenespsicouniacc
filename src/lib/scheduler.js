// Motor de propuestas de agendamiento.
//
// Cadena de prioridades:
//   a) La disponibilidad del profesor guía manda (sin ella, no hay propuesta).
//   b) Presidente: SIEMPRE docente de planta habilitado. Se prioriza por
//      especialidad del área y, dentro de cada grupo, por cargo institucional
//      (Directivo → Académico regular → Académico docente → Secretario
//      académico; las fichas sin cargo quedan al final). Ver PRIORIDAD_PRESIDENTE
//      más abajo para invertir el criterio dominante.
//   c) Docente experto: planta con especialidad → hora con especialidad →
//      planta sin especialidad. Dentro de cada grupo se ordena por cargo.
//
// Restricciones duras:
//   - Bloque de 90 minutos dentro de una franja libre del guía y de la ventana.
//   - Guía, presidente y experto son SIEMPRE tres personas distintas.
//   - Ningún docente puede estar en dos exámenes que se solapen, contando
//     tanto los agendados como las propuestas aún por confirmar.

import { aMin, aHHMM, barajar, normalizar, ordenarPorCargo, rangoCargo } from './util'

const DURACION = 90
const PASO = 30

// 'especialidad' → agrupa primero por especialidad y ordena por cargo dentro
// de cada grupo. 'cargo' → ordena primero por cargo y usa la especialidad
// como desempate. Cambiar solo esta constante invierte el criterio.
export const PRIORIDAD_PRESIDENTE = 'cargo'

export function disponibleEn(disps, profId, fecha, ini, fin) {
  return disps.some(
    (d) =>
      d.profesor_id === profId &&
      d.fecha === fecha &&
      aMin(d.hora_inicio) <= ini &&
      aMin(d.hora_fin) >= fin
  )
}

// Un docente está ocupado si participa, en cualquier rol, de otro examen
// que se solape con el bloque consultado.
export function ocupadoEn(ocupaciones, profId, fecha, ini, fin, excluirExamenId) {
  return ocupaciones.some(
    (o) =>
      o.fecha === fecha &&
      o.examen_id !== excluirExamenId &&
      [o.guia_id, o.presidente_id, o.experto_id].includes(profId) &&
      aMin(o.hora_inicio) < fin &&
      aMin(o.hora_fin) > ini
  )
}

export function tieneEspecialidad(prof, area) {
  const a = normalizar(area)
  if (!a) return false
  return (prof.especialidades || []).some((e) => normalizar(e) === a)
}

// Candidatos a presidente, ordenados según la prioridad configurada.
// En ambos modos se baraja dentro del mismo nivel para no recargar siempre
// a la misma persona.
function candidatosPresidente(plantas, area) {
  const conEsp = (l) => l.filter((p) => tieneEspecialidad(p, area))
  const sinEsp = (l) => l.filter((p) => !tieneEspecialidad(p, area))

  if (PRIORIDAD_PRESIDENTE === 'especialidad') {
    // Especialidad manda; el cargo ordena dentro de cada grupo.
    return [...ordenarPorCargo(conEsp(plantas)), ...ordenarPorCargo(sinEsp(plantas))]
  }

  // Cargo manda; la especialidad desempata dentro de cada cargo.
  const porCargo = new Map()
  for (const p of plantas) {
    const r = rangoCargo(p)
    if (!porCargo.has(r)) porCargo.set(r, [])
    porCargo.get(r).push(p)
  }
  return [...porCargo.keys()]
    .sort((a, b) => a - b)
    .flatMap((r) => {
      const grupo = porCargo.get(r)
      return [...barajar(conEsp(grupo)), ...barajar(sinEsp(grupo))]
    })
}

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
        if (ocupadoEn(ocupaciones, examen.guia_id, v.fecha, ini, fin, examen.id)) continue

        // Disponible y sin choque de horario, excluyendo siempre al guía
        const libre = (p) =>
          p.id !== examen.guia_id &&
          disponibleEn(disponibilidades, p.id, v.fecha, ini, fin) &&
          !ocupadoEn(ocupaciones, p.id, v.fecha, ini, fin, examen.id)

        const plantas = profesores.filter((p) => p.tipo === 'planta' && p.habilitado && libre(p))

        for (const pres of candidatosPresidente(plantas, examen.area)) {
          // Experto: distinto del guía y del presidente
          const pool = (cond) =>
            ordenarPorCargo(
              profesores.filter((p) => p.id !== pres.id && cond(p) && libre(p))
            )
          const candidatosExp = [
            ...pool((p) => p.tipo === 'planta' && p.habilitado && tieneEspecialidad(p, examen.area)),
            ...pool((p) => p.tipo === 'hora' && tieneEspecialidad(p, examen.area)),
            ...pool((p) => p.tipo === 'planta' && p.habilitado && !tieneEspecialidad(p, examen.area)),
          ]

          for (const exp of candidatosExp) {
            // Salvaguarda final: los tres roles deben ser personas distintas
            const trio = [examen.guia_id, pres.id, exp.id]
            if (new Set(trio).size !== 3) continue

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

// ---- Validación de comisiones asignadas a mano ----
// Devuelve la lista de problemas encontrados (vacía si todo está correcto).
export function validarComision({ guia_id, presidente_id, experto_id }, profesores) {
  const nombre = (id) => profesores.find((p) => p.id === id)?.nombre || 'sin asignar'
  const problemas = []
  const pares = [
    ['guía', guia_id, 'presidente/a', presidente_id],
    ['guía', guia_id, 'docente experto/a', experto_id],
    ['presidente/a', presidente_id, 'docente experto/a', experto_id],
  ]
  for (const [rolA, a, rolB, b] of pares) {
    if (a && b && a === b)
      problemas.push(`${nombre(a)} no puede ser ${rolA} y ${rolB} en el mismo examen.`)
  }
  const pres = profesores.find((p) => p.id === presidente_id)
  if (pres && pres.tipo !== 'planta')
    problemas.push(`${pres.nombre} no es docente de planta y no puede presidir la comisión.`)
  return problemas
}

// Choques de horario de una comisión asignada a mano
export function conflictosHorario(examen, ocupaciones, profesores) {
  if (!examen.fecha || !examen.hora_inicio || !examen.hora_fin) return []
  const ini = aMin(examen.hora_inicio)
  const fin = aMin(examen.hora_fin)
  const nombre = (id) => profesores.find((p) => p.id === id)?.nombre
  const roles = [
    ['guía', examen.guia_id],
    ['presidente/a', examen.presidente_id],
    ['docente experto/a', examen.experto_id],
  ]
  return roles
    .filter(([, id]) => id && ocupadoEn(ocupaciones, id, examen.fecha, ini, fin, examen.id))
    .map(([rol, id]) => `${nombre(id)} (${rol}) ya participa en otro examen a esa hora.`)
}
