import Papa from 'papaparse'
import { normalizar, matchProfesor } from './util'

// ============================================================
// Importador agnóstico al formato del List.
// Reconoce por alias tanto "Base de datos - exámenes de grado"
// como "Planificación exámenes de grado", y conserva la fila
// original completa para devolverla intacta al exportar.
// ============================================================

const ALIAS = {
  codigo: ['ID Examen', 'ID', 'Codigo', 'Código'],
  titulo_lista: ['Título', 'Titulo', 'Title'],
  nombre_trabajo: ['Nombre del trabajo', 'Nombre de la tesis', 'Título del trabajo', 'Tesis'],
  area: ['Área', 'Area', 'Área de la tesis', 'Especialidad'],
  integrantes: ['Integrantes', 'Estudiantes'],
  rut: ['Rut', 'RUT', 'Ruts', 'RUTs'],
  modalidad: ['Modalidad del examen', 'Modalidad'],
  modalidad_carrera: ['Modalidad de la carrera'],
  sala: ['Sala'],
  fecha: ['Fecha Examen', 'Fecha del examen'],
  hora_inicio: ['Hora Inicio', 'Hora de inicio'],
  hora_fin: ['Hora Término', 'Hora Termino', 'Hora de término'],
  observaciones: ['Observaciones'],
  apto: ['Apto para Rendir', 'Apto para rendir', 'Apto', 'Pago al día', 'Pago al dia'],
  estado_portal: ['Estado Portal'],
  resultado_portal: ['Resultado Portal'],
}

const buscarCol = (headers, variantes) => {
  const hs = headers.map(normalizar)
  for (const v of variantes) {
    const i = hs.indexOf(normalizar(v))
    if (i >= 0) return headers[i]
  }
  return null
}

// Todas las columnas cuyo nombre menciona un rol (guía, presidente, experto).
// Así funciona aunque el List tenga una sola columna o tres por rol.
const colsDeRol = (headers, palabras) =>
  headers.filter((h) => {
    const n = normalizar(h)
    return palabras.some((p) => n.includes(p))
  })

const val = (fila, col) => (col && fila[col] ? String(fila[col]).trim() : '')

// "31/07/2026 10:00" o "2026-07-31" -> "2026-07-31"
function aFechaISO(txt) {
  if (!txt) return null
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const m = txt.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function aHora(txt) {
  const m = (txt || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

const sumar90 = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + 90
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// "Pendiente" o "-" no son identificadores utilizables
const idUtil = (v) => {
  const n = normalizar(v)
  return v && n !== 'pendiente' && n !== '-' && n !== 'sin id' ? v.trim() : null
}

const esNo = (v) => ['no', 'false', '0', 'n'].includes(normalizar(v))
const esSi = (v) => ['si', 'sí', 'true', '1', 's'].includes(normalizar(v))

export const claveDedup = (codigo, tesis, integrantes) =>
  idUtil(codigo) || `f:${normalizar(tesis)}::${normalizar(integrantes)}`

export function parsearCSV(texto, profesores = []) {
  const res = Papa.parse(texto.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy' })
  const headers = res.meta.fields || []

  const col = {}
  for (const [k, v] of Object.entries(ALIAS)) col[k] = buscarCol(headers, v)
  // Columnas por estudiante, si el List las tuviera desglosadas
  const colsEst = [1, 2, 3, 4].map((i) => ({
    nombre: buscarCol(headers, [`Estudiante ${i}`, `Integrante ${i}`]),
    rut: buscarCol(headers, [`RUT ${i}`, `Rut ${i}`]),
  }))

  const colsGuia = colsDeRol(headers, ['docente guia', 'docente guía', 'profesor guia', 'profesor guía'])
  const colsPres = colsDeRol(headers, ['presidente'])
  const colsExp = colsDeRol(headers, ['experto'])

  const filas = []
  const advertencias = []
  let ignoradas = 0

  for (const r of res.data) {
    const tesis = val(r, col.nombre_trabajo)
    const integrantesTxt = val(r, col.integrantes)
    const rutTxt = val(r, col.rut)

    // Estudiantes: primero columnas desglosadas, si no la lista con pipes.
    let estudiantes = []
    for (const c of colsEst) {
      const n = val(r, c.nombre)
      if (n) estudiantes.push({ nombre: n, rut: val(r, c.rut) || null })
    }
    if (!estudiantes.length && integrantesTxt) {
      const nombres = integrantesTxt.split('|').map((s) => s.trim()).filter(Boolean)
      const ruts = rutTxt.split('|').map((s) => s.trim())
      estudiantes = nombres.map((nombre, i) => ({
        nombre,
        rut: (ruts.length === 1 && nombres.length === 1 ? ruts[0] : ruts[i]) || null,
      }))
    }

    if (!tesis && !estudiantes.length) { ignoradas++; continue }

    // --- Apto para rendir (pago del arancel): puede venir por estudiante ---
    // Si el valor trae "|", se alinea con Integrantes; si es un valor único,
    // aplica a todo el grupo.
    const aptoTxtBruto = val(r, col.apto)
    const aptosCol = [1, 2, 3, 4].map((i) =>
      buscarCol(headers, [`Apto ${i}`, `Apto para Rendir ${i}`, `Apto estudiante ${i}`])
    )
    if (col.apto || aptosCol.some(Boolean)) {
      const porPipe = aptoTxtBruto.includes('|')
        ? aptoTxtBruto.split('|').map((x) => x.trim())
        : null
      estudiantes = estudiantes.map((e, i) => {
        const individual = val(r, aptosCol[i])
        const txt = individual || (porPipe ? porPipe[i] : aptoTxtBruto)
        return { ...e, apto_rendir: txt === undefined || txt === '' ? true : !esNo(txt) }
      })
    } else {
      estudiantes = estudiantes.map((e) => ({ ...e, apto_rendir: true }))
    }

    // --- Roles: se prueban todas las columnas que mencionan el rol ---
    const resolver = (cols) => {
      const encontrados = []
      for (const c of cols) {
        const txt = val(r, c)
        if (!txt) continue
        const p = matchProfesor(txt, profesores)
        if (p) encontrados.push({ campo: c, prof: p })
      }
      const ids = new Set(encontrados.map((e) => e.prof.id))
      return { prof: ids.size === 1 ? encontrados[0].prof : null, encontrados, conflicto: ids.size > 1 }
    }

    const rGuia = resolver(colsGuia)
    const rPres = resolver(colsPres)
    const rExp = resolver(colsExp)

    if (rGuia.conflicto)
      advertencias.push(
        `"${(tesis || 'tesis sin título').slice(0, 60)}": las columnas de docente guía apuntan a personas distintas (` +
        rGuia.encontrados.map((e) => `${e.campo} → ${e.prof.nombre}`).join('; ') +
        '). Queda sin vincular.'
      )

    const guiaTexto = colsGuia.map((c) => val(r, c)).find(Boolean) || null
    const fecha = aFechaISO(val(r, col.fecha))
    const horaIni = aHora(val(r, col.hora_inicio)) || aHora(val(r, col.fecha))
    const horaFin = aHora(val(r, col.hora_fin)) || sumar90(horaIni)

    // El examen solo queda fuera de las propuestas si NINGÚN integrante puede rendir
    const apto = estudiantes.some((e) => e.apto_rendir !== false)

    // Agendado solo si hay fecha y comisión completa de tres personas distintas
    const trio = [rGuia.prof, rPres.prof, rExp.prof].filter(Boolean).map((p) => p.id)
    const trioValido = trio.length === 3 && new Set(trio).size === 3
    if (fecha && horaIni && trio.length === 3 && !trioValido)
      advertencias.push(
        `"${(tesis || 'tesis sin título').slice(0, 60)}": la comisión del List repite a la misma persona en más de un rol. Queda pendiente.`
      )

    filas.push({
      clave: claveDedup(val(r, col.codigo) || val(r, col.titulo_lista), tesis, integrantesTxt),
      codigo: idUtil(val(r, col.codigo)) || idUtil(val(r, col.titulo_lista)),
      nombre_trabajo: tesis || null,
      area: val(r, col.area) || null,
      guia_texto: guiaTexto,
      guia_id: rGuia.prof?.id || null,
      presidente_id: rPres.prof?.id || null,
      experto_id: rExp.prof?.id || null,
      presidente_texto: colsPres.map((c) => val(r, c)).find(Boolean) || null,
      experto_texto: colsExp.map((c) => val(r, c)).find(Boolean) || null,
      fecha,
      hora_inicio: horaIni,
      hora_fin: horaFin,
      modalidad: val(r, col.modalidad) || null,
      modalidad_carrera: val(r, col.modalidad_carrera) || null,
      sala: val(r, col.sala) || null,
      registro_obs: val(r, col.observaciones) || null,
      estado_portal: val(r, col.estado_portal) || null,
      resultado_portal: val(r, col.resultado_portal) || null,
      apto_rendir: apto,
      estado: fecha && horaIni && trioValido ? 'agendado' : 'pendiente',
      raw: r,
      estudiantes,
    })
  }

  if (!col.area)
    advertencias.push(
      'El archivo no trae columna de Área: las comisiones se armarán sin priorizar por especialidad.'
    )
  if (!col.rut && !colsEst.some((c) => c.rut))
    advertencias.push('El archivo no trae RUT: el Registro de Observaciones saldrá sin ese dato.')
  if (ignoradas)
    advertencias.push(`Se omitieron ${ignoradas} fila(s) sin nombre de trabajo ni integrantes.`)
  const estNoAptos = filas.reduce(
    (a, f) => a + f.estudiantes.filter((e) => e.apto_rendir === false).length, 0
  )
  const gruposSinNadie = filas.filter((f) => !f.apto_rendir).length
  if (estNoAptos)
    advertencias.push(
      `${estNoAptos} estudiante(s) no están habilitados para rendir (pago pendiente): quedan fuera ` +
      'de la evaluación y del acta, aunque su grupo sí rinda.'
    )
  if (gruposSinNadie)
    advertencias.push(
      `${gruposSinNadie} tesis no tienen ningún integrante habilitado: quedan fuera de las propuestas.`
    )

  return { filas, advertencias }
}

// ---------------- EXPORTACIÓN ----------------
// Conserva las columnas originales del archivo importado y agrega al final
// las columnas que gestiona la plataforma.

const COLS_PLATAFORMA = [
  'Estado plataforma', 'Fecha agendada', 'Hora inicio agendada', 'Hora término agendada',
  'Presidente asignado', 'Docente experto asignado', 'Guía asignado', 'Sala asignada',
  'Modalidad asignada', 'Habilitados para rendir', 'Notas Presentación', 'Notas Defensa', 'Resultado',
]

const ESTADO_TXT = {
  pendiente: 'Pendiente de agendar',
  propuesto: 'Propuesta por confirmar',
  agendado: 'Agendado',
  realizado: 'Realizado',
}

const fmtFechaList = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function exportarCSV(examenes, estudiantesPorExamen, profesoresById) {
  // Orden de columnas: las originales del List, en el orden en que aparecieron
  const originales = []
  for (const e of examenes) {
    for (const k of Object.keys(e.raw || {})) if (!originales.includes(k)) originales.push(k)
  }
  const cols = [...originales, ...COLS_PLATAFORMA.filter((c) => !originales.includes(c))]
  const nom = (id) => (id && profesoresById[id] ? profesoresById[id].nombre : '')

  const filas = examenes.map((e) => {
    const base = { ...(e.raw || {}) }
    for (const c of cols) if (base[c] === undefined) base[c] = ''
    const est = estudiantesPorExamen[e.id] || []

    base['Estado plataforma'] = ESTADO_TXT[e.estado] || e.estado
    base['Fecha agendada'] = fmtFechaList(e.fecha)
    base['Hora inicio agendada'] = (e.hora_inicio || '').slice(0, 5)
    base['Hora término agendada'] = (e.hora_fin || '').slice(0, 5)
    base['Presidente asignado'] = nom(e.presidente_id)
    base['Docente experto asignado'] = nom(e.experto_id)
    base['Guía asignado'] = nom(e.guia_id) || e.guia_texto || ''
    base['Sala asignada'] = e.sala || ''
    base['Modalidad asignada'] = e.modalidad || ''
    base['Habilitados para rendir'] = est
      .map((s) => (s.apto_rendir === false ? 'No' : 'Sí'))
      .join('|')
    base['Notas Presentación'] = est.map((s) => (s.nota_presentacion ?? '')).join('|')
    base['Notas Defensa'] = est.map((s) => (s.nota_defensa ?? '')).join('|')
    base['Resultado'] = est
      .map((s) =>
        s.apto_rendir === false
          ? 'No rinde'
          : s.aprobado == null ? '' : s.aprobado ? 'Aprobado' : 'Reprobado'
      )
      .join('|')

    // Refresca también las columnas originales que la plataforma gestiona
    const sobreescribir = (alias, valor) => {
      if (!valor) return
      for (const c of originales) {
        if (alias.some((a) => normalizar(a) === normalizar(c))) base[c] = valor
      }
    }
    sobreescribir(ALIAS.sala, e.sala)
    sobreescribir(ALIAS.modalidad, e.modalidad)
    sobreescribir(ALIAS.fecha, e.fecha ? fmtFechaList(e.fecha) : '')
    sobreescribir(ALIAS.hora_inicio, (e.hora_inicio || '').slice(0, 5))
    if (est.length) sobreescribir(ALIAS.integrantes, est.map((s) => s.nombre).join('|'))
    return base
  })

  const csv = Papa.unparse({ fields: cols, data: filas.map((f) => cols.map((c) => f[c] ?? '')) })
  return '\uFEFF' + csv
}

export function descargarArchivo(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
