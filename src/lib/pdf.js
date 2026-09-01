import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { RUBRICA, NIVELES, notaDesdePuntaje, NOTA_APROBACION } from './rubrica'
import { fmtFecha, fmtNota } from './util'

const INK = [23, 23, 26]
const MAGENTA = [229, 23, 123]
const STEEL = [61, 127, 166]
const GRIS = [120, 120, 124]

function encabezado(doc, subtitulo) {
  const w = doc.internal.pageSize.getWidth()
  // barra de color institucional
  const seg = (w - 28) / 4
  const colores = [[255, 205, 0], [0, 174, 199], [229, 23, 123], [214, 40, 40]]
  colores.forEach((c, i) => {
    doc.setFillColor(...c)
    doc.rect(14 + i * seg, 12, seg, 1.6, 'F')
  })
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('UNIVERSIDAD UNIACC', 14, 22)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  doc.text('Facultad de Psicología · Escuela de Psicología', 14, 27)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text(subtitulo, w / 2, 36, { align: 'center' })
  return 42
}

const nombreNivel = (p) => {
  const n = NIVELES.find((x) => x.puntos === p)
  if (n) return n.nombre
  if (p === 6) return 'Competente–Avanzado'
  if (p === 4) return 'Inicial–Competente'
  if (p === 2) return 'Necesita mejora–Inicial'
  return ''
}

// ---------------------------------------------------------------
// PDF 1 · Retroalimentación estándar del examen
// ---------------------------------------------------------------
export function pdfRetroalimentacion({ examen, estudiantes: todos, comision }) {
  // Solo se documenta a quienes rindieron (habilitados para rendir)
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
  const gSum = (gp.p_fund || 0) + (gp.p_coh || 0)

  // Componente grupal
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
  y = doc.lastAutoTable.finalY + 6

  // Por estudiante
  for (const est of estudiantes) {
    const p = est.puntajes || {}
    const presInd = (p.p_leng || 0) + (p.p_clar || 0)
    const presTotal = gSum + presInd
    const defTotal = (p.d_refl || 0) + (p.d_proy || 0) + (p.d_dial || 0) + (p.d_form || 0)
    const nPres = est.nota_presentacion ?? notaDesdePuntaje(presTotal)
    const nDef = est.nota_defensa ?? notaDesdePuntaje(defTotal)
    const aprob = nPres >= NOTA_APROBACION && nDef >= NOTA_APROBACION

    if (y > 200) { doc.addPage(); y = 20 }
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
    y = doc.lastAutoTable.finalY + 6
  }

  if (examen.retro_obs) {
    if (y > 220) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text('Retroalimentación de la comisión', 14, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lineas = doc.splitTextToSize(examen.retro_obs, 185)
    doc.text(lineas, 14, y)
    y += lineas.length * 4 + 4
  }

  doc.setFontSize(7.5)
  doc.setTextColor(...GRIS)
  doc.text(
    'Ambos momentos deben aprobarse con nota igual o superior a 4.0. Conversión según tabla oficial (28 puntos = 7.0).',
    14, doc.internal.pageSize.getHeight() - 12
  )
  return doc
}

// ---------------------------------------------------------------
// PDF 2 · Registro de Observaciones (formato institucional)
// ---------------------------------------------------------------
export function pdfRegistroObservaciones({ examen, estudiantes: todos, comision }) {
  const estudiantes = (todos || []).filter((s) => s.apto_rendir !== false)
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const w = doc.internal.pageSize.getWidth()
  let y = encabezado(doc, 'REGISTRO DE OBSERVACIONES EXAMEN DE TÍTULO Y/O GRADO')
  y += 2

  const base = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 2.2, lineColor: INK, lineWidth: 0.25 },
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

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('NOMBRE DEL TRABAJO:', 14, y)
  y += 2
  autoTable(doc, { ...base, startY: y, body: [[examen.nombre_trabajo || ' '], [' ']] })
  y = doc.lastAutoTable.finalY + 6

  doc.setFont('helvetica', 'bold')
  doc.text('OBSERVACIONES:', 14, y)
  y += 2
  const obs = examen.registro_obs || ' '
  const filasObs = [[obs]]
  for (let i = 0; i < 6; i++) filasObs.push([' '])
  autoTable(doc, { ...base, startY: y, styles: { ...base.styles, minCellHeight: 7 }, body: filasObs })
  y = doc.lastAutoTable.finalY + 10

  if (y > 230) { doc.addPage(); y = 24 }
  autoTable(doc, {
    ...base, startY: y,
    head: [['NOMBRES Y APELLIDOS - PRESIDENTE DE COMISIÓN', 'NOMBRES Y APELLIDOS – MINISTRO DE FE']],
    headStyles: { fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold', lineColor: INK, lineWidth: 0.25 },
    body: [[comision.presidente || ' ', comision.presidente || ' '], [' ', ' ']],
  })

  doc.setFontSize(7.5)
  doc.setTextColor(...GRIS)
  doc.setFont('helvetica', 'normal')
  doc.text('BIENVENIDOS A CREAR', 14, doc.internal.pageSize.getHeight() - 10)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, w - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' })
  return doc
}

export function descargarPDF(doc, nombre) {
  doc.save(nombre)
}
