import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { RUBRICA, NIVELES, notaDesdePuntaje, NOTA_APROBACION, criterioPorId } from './rubrica'
import { LOGO_UNIACC, LOGO_RATIO } from './logo'
import { fmtFecha, fmtNota } from './util'

const INK = [23, 23, 26]
const MAGENTA = [229, 23, 123]
const STEEL = [61, 127, 166]
const GRIS = [120, 120, 124]

const LOGO_ANCHO = 42 // mm

function encabezado(doc, subtitulo) {
  const w = doc.internal.pageSize.getWidth()
  doc.addImage(LOGO_UNIACC, 'PNG', 14, 12, LOGO_ANCHO, LOGO_ANCHO / LOGO_RATIO)
  const yTitulo = 12 + LOGO_ANCHO / LOGO_RATIO + 9
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text(subtitulo, w / 2, yTitulo, { align: 'center' })
  return yTitulo + 6
}

const nombreNivel = (p) => {
  const n = NIVELES.find((x) => x.puntos === p)
  if (n) return n.nombre
  if (p === 6) return 'Competente–Avanzado'
  if (p === 4) return 'Inicial–Competente'
  if (p === 2) return 'Necesita mejora–Inicial'
  return ''
}

// Sugerencias de mejora: todo criterio que no alcanzó el puntaje máximo
const mejorasDe = (puntajes, ids) =>
  ids
    .filter((id) => (puntajes || {})[id] && puntajes[id] < 7)
    .map((id) => {
      const c = criterioPorId(id)
      return { indicador: c.indicador, texto: c.mejora, puntaje: puntajes[id] }
    })

// ---------------------------------------------------------------
// PDF 1 · Retroalimentación del examen
// ---------------------------------------------------------------
export function pdfRetroalimentacion({ examen, estudiantes: todos, comision }) {
  const estudiantes = (todos || []).filter((s) => s.apto_rendir !== false)
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = encabezado(doc, 'RETROALIMENTACIÓN · EXAMEN DE TÍTULO Y GRADO')

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, fillColor: [245, 244, 242] } },
    body: [
      ['Nombre del trabajo', examen.nombre_trabajo || '—'],
      ['Área', examen.area || '—'],
      ['Fecha del examen', `${fmtFecha(examen.fecha)} · ${examen.hora_inicio || ''}–${examen.hora_fin || ''}`],
      ['Modalidad / Sala', `${examen.modalidad || '—'} · ${examen.sala || examen.link_reunion || '—'}`],
      ['Comisión evaluadora', [
        `Presidente/a: ${comision.presidente || '—'}`,
        `Docente guía: ${comision.guia || '—'}`,
        `Docente experto/a: ${comision.experto || '—'}`,
      ].join('\n')],
    ],
  })
  y = doc.lastAutoTable.finalY + 6

  const gp = examen.grupal_puntajes || {}
  const idsGrupal = RUBRICA.presentacion.grupal.criterios.map((c) => c.id)
  const gSum = idsGrupal.reduce((a, c) => a + (gp[c] || 0), 0)

  // ----- Componente grupal -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...STEEL)
  doc.text('Presentación de la investigación · Componente grupal', 14, y)
  y += 2
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: STEEL, fontSize: 8 },
    styles: { font: 'helvetica', fontSize: 8, textColor: INK, cellPadding: 1.8 },
    head: [['Indicador de logro', 'Puntaje', 'Nivel de desempeño']],
    columnStyles: { 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 48 } },
    body: RUBRICA.presentacion.grupal.criterios.map((c) => [
      c.indicador, `${gp[c.id] ?? '—'} / 7`, nombreNivel(gp[c.id]),
    ]),
    foot: [[{ content: 'Subtotal grupal', styles: { fontStyle: 'bold' } },
      { content: `${gSum} / 14`, styles: { halign: 'center', fontStyle: 'bold' } }, '']],
    footStyles: { fillColor: [245, 244, 242], textColor: INK },
  })
  y = doc.lastAutoTable.finalY + 4

  const mejorasGrupo = mejorasDe(gp, idsGrupal)
  if (mejorasGrupo.length) {
    y = bloqueMejoras(doc, y, 'Aspectos a fortalecer en la presentación (grupo)', mejorasGrupo)
  }
  y += 3

  // ----- Por estudiante -----
  const idsPresInd = RUBRICA.presentacion.individual.criterios.map((c) => c.id)
  const idsDef = [
    ...RUBRICA.defensa.disciplinares.criterios,
    ...RUBRICA.defensa.transversales.criterios,
  ].map((c) => c.id)

  for (const est of estudiantes) {
    const p = est.puntajes || {}
    const presInd = idsPresInd.reduce((a, c) => a + (p[c] || 0), 0)
    const presTotal = gSum + presInd
    const defTotal = idsDef.reduce((a, c) => a + (p[c] || 0), 0)
    const nPres = est.nota_presentacion ?? notaDesdePuntaje(presTotal)
    const nDef = est.nota_defensa ?? notaDesdePuntaje(defTotal)
    const aprob = nPres >= NOTA_APROBACION && nDef >= NOTA_APROBACION

    if (y > 205) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...MAGENTA)
    doc.text(`${est.nombre}${est.rut ? '  ·  RUT ' + est.rut : ''}`, 14, y)
    y += 2

    const filas = [
      ...RUBRICA.presentacion.individual.criterios.map((c) => [
        'Presentación', c.indicador, `${p[c.id] ?? '—'} / 7`, nombreNivel(p[c.id]),
      ]),
      ...RUBRICA.defensa.disciplinares.criterios.map((c) => [
        'Defensa', c.indicador, `${p[c.id] ?? '—'} / 7`, nombreNivel(p[c.id]),
      ]),
      ...RUBRICA.defensa.transversales.criterios.map((c) => [
        'Defensa', c.indicador, `${p[c.id] ?? '—'} / 7`, nombreNivel(p[c.id]),
      ]),
    ]
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: MAGENTA, fontSize: 8 },
      styles: { font: 'helvetica', fontSize: 8, textColor: INK, cellPadding: 1.6 },
      head: [['Momento', 'Indicador de logro', 'Puntaje', 'Nivel de desempeño']],
      columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 42 } },
      body: filas,
    })
    y = doc.lastAutoTable.finalY + 1.5

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: 1.8, halign: 'center' },
      head: [['Puntaje Presentación', 'Nota Presentación', 'Puntaje Defensa', 'Nota Defensa', 'Resultado']],
      headStyles: { fillColor: [245, 244, 242], textColor: INK, fontSize: 8 },
      body: [[
        `${presTotal} / 28`, fmtNota(nPres), `${defTotal} / 28`, fmtNota(nDef),
        { content: aprob ? 'APROBADO/A' : 'REPROBADO/A',
          styles: { fontStyle: 'bold', textColor: aprob ? [31, 138, 76] : [196, 45, 45] } },
      ]],
    })
    y = doc.lastAutoTable.finalY + 4

    const mejorasEst = mejorasDe(p, [...idsPresInd, ...idsDef])
    if (mejorasEst.length) {
      y = bloqueMejoras(doc, y, `Aspectos a fortalecer · ${est.nombre}`, mejorasEst)
    } else {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(31, 138, 76)
      doc.text('Desempeño máximo en todos los criterios evaluados.', 14, y + 1)
      y += 6
    }
    y += 4
  }

  // ----- Comentarios de la comisión -----
  if (examen.retro_obs) {
    if (y > 235) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text('Comentarios de la comisión', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lineas = doc.splitTextToSize(examen.retro_obs, 185)
    doc.text(lineas, 14, y)
  }

  return doc
}

// Bloque de sugerencias de mejora con viñetas.
// Pagina viñeta por viñeta para no dejar páginas a medio llenar.
const LIMITE_Y = 262

function bloqueMejoras(doc, y, titulo, mejoras) {
  // El título necesita espacio para sí mismo y al menos una viñeta
  if (y + 16 > LIMITE_Y) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.8)
  doc.setTextColor(...INK)
  doc.text(titulo, 14, y + 3)
  y += 6

  for (const m of mejoras) {
    const etiqueta = `${m.indicador} (${m.puntaje}/7):`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const anchoEtq = doc.getTextWidth(etiqueta) + 1
    doc.setFont('helvetica', 'normal')
    const primera = doc.splitTextToSize(m.texto, 176 - anchoEtq)
    const resto = primera.length > 1
      ? doc.splitTextToSize(primera.slice(1).join(' '), 176)
      : []
    const altoViñeta = 6 + 3.5 * resto.length

    if (y + altoViñeta > LIMITE_Y) {
      doc.addPage()
      y = 20
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.8)
      doc.setTextColor(...INK)
      doc.text(`${titulo} (continuación)`, 14, y + 3)
      y += 6
    }

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...MAGENTA)
    doc.text('•', 15, y + 2.5)
    doc.setTextColor(...INK)
    doc.text(etiqueta, 19, y + 2.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRIS)
    doc.text(primera[0] || '', 19 + anchoEtq, y + 2.5)
    if (resto.length) {
      doc.text(resto, 19, y + 6)
      y += 3.5 * resto.length
    }
    y += 6
  }
  doc.setTextColor(...INK)
  return y + 1
}

// ---------------------------------------------------------------
// PDF 2 · Registro de Observaciones (formato institucional)
// ---------------------------------------------------------------
export function pdfRegistroObservaciones({ examen, estudiantes: todos, comision }) {
  const estudiantes = (todos || []).filter((s) => s.apto_rendir !== false)
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = encabezado(doc, 'REGISTRO DE OBSERVACIONES EXAMEN DE TÍTULO Y/O GRADO')
  y += 2

  const base = {
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 2.2,
      lineColor: INK, lineWidth: 0.25,
    },
    margin: { left: 14, right: 14 },
  }

  const filasEgresados = estudiantes.map((e) => [
    `${e.nombre.toUpperCase()}${e.rut ? ' (RUT ' + e.rut + ')' : ''}`,
  ])
  while (filasEgresados.length < 6) filasEgresados.push([' '])

  autoTable(doc, {
    ...base, startY: y,
    body: [
      [{ content: 'CARRERA / PROGRAMA: PSICOLOGÍA', styles: { fontStyle: 'bold' } }],
      [{ content: 'FACULTAD: Facultad de Psicología', styles: { fontStyle: 'bold' } }],
      [{ content: 'NOMBRES COMPLETO EGRESADOS/AS:', styles: { fontStyle: 'bold' } }],
      ...filasEgresados,
    ],
  })
  y = doc.lastAutoTable.finalY + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('NOMBRE DEL TRABAJO:', 14, y)
  y += 2
  autoTable(doc, { ...base, startY: y, body: [[examen.nombre_trabajo || ' '], [' ']] })
  y = doc.lastAutoTable.finalY + 6

  doc.setFont('helvetica', 'bold')
  doc.text('OBSERVACIONES:', 14, y)
  y += 2
  const filasObs = [[examen.registro_obs || ' ']]
  for (let i = 0; i < 6; i++) filasObs.push([' '])
  autoTable(doc, { ...base, startY: y, styles: { ...base.styles, minCellHeight: 7 }, body: filasObs })
  y = doc.lastAutoTable.finalY + 10

  if (y > 230) { doc.addPage(); y = 24 }
  autoTable(doc, {
    ...base, startY: y,
    head: [['NOMBRES Y APELLIDOS - PRESIDENTE DE COMISIÓN', 'NOMBRES Y APELLIDOS – MINISTRO DE FE']],
    headStyles: {
      fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold',
      lineColor: INK, lineWidth: 0.25,
    },
    body: [[comision.presidente || ' ', comision.presidente || ' '], [' ', ' ']],
  })

  return doc
}

export function descargarPDF(doc, nombre) {
  doc.save(nombre)
}
