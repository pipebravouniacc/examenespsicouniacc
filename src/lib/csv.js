import Papa from 'papaparse'
import { normalizar, fmtFecha } from './util'

// ------- IMPORTACIÓN -------
// Plantilla recomendada (columnas en el List):
//   ID Examen | Nombre del trabajo | Área | Docente guía |
//   Estudiante 1..4 | RUT 1..4 | Modalidad
// También se aceptan las columnas del List original:
//   "Integrantes" (nombres separados por |) y "Docente guía nombre".

const buscarCol = (headers, ...variantes) => {
  const hs = headers.map((h) => normalizar(h))
  for (const v of variantes) {
    const i = hs.indexOf(normalizar(v))
    if (i >= 0) return headers[i]
  }
  return null
}

export function parsearCSV(texto) {
  const res = Papa.parse(texto.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
  })
  const headers = res.meta.fields || []
  const col = {
    codigo: buscarCol(headers, 'ID Examen', 'ID', 'Codigo'),
    trabajo: buscarCol(headers, 'Nombre del trabajo', 'Titulo', 'Título del trabajo'),
    area: buscarCol(headers, 'Área', 'Area', 'Especialidad', 'Área de la tesis'),
    guia: buscarCol(headers, 'Docente guía', 'Docente guia', 'Docente guía nombre'),
    integrantes: buscarCol(headers, 'Integrantes'),
    modalidad: buscarCol(headers, 'Modalidad', 'Modalidad del examen'),
  }
  const estCols = []
  for (let i = 1; i <= 4; i++) {
    estCols.push({
      nombre: buscarCol(headers, `Estudiante ${i}`, `Estudiante ${i} Nombre`),
      rut: buscarCol(headers, `RUT ${i}`, `Estudiante ${i} RUT`),
    })
  }

  const filas = []
  for (const r of res.data) {
    const codigo = col.codigo ? (r[col.codigo] || '').trim() : ''
    const trabajo = col.trabajo ? (r[col.trabajo] || '').trim() : ''
    const guia = col.guia ? (r[col.guia] || '').trim() : ''

    let estudiantes = []
    for (const c of estCols) {
      const n = c.nombre ? (r[c.nombre] || '').trim() : ''
      if (n) estudiantes.push({ nombre: n, rut: c.rut ? (r[c.rut] || '').trim() : '' })
    }
    if (!estudiantes.length && col.integrantes) {
      estudiantes = (r[col.integrantes] || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((nombre) => ({ nombre, rut: '' }))
    }

    if (!codigo && !trabajo && !guia && !estudiantes.length) continue
    filas.push({
      codigo,
      nombre_trabajo: trabajo,
      area: col.area ? (r[col.area] || '').trim() : '',
      guia_texto: guia,
      modalidad: col.modalidad ? (r[col.modalidad] || '').trim() : '',
      estudiantes,
    })
  }
  return { filas, advertencias: advertenciasImport(col) }
}

function advertenciasImport(col) {
  const a = []
  if (!col.guia) a.push('No se encontró la columna del docente guía.')
  if (!col.area) a.push('No se encontró la columna de Área: el match de especialidades no operará.')
  if (!col.trabajo) a.push('No se encontró la columna Nombre del trabajo (requerida para los PDF).')
  return a
}

// ------- EXPORTACIÓN (formato del List de la coordinadora) -------
const COLS_LIST = [
  'ID Examen', 'Estado del proceso', 'Fecha Examen', 'Hora Inicio', 'Hora Término',
  'Integrantes', 'Docente guía nombre', 'Presidente de comisión', 'Docente Experto nombre',
  'Modalidad del examen', 'Sala', 'Link reunión', 'Acta Recibida', 'Citación Enviada',
  'Observaciones', 'Responsable', 'Estado General', 'Observaciones Sistema',
  'Fecha asignación comisión', 'Fecha envío citación', 'Fecha recepción acta',
  'Fecha envío a Títulos y Grados', 'Conflictos', 'Acción siguiente',
]

const ESTADO_LIST = {
  pendiente: 'Solicitud recibida',
  propuesto: 'Propuesta de comisión',
  agendado: 'Comisión asignada',
  realizado: 'Examen realizado',
}

export function exportarCSV(examenes, estudiantesPorExamen, profesoresById) {
  const filas = examenes.map((e) => {
    const est = estudiantesPorExamen[e.id] || []
    const nom = (id) => (id && profesoresById[id] ? profesoresById[id].nombre : '')
    return {
      'ID Examen': e.codigo || '',
      'Estado del proceso': ESTADO_LIST[e.estado] || e.estado,
      'Fecha Examen': e.fecha ? `${fmtFecha(e.fecha)} ${e.hora_inicio || ''}`.trim() : '',
      'Hora Inicio': e.hora_inicio || '',
      'Hora Término': e.hora_fin || '',
      'Integrantes': est.map((s) => s.nombre).join('|'),
      'Docente guía nombre': nom(e.guia_id) || e.guia_texto || '',
      'Presidente de comisión': nom(e.presidente_id),
      'Docente Experto nombre': nom(e.experto_id),
      'Modalidad del examen': e.modalidad || '',
      'Sala': e.sala || '',
      'Link reunión': e.link_reunion || '',
      'Acta Recibida': '',
      'Citación Enviada': '',
      'Observaciones': e.registro_obs || '',
      'Responsable': '',
      'Estado General': ESTADO_LIST[e.estado] || '',
      'Observaciones Sistema': e.intento > 1 ? `Reagendamiento (intento ${e.intento})` : '',
      'Fecha asignación comisión': '',
      'Fecha envío citación': '',
      'Fecha recepción acta': '',
      'Fecha envío a Títulos y Grados': '',
      'Conflictos': '',
      'Acción siguiente': e.estado === 'agendado' ? 'Realizar examen' : '',
    }
  })
  const csv = Papa.unparse({ fields: COLS_LIST, data: filas.map((f) => COLS_LIST.map((c) => f[c])) })
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
