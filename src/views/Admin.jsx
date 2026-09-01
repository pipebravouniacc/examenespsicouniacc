import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parsearCSV, exportarCSV, descargarArchivo } from '../lib/csv'
import { proponer } from '../lib/scheduler'
import { matchProfesor, fmtFecha, fmtFechaLarga, fmtNota, nombreCorto } from '../lib/util'
import { pdfRetroalimentacion, pdfRegistroObservaciones, descargarPDF } from '../lib/pdf'
import { Disponibilidad } from './Docente'

export default function Admin({ perfil }) {
  const [tab, setTab] = useState('panel')
  const [datos, setDatos] = useState({
    profesores: [], ventanas: [], disponibilidades: [], examenes: [], especialidades: [],
  })

  const cargar = async () => {
    const [p, v, d, e, s] = await Promise.all([
      supabase.from('profesores').select('*').order('nombre'),
      supabase.from('ventanas').select('*').order('fecha'),
      supabase.from('disponibilidades').select('*'),
      supabase.from('examenes').select('*, estudiantes(*)').order('created_at'),
      supabase.from('especialidades').select('*').order('nombre'),
    ])
    setDatos({
      profesores: p.data || [], ventanas: v.data || [], disponibilidades: d.data || [],
      examenes: e.data || [], especialidades: s.data || [],
    })
  }
  useEffect(() => { cargar() }, [])

  const byId = useMemo(
    () => Object.fromEntries(datos.profesores.map((p) => [p.id, p])),
    [datos.profesores]
  )
  const nom = (id) => nombreCorto(byId[id])

  const pendHab = datos.profesores.filter((p) => p.tipo === 'planta' && !p.habilitado).length
  const nPropuestos = datos.examenes.filter((e) => e.estado === 'propuesto').length
  const reprobadosSinReagendar = datos.examenes.filter(
    (e) => e.estado === 'realizado' &&
      (e.estudiantes || []).some((s) => s.aprobado === false) &&
      !datos.examenes.some((x) => x.examen_padre === e.id)
  )

  const props = { datos, cargar, byId, nom, perfil }

  return (
    <div>
      <nav className="tabs">
        {[
          ['panel', 'Panel'],
          ['tesis', 'Tesis'],
          ['propuestas', `Propuestas`, nPropuestos],
          ['docentes', 'Docentes', pendHab],
          ['fechas', 'Fechas de examen'],
          ['historial', 'Historial', reprobadosSinReagendar.length],
        ].map(([id, txt, badge]) => (
          <button key={id} className={tab === id ? 'activa' : ''} onClick={() => setTab(id)}>
            {txt}{badge > 0 && <span className="badge">{badge}</span>}
          </button>
        ))}
      </nav>
      {tab === 'panel' && <Panel {...props} reprobados={reprobadosSinReagendar} irA={setTab} />}
      {tab === 'tesis' && <Tesis {...props} />}
      {tab === 'propuestas' && <Propuestas {...props} />}
      {tab === 'docentes' && <Docentes {...props} />}
      {tab === 'fechas' && <Fechas {...props} />}
      {tab === 'historial' && <Historial {...props} />}
    </div>
  )
}

/* ================= PANEL ================= */
function Panel({ datos, reprobados, irA, nom }) {
  const c = (est) => datos.examenes.filter((e) => e.estado === est).length
  const sinGuia = datos.examenes.filter((e) => !e.guia_id && e.estado !== 'realizado').length
  return (
    <div>
      {reprobados.length > 0 && (
        <div className="aviso warn">
          <strong>Alerta:</strong> hay {reprobados.length} examen(es) con estudiantes reprobados
          pendientes de reagendar. Revísalos en <a href="#" onClick={(e) => { e.preventDefault(); irA('historial') }}>Historial</a>.
        </div>
      )}
      {sinGuia > 0 && (
        <div className="aviso info">
          {sinGuia} tesis tienen un profesor guía no vinculado a un docente registrado. Resuélvelo
          en la pestaña Tesis para poder agendarlas.
        </div>
      )}
      <div className="card">
        <div className="eyebrow">Estado general</div>
        <h2>Ciclo de exámenes</h2>
        <table className="datos">
          <tbody>
            <tr><td>Pendientes de agendar</td><td className="mono">{c('pendiente')}</td></tr>
            <tr><td>Con propuesta por revisar</td><td className="mono">{c('propuesto')}</td></tr>
            <tr><td>Agendados</td><td className="mono">{c('agendado')}</td></tr>
            <tr><td>Realizados</td><td className="mono">{c('realizado')}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="eyebrow">Próximos exámenes</div>
        <h2>Agendados</h2>
        {datos.examenes.filter((e) => e.estado === 'agendado').length === 0 && (
          <div className="vacio">No hay exámenes agendados.</div>
        )}
        {datos.examenes.filter((e) => e.estado === 'agendado').map((e) => (
          <div key={e.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0', fontSize: 13.5 }}>
            <strong>{fmtFecha(e.fecha)} {e.hora_inicio?.slice(0, 5)}</strong> · {e.nombre_trabajo || e.codigo}
            <br />
            <small style={{ color: 'var(--gris)' }}>
              Presidente/a {nom(e.presidente_id)} · Guía {nom(e.guia_id)} · Experto/a {nom(e.experto_id)}
              {e.sala ? ` · Sala ${e.sala}` : ''}
            </small>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================= TESIS ================= */
function Tesis({ datos, cargar, nom }) {
  const [msg, setMsg] = useState(null)
  const [importando, setImportando] = useState(false)

  const importar = async (file) => {
    setMsg(null)
    setImportando(true)
    try {
      const texto = await file.text()
      const { filas, advertencias } = parsearCSV(texto)
      if (!filas.length) throw new Error('No se encontraron filas válidas en el archivo.')
      const existentes = new Set(datos.examenes.map((e) => (e.codigo || '').trim()).filter(Boolean))
      let nuevos = 0, omitidos = 0
      for (const f of filas) {
        if (f.codigo && existentes.has(f.codigo)) { omitidos++; continue }
        const guia = matchProfesor(f.guia_texto, datos.profesores)
        const { data: ex, error } = await supabase
          .from('examenes')
          .insert({
            codigo: f.codigo || null,
            nombre_trabajo: f.nombre_trabajo || null,
            area: f.area || null,
            guia_texto: f.guia_texto || null,
            guia_id: guia ? guia.id : null,
            modalidad: f.modalidad || null,
          })
          .select()
          .single()
        if (error) throw error
        if (f.estudiantes.length) {
          const { error: e2 } = await supabase.from('estudiantes').insert(
            f.estudiantes.map((s, i) => ({
              examen_id: ex.id, nombre: s.nombre, rut: s.rut || null, orden: i + 1,
            }))
          )
          if (e2) throw e2
        }
        nuevos++
      }
      setMsg({
        t: 'ok',
        x: `Importación lista: ${nuevos} tesis nuevas${omitidos ? `, ${omitidos} omitidas por ID ya existente` : ''}.` +
          (advertencias.length ? ' Advertencias: ' + advertencias.join(' ') : ''),
      })
      cargar()
    } catch (e) {
      setMsg({ t: 'error', x: e.message })
    }
    setImportando(false)
  }

  const vincularGuia = async (examenId, profId) => {
    await supabase.from('examenes').update({ guia_id: profId || null }).eq('id', examenId)
    cargar()
  }

  const exportar = () => {
    const porExamen = Object.fromEntries(datos.examenes.map((e) => [e.id, e.estudiantes || []]))
    const byId = Object.fromEntries(datos.profesores.map((p) => [p.id, p]))
    descargarArchivo('Planificacion_examenes_actualizada.csv', exportarCSV(datos.examenes, porExamen, byId))
  }

  const eliminar = async (e) => {
    if (!window.confirm(`¿Eliminar la tesis "${e.nombre_trabajo || e.codigo}" y sus estudiantes?`)) return
    await supabase.from('examenes').delete().eq('id', e.id)
    cargar()
  }

  const activos = datos.examenes.filter((e) => e.estado !== 'realizado')

  return (
    <div>
      <div className="card">
        <div className="eyebrow">Origen de datos</div>
        <h2>Importar tesis desde el Microsoft List</h2>
        <p className="sub">
          Exporta el List a CSV desde SharePoint y súbelo aquí. Columnas reconocidas: ID Examen,
          Nombre del trabajo, Área, Docente guía, Estudiante 1–4 con RUT 1–4 (o la columna
          Integrantes del List original), Modalidad. Las tesis con un ID ya importado se omiten.
        </p>
        <div className="acciones">
          <label className="secundario" style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 7, border: '1px solid var(--ink)', cursor: 'pointer', fontFamily: 'Archivo', fontWeight: 600, fontSize: 13.5 }}>
            {importando ? 'Importando…' : 'Elegir archivo CSV'}
            <input type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => e.target.files[0] && importar(e.target.files[0])} />
          </label>
          <button className="suave" onClick={exportar}>Exportar CSV (formato del List)</button>
        </div>
        {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      </div>

      <div className="card">
        <div className="eyebrow">Tesis en ciclo</div>
        <h2>Tesis activas</h2>
        {activos.length === 0 && <div className="vacio">No hay tesis activas. Importa el CSV del List para comenzar.</div>}
        {activos.length > 0 && (
          <table className="datos">
            <thead>
              <tr><th>ID</th><th>Trabajo / estudiantes</th><th>Área</th><th>Guía</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {activos.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.codigo || '—'}{e.intento > 1 && <><br /><span className="chip gris">intento {e.intento}</span></>}</td>
                  <td>
                    {e.nombre_trabajo || <em style={{ color: 'var(--gris)' }}>Sin título</em>}
                    <br />
                    <small style={{ color: 'var(--gris)' }}>
                      {(e.estudiantes || []).map((s) => s.nombre).join(' · ') || 'Sin estudiantes'}
                    </small>
                  </td>
                  <td>{e.area || '—'}</td>
                  <td>
                    {e.guia_id ? (
                      nom(e.guia_id)
                    ) : (
                      <div>
                        <span className="chip rojo">No vinculado</span>
                        <div style={{ fontSize: 12, color: 'var(--gris)' }}>“{e.guia_texto || '—'}”</div>
                        <select style={{ marginTop: 4, fontSize: 12.5 }} defaultValue=""
                          onChange={(ev) => ev.target.value && vincularGuia(e.id, ev.target.value)}>
                          <option value="">Vincular con…</option>
                          {datos.profesores.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td><span className={`chip ${e.estado}`}>{e.estado}</span></td>
                  <td><button className="peligro mini" onClick={() => eliminar(e)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ================= PROPUESTAS ================= */
function Propuestas({ datos, cargar, nom }) {
  const [msg, setMsg] = useState(null)
  const [generando, setGenerando] = useState(false)

  const ocupaciones = () =>
    datos.examenes
      .filter((e) => e.estado === 'agendado' && e.fecha)
      .map((e) => ({
        fecha: e.fecha, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin,
        guia_id: e.guia_id, presidente_id: e.presidente_id, experto_id: e.experto_id,
      }))

  const generarTodas = async () => {
    setMsg(null)
    setGenerando(true)
    const ctx = {
      ventanas: datos.ventanas,
      disponibilidades: datos.disponibilidades,
      profesores: datos.profesores,
      ocupaciones: ocupaciones(),
    }
    const pendientes = datos.examenes.filter((e) => e.estado === 'pendiente')
    let ok = 0
    const sinProp = []
    for (const ex of pendientes) {
      const r = proponer(ex, ctx, ex.descartes || [])
      if (r.ok) {
        await supabase.from('examenes').update({ propuesta: r.propuesta, estado: 'propuesto' }).eq('id', ex.id)
        ctx.ocupaciones.push({ ...r.propuesta, guia_id: ex.guia_id })
        ok++
      } else {
        sinProp.push(`${ex.codigo || ex.nombre_trabajo || 'tesis'}: ${r.motivo}`)
      }
    }
    setMsg({
      t: sinProp.length ? 'warn' : 'ok',
      x: `${ok} propuesta(s) generada(s).` + (sinProp.length ? ' Sin propuesta → ' + sinProp.join(' | ') : ''),
    })
    setGenerando(false)
    cargar()
  }

  const nuevaPropuesta = async (ex) => {
    const descartes = [...(ex.descartes || []), ex.propuesta].filter(Boolean)
    const ctx = {
      ventanas: datos.ventanas, disponibilidades: datos.disponibilidades,
      profesores: datos.profesores, ocupaciones: ocupaciones(),
    }
    const r = proponer(ex, ctx, descartes)
    if (r.ok) {
      await supabase.from('examenes').update({ propuesta: r.propuesta, descartes }).eq('id', ex.id)
      setMsg(null)
    } else {
      setMsg({ t: 'warn', x: `No hay otra combinación distinta disponible: ${r.motivo}` })
    }
    cargar()
  }

  const dejarPendiente = async (ex) => {
    await supabase.from('examenes').update({ estado: 'pendiente', propuesta: null }).eq('id', ex.id)
    cargar()
  }

  const propuestos = datos.examenes.filter((e) => e.estado === 'propuesto')
  const pendientes = datos.examenes.filter((e) => e.estado === 'pendiente')

  return (
    <div>
      <div className="card">
        <div className="eyebrow">Modo propuesta de agendamiento</div>
        <h2>Generar propuestas</h2>
        <p className="sub">
          El sistema busca, para cada tesis pendiente, un bloque de 90 minutos con el profesor guía
          disponible y arma la comisión según la cadena de prioridades (presidente siempre planta;
          experto: planta con especialidad → hora con especialidad → planta sin especialidad).
        </p>
        <button className="primario" onClick={generarTodas} disabled={generando || pendientes.length === 0}>
          {generando ? 'Generando…' : `Generar propuestas (${pendientes.length} pendientes)`}
        </button>
        {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      </div>

      {propuestos.map((ex) => (
        <TarjetaPropuesta key={ex.id} ex={ex} nom={nom} datos={datos} cargar={cargar}
          onNueva={() => nuevaPropuesta(ex)} onPendiente={() => dejarPendiente(ex)} />
      ))}
      {propuestos.length === 0 && (
        <div className="card"><div className="vacio">No hay propuestas por revisar.</div></div>
      )}
    </div>
  )
}

function TarjetaPropuesta({ ex, nom, datos, cargar, onNueva, onPendiente }) {
  const p = ex.propuesta || {}
  const [sala, setSala] = useState(ex.sala || '')
  const [modalidad, setModalidad] = useState(ex.modalidad || 'Presencial')
  const [link, setLink] = useState(ex.link_reunion || '')
  const [manual, setManual] = useState(false)
  const [m, setM] = useState({
    fecha: p.fecha || '', hora_inicio: p.hora_inicio || '09:00', hora_fin: p.hora_fin || '10:30',
    presidente_id: p.presidente_id || '', experto_id: p.experto_id || '',
  })

  const confirmar = async (valores) => {
    await supabase.from('examenes').update({
      fecha: valores.fecha,
      hora_inicio: valores.hora_inicio,
      hora_fin: valores.hora_fin,
      presidente_id: valores.presidente_id,
      experto_id: valores.experto_id,
      sala: sala || null,
      modalidad,
      link_reunion: link || null,
      estado: 'agendado',
      propuesta: null,
    }).eq('id', ex.id)
    cargar()
  }

  const plantas = datos.profesores.filter((x) => x.tipo === 'planta' && x.habilitado)

  return (
    <div className="card">
      <div className="eyebrow">Propuesta</div>
      <h2>{ex.nombre_trabajo || ex.codigo}</h2>
      <p className="sub">
        {(ex.estudiantes || []).map((s) => s.nombre).join(' · ')} · Área: {ex.area || '—'} · Guía: {nom(ex.guia_id)}
      </p>
      {!manual ? (
        <div className="aviso info">
          <strong>{fmtFechaLarga(p.fecha)}</strong>, {p.hora_inicio}–{p.hora_fin}
          <br />Presidente/a: <strong>{nom(p.presidente_id)}</strong> · Docente experto/a: <strong>{nom(p.experto_id)}</strong> · Guía: {nom(ex.guia_id)}
        </div>
      ) : (
        <div className="fila" style={{ marginBottom: 10 }}>
          <label className="campo"><span>Fecha</span>
            <input type="date" value={m.fecha} onChange={(e) => setM({ ...m, fecha: e.target.value })} /></label>
          <label className="campo"><span>Inicio</span>
            <input type="time" value={m.hora_inicio} onChange={(e) => setM({ ...m, hora_inicio: e.target.value })} /></label>
          <label className="campo"><span>Término</span>
            <input type="time" value={m.hora_fin} onChange={(e) => setM({ ...m, hora_fin: e.target.value })} /></label>
          <label className="campo"><span>Presidente/a (planta)</span>
            <select value={m.presidente_id} onChange={(e) => setM({ ...m, presidente_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {plantas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select></label>
          <label className="campo"><span>Docente experto/a</span>
            <select value={m.experto_id} onChange={(e) => setM({ ...m, experto_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {datos.profesores.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.tipo})</option>)}
            </select></label>
        </div>
      )}
      <div className="fila">
        <label className="campo"><span>Modalidad</span>
          <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
            <option>Presencial</option><option>Online</option>
          </select></label>
        <label className="campo"><span>Sala</span>
          <input value={sala} onChange={(e) => setSala(e.target.value)} placeholder="Ej. CPI101" /></label>
        <label className="campo"><span>Link reunión (si es online)</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} /></label>
      </div>
      <div className="acciones">
        {!manual ? (
          <>
            <button className="primario" onClick={() => confirmar(p)}>Confirmar agendamiento</button>
            <button className="secundario" onClick={onNueva}>Sugerir nueva propuesta</button>
            <button className="suave" onClick={() => setManual(true)}>Agendar manual</button>
            <button className="suave" onClick={onPendiente}>Dejar pendiente</button>
          </>
        ) : (
          <>
            <button className="primario" disabled={!m.fecha || !m.presidente_id || !m.experto_id}
              onClick={() => confirmar(m)}>Confirmar manual</button>
            <button className="suave" onClick={() => setManual(false)}>Volver a la propuesta</button>
          </>
        )}
      </div>
    </div>
  )
}

/* ================= DOCENTES ================= */
function Docentes({ datos, cargar, perfil }) {
  const [msg, setMsg] = useState(null)
  const [nuevoHora, setNuevoHora] = useState({ nombre: '', correo_ms: '', correo_gmail: '', especialidades: [] })
  const [dispDe, setDispDe] = useState(null)
  const [nuevaEsp, setNuevaEsp] = useState('')

  const setHab = async (p, val) => {
    const { error } = await supabase.from('profesores').update({ habilitado: val }).eq('id', p.id)
    if (error) setMsg({ t: 'error', x: error.message })
    cargar()
  }

  const crearHora = async () => {
    setMsg(null)
    const { error } = await supabase.from('profesores').insert({
      nombre: nuevoHora.nombre.trim(),
      correo_ms: nuevoHora.correo_ms.trim() || null,
      correo_gmail: nuevoHora.correo_gmail.trim() || null,
      tipo: 'hora',
      habilitado: true,
      especialidades: nuevoHora.especialidades,
    })
    if (error) setMsg({ t: 'error', x: error.message })
    else {
      setNuevoHora({ nombre: '', correo_ms: '', correo_gmail: '', especialidades: [] })
      setMsg({ t: 'ok', x: 'Profesor/a hora agregado/a. Ahora carga su disponibilidad con el botón Horarios.' })
    }
    cargar()
  }

  const toggleEspProf = async (p, nombre) => {
    const nuevas = p.especialidades.includes(nombre)
      ? p.especialidades.filter((x) => x !== nombre)
      : [...p.especialidades, nombre]
    await supabase.from('profesores').update({ especialidades: nuevas }).eq('id', p.id)
    cargar()
  }

  const agregarEsp = async () => {
    if (!nuevaEsp.trim()) return
    await supabase.from('especialidades').insert({ nombre: nuevaEsp.trim() })
    setNuevaEsp('')
    cargar()
  }

  if (dispDe)
    return (
      <div>
        <button className="suave mini" onClick={() => setDispDe(null)}>← Volver a docentes</button>
        <div style={{ marginTop: 12 }}>
          <Disponibilidad profesorId={dispDe.id} titulo={`Disponibilidad de ${dispDe.nombre}`} />
        </div>
      </div>
    )

  const plantas = datos.profesores.filter((p) => p.tipo === 'planta')
  const horas = datos.profesores.filter((p) => p.tipo === 'hora')

  return (
    <div>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      <div className="card">
        <div className="eyebrow">Cuentas registradas</div>
        <h2>Docentes planta</h2>
        <table className="datos">
          <thead><tr><th>Nombre</th><th>Correos</th><th>Especialidades</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {plantas.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}{p.es_admin && <span className="chip agendado" style={{ marginLeft: 6 }}>admin</span>}</td>
                <td style={{ fontSize: 12.5 }}>{p.correo_ms}<br />{p.correo_gmail}</td>
                <td style={{ fontSize: 12.5 }}>{(p.especialidades || []).join(', ') || '—'}</td>
                <td>{p.habilitado ? <span className="chip verde">Habilitado</span> : <span className="chip pendiente">Pendiente</span>}</td>
                <td>
                  <div className="acciones" style={{ marginTop: 0 }}>
                    {p.id !== perfil.id && (
                      <button className={p.habilitado ? 'suave mini' : 'primario mini'} onClick={() => setHab(p, !p.habilitado)}>
                        {p.habilitado ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                    )}
                    <button className="secundario mini" onClick={() => setDispDe(p)}>Horarios</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="eyebrow">Sin cuenta en la plataforma</div>
        <h2>Profesores hora / externos</h2>
        <p className="sub">Tú registras sus datos, especialidades y horarios. Pueden actuar como docente experto o guía.</p>
        {horas.length > 0 && (
          <table className="datos">
            <thead><tr><th>Nombre</th><th>Especialidades</th><th></th></tr></thead>
            <tbody>
              {horas.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>
                    <div className="check-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                      {datos.especialidades.map((e) => (
                        <label key={e.id} style={{ fontSize: 12 }}>
                          <input type="checkbox" checked={(p.especialidades || []).includes(e.nombre)}
                            onChange={() => toggleEspProf(p, e.nombre)} />
                          {e.nombre}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td><button className="secundario mini" onClick={() => setDispDe(p)}>Horarios</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <hr className="sep" />
        <h3>Agregar profesor/a hora</h3>
        <div className="fila">
          <label className="campo"><span>Nombre completo</span>
            <input value={nuevoHora.nombre} onChange={(e) => setNuevoHora({ ...nuevoHora, nombre: e.target.value })} /></label>
          <label className="campo"><span>Correo Microsoft (opcional)</span>
            <input value={nuevoHora.correo_ms} onChange={(e) => setNuevoHora({ ...nuevoHora, correo_ms: e.target.value })} /></label>
          <label className="campo"><span>Correo Gmail (opcional)</span>
            <input value={nuevoHora.correo_gmail} onChange={(e) => setNuevoHora({ ...nuevoHora, correo_gmail: e.target.value })} /></label>
        </div>
        <button className="primario" onClick={crearHora} disabled={!nuevoHora.nombre.trim()}>Agregar</button>
      </div>

      <div className="card">
        <div className="eyebrow">Catálogo</div>
        <h2>Áreas de especialidad</h2>
        <p className="sub">Estas áreas aparecen como checkboxes para docentes y deben coincidir con el campo Área del List.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {datos.especialidades.map((e) => <span key={e.id} className="chip gris">{e.nombre}</span>)}
        </div>
        <div className="fila" style={{ maxWidth: 480 }}>
          <input value={nuevaEsp} onChange={(e) => setNuevaEsp(e.target.value)} placeholder="Nueva área…" />
          <button className="secundario" onClick={agregarEsp}>Agregar área</button>
        </div>
      </div>
    </div>
  )
}

/* ================= FECHAS ================= */
function Fechas({ datos, cargar }) {
  const [f, setF] = useState({ fecha: '', hora_inicio: '09:00', hora_fin: '18:00' })
  const [msg, setMsg] = useState(null)

  const agregar = async () => {
    setMsg(null)
    const { error } = await supabase.from('ventanas').insert(f)
    if (error) setMsg({ t: 'error', x: /duplicate/i.test(error.message) ? 'Esa fecha ya está habilitada.' : error.message })
    else setF({ ...f, fecha: '' })
    cargar()
  }
  const quitar = async (id) => {
    await supabase.from('ventanas').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="card">
      <div className="eyebrow">Calendario del ciclo</div>
      <h2>Fechas habilitadas para exámenes</h2>
      <p className="sub">Los docentes solo pueden declarar disponibilidad dentro de estas fechas y horarios.</p>
      <div className="fila" style={{ maxWidth: 620 }}>
        <label className="campo"><span>Fecha</span>
          <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
        <label className="campo"><span>Desde</span>
          <input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></label>
        <label className="campo"><span>Hasta</span>
          <input type="time" value={f.hora_fin} onChange={(e) => setF({ ...f, hora_fin: e.target.value })} /></label>
      </div>
      <button className="primario" onClick={agregar} disabled={!f.fecha}>Habilitar fecha</button>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      <hr className="sep" />
      {datos.ventanas.length === 0 && <div className="vacio">Sin fechas habilitadas.</div>}
      {datos.ventanas.map((v) => (
        <div key={v.id} className="franja" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          <span style={{ textTransform: 'capitalize' }}>
            <strong>{fmtFechaLarga(v.fecha)}</strong> · {v.hora_inicio?.slice(0, 5)}–{v.hora_fin?.slice(0, 5)}
          </span>
          <button className="peligro mini" onClick={() => quitar(v.id)}>Quitar</button>
        </div>
      ))}
    </div>
  )
}

/* ================= HISTORIAL ================= */
function Historial({ datos, cargar, nom, byId }) {
  const realizados = datos.examenes.filter((e) => e.estado === 'realizado')
  const [msg, setMsg] = useState(null)

  const yaReagendado = (e) => datos.examenes.some((x) => x.examen_padre === e.id)

  const reagendar = async (ex) => {
    setMsg(null)
    const reprobados = (ex.estudiantes || []).filter((s) => s.aprobado === false)
    if (!reprobados.length) return
    try {
      const { data: nuevo, error } = await supabase
        .from('examenes')
        .insert({
          codigo: ex.codigo ? `${ex.codigo}-R${ex.intento + 1}` : null,
          nombre_trabajo: ex.nombre_trabajo,
          area: ex.area,
          guia_texto: ex.guia_texto,
          guia_id: ex.guia_id,
          modalidad: ex.modalidad,
          intento: ex.intento + 1,
          examen_padre: ex.id,
        })
        .select()
        .single()
      if (error) throw error
      const { error: e2 } = await supabase.from('estudiantes').insert(
        reprobados.map((s, i) => ({ examen_id: nuevo.id, nombre: s.nombre, rut: s.rut, orden: i + 1 }))
      )
      if (e2) throw e2
      setMsg({ t: 'ok', x: `Nuevo examen creado (${nuevo.codigo || 'sin ID'}) con ${reprobados.length} estudiante(s). Está en Pendientes para la próxima ronda de propuestas.` })
      cargar()
    } catch (e) {
      setMsg({ t: 'error', x: e.message })
    }
  }

  const datosPDF = (ex) => ({
    examen: ex,
    estudiantes: ex.estudiantes || [],
    comision: { presidente: nom(ex.presidente_id), guia: nom(ex.guia_id), experto: nom(ex.experto_id) },
  })

  return (
    <div className="card">
      <div className="eyebrow">Post examen</div>
      <h2>Exámenes realizados</h2>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      {realizados.length === 0 && <div className="vacio">Aún no hay exámenes realizados.</div>}
      {realizados.map((ex) => {
        const reprobados = (ex.estudiantes || []).filter((s) => s.aprobado === false)
        return (
          <div key={ex.id} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
            <strong>{ex.nombre_trabajo || ex.codigo}</strong>{' '}
            <span className="chip realizado">realizado</span>
            {ex.intento > 1 && <span className="chip gris" style={{ marginLeft: 6 }}>intento {ex.intento}</span>}
            <div style={{ fontSize: 13, color: 'var(--gris)', margin: '3px 0 6px' }}>
              {fmtFecha(ex.fecha)} · Presidente/a {nom(ex.presidente_id)} · Guía {nom(ex.guia_id)} · Experto/a {nom(ex.experto_id)}
            </div>
            <table className="datos" style={{ maxWidth: 640 }}>
              <thead><tr><th>Estudiante</th><th>Presentación</th><th>Defensa</th><th>Resultado</th></tr></thead>
              <tbody>
                {(ex.estudiantes || []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td className="mono">{fmtNota(s.nota_presentacion)}</td>
                    <td className="mono">{fmtNota(s.nota_defensa)}</td>
                    <td>{s.aprobado ? <span className="chip verde">Aprueba</span> : <span className="chip rojo">Reprueba</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="acciones">
              <button className="secundario mini"
                onClick={() => descargarPDF(pdfRetroalimentacion(datosPDF(ex)), `Retroalimentacion_${ex.codigo || 'examen'}.pdf`)}>
                PDF retroalimentación
              </button>
              <button className="secundario mini"
                onClick={() => descargarPDF(pdfRegistroObservaciones(datosPDF(ex)), `Registro_Observaciones_${ex.codigo || 'examen'}.pdf`)}>
                PDF registro de observaciones
              </button>
              {reprobados.length > 0 && !yaReagendado(ex) && (
                <button className="primario mini" onClick={() => reagendar(ex)}>
                  Reagendar reprobados ({reprobados.length})
                </button>
              )}
              {reprobados.length > 0 && yaReagendado(ex) && (
                <span className="chip gris">Reagendamiento ya creado</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
