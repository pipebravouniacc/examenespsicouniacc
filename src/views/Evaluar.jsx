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
        <input type="checkbox" style={{ width: 'auto' }} checked={soloHoy}
          onChange={(e) => setSoloHoy(e.target.checked)} />
        Mostrar solo los de hoy ({fmtFecha(hoy)})
      </label>
      {lista.length === 0 && (
        <div className="vacio">No hay exámenes {soloHoy ? 'agendados para hoy' : 'asignados'}.</div>
      )}
      {lista.length > 0 && (
        <table className="datos">
          <thead>
            <tr><th>Fecha</th><th>Trabajo</th><th>Estudiantes</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td className="mono">
                  {fmtFecha(e.fecha)}<br />
                  <small>{e.hora_inicio?.slice(0, 5)}–{e.hora_fin?.slice(0, 5)}</small>
                </td>
                <td>{e.nombre_trabajo || e.codigo}</td>
                <td>
                  {(e.estudiantes || [])
                    .filter((s) => s.apto_rendir !== false)
                    .map((s) => s.nombre)
                    .join(', ') || <em style={{ color: 'var(--gris)' }}>nadie habilitado</em>}
                  {(e.estudiantes || []).some((s) => s.apto_rendir === false) && (
                    <><br /><span className="chip rojo">
                      no rinde: {(e.estudiantes || []).filter((s) => s.apto_rendir === false).length}
                    </span></>
                  )}
                </td>
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

/* ---------- Escala de puntaje reutilizable ---------- */
const PUNTOS = [1, 2, 3, 4, 5, 6, 7]

function EscalaPuntaje({ valor, onCambio, deshabilitado, etiqueta }) {
  return (
    <div className="escala" role="group" aria-label={etiqueta}>
      {PUNTOS.map((p) => (
        <button
          key={p}
          type="button"
          className={`punto ${valor === p ? 'sel' : ''} ${[1, 3, 5, 7].includes(p) ? 'ancla' : 'inter'}`}
          onClick={() => !deshabilitado && onCambio(p)}
          disabled={deshabilitado}
          title={[1, 3, 5, 7].includes(p) ? `${p} · nivel descrito` : `${p} · puntaje intermedio`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

/* ---------- Bloque de un criterio con todos los estudiantes ---------- */
function BloqueCriterio({ criterio, modo, estudiantes, valores, onCambio, deshabilitado, indice }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="criterio-bloque">
      <div className="criterio-cabecera">
        <div className="criterio-num">{indice}</div>
        <div style={{ flex: 1 }}>
          <div className="indicador">{criterio.indicador}</div>
          <div className="texto">{criterio.criterio}</div>
        </div>
        <button type="button" className="suave mini" onClick={() => setAbierto(!abierto)}>
          {abierto ? 'Ocultar niveles' : 'Ver niveles'}
        </button>
      </div>

      {abierto && (
        <div className="niveles-ref">
          {[7, 5, 3, 1].map((p) => (
            <div className="nivel-ref" key={p}>
              <span className="pts">{p}</span>
              <span>{criterio.niveles[p]}</span>
            </div>
          ))}
          <div className="nota-inter">
            Los puntajes 2, 4 y 6 se usan para desempeños intermedios entre dos niveles.
          </div>
        </div>
      )}

      {modo === 'grupal' ? (
        <div className="fila-puntaje">
          <div className="quien">Puntaje del grupo</div>
          <EscalaPuntaje valor={valores.grupo} deshabilitado={deshabilitado}
            etiqueta={criterio.indicador} onCambio={(v) => onCambio(null, v)} />
        </div>
      ) : (
        estudiantes.map((s, i) => (
          <div className="fila-puntaje" key={s.id}>
            <div className="quien">
              <span className="orden">{i + 1}</span>{s.nombre}
            </div>
            <EscalaPuntaje valor={valores[s.id]} deshabilitado={deshabilitado}
              etiqueta={`${criterio.indicador} · ${s.nombre}`}
              onCambio={(v) => onCambio(s.id, v)} />
          </div>
        ))
      )}
    </div>
  )
}

/* ---------------- Formulario de rúbrica ---------------- */
function FormularioRubrica({ examen, nom, alVolver }) {
  const soloLectura = examen.estado === 'realizado'
  const todos = [...(examen.estudiantes || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0))
  const estudiantes = todos.filter((s) => s.apto_rendir !== false)
  const noHabilitados = todos.filter((s) => s.apto_rendir === false)

  const [grupal, setGrupal] = useState(examen.grupal_puntajes || {})
  const [porEst, setPorEst] = useState(() => {
    const o = {}
    for (const s of todos) o[s.id] = s.puntajes || {}
    return o
  })
  const [retroObs, setRetroObs] = useState(examen.retro_obs || '')
  const [regObs, setRegObs] = useState(examen.registro_obs || '')
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [cerrado, setCerrado] = useState(soloLectura)

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

  const faltantes = useMemo(() => {
    const n =
      CRIT_PRES_GRUPAL.filter((c) => !grupal[c]).length +
      estudiantes.reduce(
        (a, s) => a + [...CRIT_PRES_IND, ...CRIT_DEF].filter((c) => !(porEst[s.id] || {})[c]).length,
        0
      )
    return n
  }, [grupal, porEst, estudiantes])

  const setPuntaje = (critId, estId, val) => {
    if (estId === null) setGrupal((g) => ({ ...g, [critId]: val }))
    else setPorEst((p) => ({ ...p, [estId]: { ...p[estId], [critId]: val } }))
  }

  const valoresDe = (critId, esGrupal) =>
    esGrupal
      ? { grupo: grupal[critId] }
      : Object.fromEntries(estudiantes.map((s) => [s.id, (porEst[s.id] || {})[critId]]))

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

  const props = (crit, esGrupal) => ({
    criterio: crit,
    modo: esGrupal ? 'grupal' : 'individual',
    estudiantes,
    valores: valoresDe(crit.id, esGrupal),
    onCambio: (estId, val) => setPuntaje(crit.id, esGrupal ? null : estId, val),
    deshabilitado: cerrado,
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
          Registra los puntajes <strong>consensuados por la comisión</strong>. Cada criterio va de 1
          a 7; los niveles descritos son 1, 3, 5 y 7, y los pares se usan para desempeños
          intermedios. Ambos momentos se aprueban con nota ≥ {NOTA_APROBACION.toFixed(1)}.
        </div>
        {noHabilitados.length > 0 && (
          <div className="aviso warn">
            <strong>No rinden este examen:</strong>{' '}
            {noHabilitados.map((s) => s.nombre).join(', ')}. No aparecen en la rúbrica ni en el acta
            porque no están habilitados/as para rendir.
          </div>
        )}
        {estudiantes.length > 0 && (
          <div className="lista-estudiantes">
            {estudiantes.map((s, i) => (
              <span key={s.id} className="chip-est"><span className="orden">{i + 1}</span>{s.nombre}</span>
            ))}
          </div>
        )}
      </div>

      {/* ---------- SECCIÓN 1 ---------- */}
      <section className="seccion s1">
        <div className="seccion-cabecera">
          <span className="seccion-num">1</span>
          <div>
            <h2>Presentación · Criterios disciplinares</h2>
            <p>Evaluación <strong>grupal</strong>: un puntaje por criterio para todo el grupo. Subtotal {calc.gSum} / 14</p>
          </div>
        </div>
        {RUBRICA.presentacion.grupal.criterios.map((c, i) => (
          <BloqueCriterio key={c.id} indice={`1.${i + 1}`} {...props(c, true)} />
        ))}
      </section>

      {/* ---------- SECCIÓN 2 ---------- */}
      <section className="seccion s2">
        <div className="seccion-cabecera">
          <span className="seccion-num">2</span>
          <div>
            <h2>Presentación · Criterios transversales</h2>
            <p>Evaluación <strong>individual</strong>: un puntaje por cada estudiante en cada criterio.</p>
          </div>
        </div>
        {RUBRICA.presentacion.individual.criterios.map((c, i) => (
          <BloqueCriterio key={c.id} indice={`2.${i + 1}`} {...props(c, false)} />
        ))}
      </section>

      {/* ---------- SECCIÓN 3 ---------- */}
      <section className="seccion s3">
        <div className="seccion-cabecera">
          <span className="seccion-num">3</span>
          <div>
            <h2>Defensa de grado</h2>
            <p>Evaluación <strong>individual</strong> en los cuatro criterios.</p>
          </div>
        </div>
        <div className="subseccion">Criterios disciplinares</div>
        {RUBRICA.defensa.disciplinares.criterios.map((c, i) => (
          <BloqueCriterio key={c.id} indice={`3.${i + 1}`} {...props(c, false)} />
        ))}
        <div className="subseccion">Criterios transversales</div>
        {RUBRICA.defensa.transversales.criterios.map((c, i) => (
          <BloqueCriterio key={c.id} indice={`3.${i + 3}`} {...props(c, false)} />
        ))}
      </section>

      {/* ---------- RESULTADOS ---------- */}
      <div className="card">
        <div className="eyebrow">Resultados</div>
        <h2>Notas por estudiante</h2>
        {estudiantes.map((s, i) => {
          const c = calc.res[s.id]
          return (
            <div key={s.id} style={{ marginBottom: 16 }}>
              <div className="indicador" style={{ marginBottom: 6 }}>
                <span className="orden">{i + 1}</span>{s.nombre}
              </div>
              <div className="nota-resumen">
                <div className={`nota-caja ${c.nPres >= NOTA_APROBACION ? 'aprueba' : 'reprueba'}`}>
                  <div className="etq">Presentación · {c.presTotal}/28</div>
                  <div className="valor">{fmtNota(c.nPres)}</div>
                </div>
                <div className={`nota-caja ${c.nDef >= NOTA_APROBACION ? 'aprueba' : 'reprueba'}`}>
                  <div className="etq">Defensa · {c.defTotal}/28</div>
                  <div className="valor">{fmtNota(c.nDef)}</div>
                </div>
                <div className={`nota-caja ${c.aprobado ? 'aprueba' : 'reprueba'}`}>
                  <div className="etq">Resultado</div>
                  <div className="valor" style={{ fontSize: 17, paddingTop: 6 }}>
                    {c.aprobado ? 'Aprueba' : 'Reprueba'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="eyebrow">Cierre del examen</div>
        <h2>Retroalimentación y observaciones</h2>
        <p className="sub">
          El PDF de retroalimentación incluye automáticamente las sugerencias de mejora de cada
          criterio que no alcanzó el puntaje máximo. Lo que escribas aquí se suma a eso.
        </p>
        <label className="campo">
          <span>Comentarios de la comisión (PDF de retroalimentación)</span>
          <textarea value={retroObs} onChange={(e) => setRetroObs(e.target.value)} disabled={cerrado}
            placeholder="Fortalezas destacadas y comentarios específicos del grupo…" />
        </label>
        <label className="campo">
          <span>Observaciones para el Registro oficial</span>
          <textarea value={regObs} onChange={(e) => setRegObs(e.target.value)} disabled={cerrado}
            placeholder="Ej.: Comisión evaluadora integrada por… Notas finales… Examen aprobado…" />
        </label>
        {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
        <div className="acciones">
          {!cerrado && estudiantes.length === 0 && (
            <div className="aviso error" style={{ width: '100%' }}>
              Ningún integrante está habilitado para rendir, así que el examen no puede cerrarse.
            </div>
          )}
          {!cerrado && estudiantes.length > 0 && (
            <button className="primario" onClick={guardar} disabled={!completo || guardando}>
              {guardando ? 'Guardando…' : 'Guardar y cerrar examen'}
            </button>
          )}
          {!completo && !cerrado && estudiantes.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--gris)', alignSelf: 'center' }}>
              Faltan {faltantes} puntaje(s) por asignar.
            </span>
          )}
          {cerrado && (
            <>
              <button className="secundario"
                onClick={() => descargarPDF(pdfRetroalimentacion(datosPDF()), `Retroalimentacion_${examen.codigo || 'examen'}.pdf`)}>
                Descargar PDF retroalimentación
              </button>
              <button className="secundario"
                onClick={() => descargarPDF(pdfRegistroObservaciones(datosPDF()), `Registro_Observaciones_${examen.codigo || 'examen'}.pdf`)}>
                Descargar Registro de Observaciones
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
