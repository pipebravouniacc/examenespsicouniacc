import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  RUBRICA, notaDesdePuntaje, NOTA_APROBACION,
  CRIT_PRES_GRUPAL, CRIT_PRES_IND, CRIT_DEF,
} from '../lib/rubrica'
import { fmtFecha, fmtNota, hoyISO } from '../lib/util'
import { pdfRetroalimentacion, pdfRegistroObservaciones, descargarPDF } from '../lib/pdf'

export default function Evaluar({ perfil }) {
  const [examenes, setExamenes] = useState([])
  const [profes, setProfes] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [soloHoy, setSoloHoy] = useState(true)

  const cargar = async () => {
    const [e, p] = await Promise.all([
      supabase
        .from('examenes')
        .select('*, estudiantes(*)')
        .eq('presidente_id', perfil.id)
        .in('estado', ['agendado', 'realizado'])
        .order('fecha'),
      supabase.from('profesores').select('id, nombre'),
    ])
    setExamenes(e.data || [])
    setProfes(p.data || [])
  }
  useEffect(() => { cargar() }, [perfil.id])

  const nom = (id) => profes.find((p) => p.id === id)?.nombre || '—'
  const hoy = hoyISO()
  const lista = examenes.filter((e) => (soloHoy ? e.fecha === hoy : true))

  if (abierto)
    return (
      <FormularioRubrica
        examen={abierto}
        nom={nom}
        alVolver={() => { setAbierto(null); cargar() }}
      />
    )

  return (
    <div className="card">
      <div className="eyebrow">Presidencia de comisión</div>
      <h2>Exámenes a evaluar</h2>
      <p className="sub">
        Aquí aparecen los exámenes agendados donde figuras como presidente/a. Registras los
        puntajes consensuados por la comisión.
      </p>
      <label style={{ fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={soloHoy} onChange={(e) => setSoloHoy(e.target.checked)} />
        Mostrar solo los de hoy ({fmtFecha(hoy)})
      </label>
      {lista.length === 0 && <div className="vacio">No hay exámenes {soloHoy ? 'agendados para hoy' : 'asignados'}.</div>}
      {lista.length > 0 && (
        <table className="datos">
          <thead>
            <tr><th>Fecha</th><th>Trabajo</th><th>Estudiantes</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td className="mono">{fmtFecha(e.fecha)}<br /><small>{e.hora_inicio?.slice(0, 5)}–{e.hora_fin?.slice(0, 5)}</small></td>
                <td>{e.nombre_trabajo || e.codigo}</td>
                <td>{(e.estudiantes || []).map((s) => s.nombre).join(', ')}</td>
                <td><span className={`chip ${e.estado}`}>{e.estado}</span></td>
                <td>
                  <button className="primario mini" onClick={() => setAbierto(e)}>
                    {e.estado === 'realizado' ? 'Ver / PDFs' : 'Evaluar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ---------------- Selector de puntaje 1–7 ---------------- */
function SelectorPuntaje({ criterio, valor, onCambio, deshabilitado }) {
  return (
    <div className="criterio">
      <div className="indicador">{criterio.indicador}</div>
      <div className="texto">{criterio.criterio}</div>
      <div className="niveles">
        {[7, 5, 3, 1].map((p) => (
          <div
            key={p}
            role="button"
            tabIndex={0}
            className={`nivel ${valor === p ? 'sel' : ''}`}
            onClick={() => !deshabilitado && onCambio(p)}
            onKeyDown={(e) => e.key === 'Enter' && !deshabilitado && onCambio(p)}
          >
            <span className="pts">{p} pts <small>{p === 7 ? '· Avanzado' : p === 5 ? '· Competente' : p === 3 ? '· Inicial' : '· Necesita mejora'}</small></span>
            <span>{criterio.niveles[p]}</span>
          </div>
        ))}
      </div>
      <div className="intermedios">
        Puntajes intermedios:
        {[2, 4, 6].map((p) => (
          <button
            key={p}
            type="button"
            className={valor === p ? 'sel' : ''}
            onClick={() => !deshabilitado && onCambio(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Formulario de rúbrica ---------------- */
function FormularioRubrica({ examen, nom, alVolver }) {
  const soloLectura = examen.estado === 'realizado'
  const [grupal, setGrupal] = useState(examen.grupal_puntajes || {})
  const [porEst, setPorEst] = useState(() => {
    const o = {}
    for (const s of examen.estudiantes || []) o[s.id] = s.puntajes || {}
    return o
  })
  const [retroObs, setRetroObs] = useState(examen.retro_obs || '')
  const [regObs, setRegObs] = useState(examen.registro_obs || '')
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [cerrado, setCerrado] = useState(soloLectura)

  const estudiantes = examen.estudiantes || []

  const calc = useMemo(() => {
    const gSum = CRIT_PRES_GRUPAL.reduce((a, c) => a + (grupal[c] || 0), 0)
    const res = {}
    for (const s of estudiantes) {
      const p = porEst[s.id] || {}
      const presInd = CRIT_PRES_IND.reduce((a, c) => a + (p[c] || 0), 0)
      const defTot = CRIT_DEF.reduce((a, c) => a + (p[c] || 0), 0)
      const nPres = notaDesdePuntaje(gSum + presInd)
      const nDef = notaDesdePuntaje(defTot)
      res[s.id] = {
        presTotal: gSum + presInd, defTotal: defTot, nPres, nDef,
        aprobado: nPres >= NOTA_APROBACION && nDef >= NOTA_APROBACION,
      }
    }
    return { gSum, res }
  }, [grupal, porEst, estudiantes])

  const completo = useMemo(() => {
    if (CRIT_PRES_GRUPAL.some((c) => !grupal[c])) return false
    return estudiantes.every((s) => {
      const p = porEst[s.id] || {}
      return [...CRIT_PRES_IND, ...CRIT_DEF].every((c) => p[c])
    })
  }, [grupal, porEst, estudiantes])

  const setP = (estId, crit, val) =>
    setPorEst((prev) => ({ ...prev, [estId]: { ...prev[estId], [crit]: val } }))

  const guardar = async () => {
    setMsg(null)
    setGuardando(true)
    try {
      for (const s of estudiantes) {
        const c = calc.res[s.id]
        const { error } = await supabase
          .from('estudiantes')
          .update({
            puntajes: porEst[s.id],
            nota_presentacion: c.nPres,
            nota_defensa: c.nDef,
            aprobado: c.aprobado,
          })
          .eq('id', s.id)
        if (error) throw error
      }
      const { error } = await supabase
        .from('examenes')
        .update({
          grupal_puntajes: grupal,
          retro_obs: retroObs,
          registro_obs: regObs,
          estado: 'realizado',
          realizado_at: new Date().toISOString(),
        })
        .eq('id', examen.id)
      if (error) throw error
      const reprobados = estudiantes.filter((s) => !calc.res[s.id].aprobado)
      setCerrado(true)
      setMsg({
        t: reprobados.length ? 'warn' : 'ok',
        x: reprobados.length
          ? `Examen cerrado. Atención: reprueban ${reprobados.map((s) => s.nombre).join(', ')}. Coordinación deberá reagendar.`
          : 'Examen cerrado como realizado. Todos/as aprueban.',
      })
    } catch (e) {
      setMsg({ t: 'error', x: e.message })
    }
    setGuardando(false)
  }

  const datosPDF = () => ({
    examen: { ...examen, grupal_puntajes: grupal, retro_obs: retroObs, registro_obs: regObs },
    estudiantes: estudiantes.map((s) => ({
      ...s,
      puntajes: porEst[s.id],
      nota_presentacion: calc.res[s.id].nPres,
      nota_defensa: calc.res[s.id].nDef,
    })),
    comision: {
      presidente: nom(examen.presidente_id),
      guia: nom(examen.guia_id),
      experto: nom(examen.experto_id),
    },
  })

  return (
    <div>
      <button className="suave mini" onClick={alVolver}>← Volver al listado</button>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="eyebrow">Examen de título y grado</div>
        <h2>{examen.nombre_trabajo || examen.codigo}</h2>
        <p className="sub">
          {fmtFecha(examen.fecha)} · {examen.hora_inicio?.slice(0, 5)}–{examen.hora_fin?.slice(0, 5)} ·{' '}
          {examen.modalidad || 'Modalidad por definir'} {examen.sala ? `· Sala ${examen.sala}` : ''}
          <br />
          Comisión: {nom(examen.presidente_id)} (presidente/a) · {nom(examen.guia_id)} (guía) ·{' '}
          {nom(examen.experto_id)} (experto/a)
        </p>
        <div className="aviso info">
          Registra los puntajes <strong>consensuados por la comisión</strong> tras las deliberaciones.
          Ambos momentos se aprueban con nota ≥ {NOTA_APROBACION.toFixed(1)}.
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Momento I · Presentación de la investigación</div>
        <h2>Criterios disciplinares — evaluación grupal</h2>
        <p className="sub">Un solo puntaje por criterio para todo el grupo. Subtotal: {calc.gSum} / 14</p>
        {RUBRICA.presentacion.grupal.criterios.map((c) => (
          <SelectorPuntaje
            key={c.id}
            criterio={c}
            valor={grupal[c.id]}
            deshabilitado={cerrado}
            onCambio={(v) => setGrupal((g) => ({ ...g, [c.id]: v }))}
          />
        ))}
      </div>

      {estudiantes.map((s) => (
        <div className="card" key={s.id}>
          <div className="eyebrow">Evaluación individual</div>
          <h2>{s.nombre}</h2>
          {s.rut && <p className="sub">RUT {s.rut}</p>}

          <h3>Presentación · Criterios transversales</h3>
          {RUBRICA.presentacion.individual.criterios.map((c) => (
            <SelectorPuntaje key={c.id} criterio={c} valor={(porEst[s.id] || {})[c.id]}
              deshabilitado={cerrado} onCambio={(v) => setP(s.id, c.id, v)} />
          ))}

          <h3>Defensa de grado · Criterios disciplinares</h3>
          {RUBRICA.defensa.disciplinares.criterios.map((c) => (
            <SelectorPuntaje key={c.id} criterio={c} valor={(porEst[s.id] || {})[c.id]}
              deshabilitado={cerrado} onCambio={(v) => setP(s.id, c.id, v)} />
          ))}

          <h3>Defensa de grado · Criterios transversales</h3>
          {RUBRICA.defensa.transversales.criterios.map((c) => (
            <SelectorPuntaje key={c.id} criterio={c} valor={(porEst[s.id] || {})[c.id]}
              deshabilitado={cerrado} onCambio={(v) => setP(s.id, c.id, v)} />
          ))}

          <div className="nota-resumen">
            <div className={`nota-caja ${calc.res[s.id].nPres >= NOTA_APROBACION ? 'aprueba' : 'reprueba'}`}>
              <div className="etq">Presentación · {calc.res[s.id].presTotal}/28</div>
              <div className="valor">{fmtNota(calc.res[s.id].nPres)}</div>
            </div>
            <div className={`nota-caja ${calc.res[s.id].nDef >= NOTA_APROBACION ? 'aprueba' : 'reprueba'}`}>
              <div className="etq">Defensa · {calc.res[s.id].defTotal}/28</div>
              <div className="valor">{fmtNota(calc.res[s.id].nDef)}</div>
            </div>
            <div className={`nota-caja ${calc.res[s.id].aprobado ? 'aprueba' : 'reprueba'}`}>
              <div className="etq">Resultado</div>
              <div className="valor" style={{ fontSize: 17, paddingTop: 6 }}>
                {calc.res[s.id].aprobado ? 'Aprueba' : 'Reprueba'}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="eyebrow">Cierre del examen</div>
        <h2>Retroalimentación y observaciones</h2>
        <label className="campo">
          <span>Retroalimentación de la comisión (aparece en el PDF de retroalimentación)</span>
          <textarea value={retroObs} onChange={(e) => setRetroObs(e.target.value)} disabled={cerrado}
            placeholder="Fortalezas, aspectos a mejorar y comentarios de la comisión…" />
        </label>
        <label className="campo">
          <span>Observaciones para el Registro oficial (aparece en el Registro de Observaciones)</span>
          <textarea value={regObs} onChange={(e) => setRegObs(e.target.value)} disabled={cerrado}
            placeholder="Ej.: Comisión evaluadora integrada por… Notas finales: Presentación X.X – Defensa X.X. Examen aprobado…" />
        </label>
        {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
        <div className="acciones">
          {!cerrado && (
            <button className="primario" onClick={guardar} disabled={!completo || guardando}>
              {guardando ? 'Guardando…' : 'Guardar y cerrar examen'}
            </button>
          )}
          {!completo && !cerrado && (
            <span style={{ fontSize: 13, color: 'var(--gris)', alignSelf: 'center' }}>
              Faltan criterios por puntuar.
            </span>
          )}
          {cerrado && (
            <>
              <button className="secundario" onClick={() => descargarPDF(pdfRetroalimentacion(datosPDF()), `Retroalimentacion_${examen.codigo || 'examen'}.pdf`)}>
                Descargar PDF retroalimentación
              </button>
              <button className="secundario" onClick={() => descargarPDF(pdfRegistroObservaciones(datosPDF()), `Registro_Observaciones_${examen.codigo || 'examen'}.pdf`)}>
                Descargar Registro de Observaciones
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
