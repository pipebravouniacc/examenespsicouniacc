import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtFechaLarga, hoyISO } from '../lib/util'
import Evaluar from './Evaluar'

export default function Docente({ sesion, perfil, recargarPerfil }) {
  if (!perfil) return <CompletarPerfil sesion={sesion} alGuardar={recargarPerfil} />
  if (!perfil.habilitado)
    return (
      <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <div className="eyebrow">Cuenta creada</div>
        <h2>Tu acceso está pendiente de habilitación</h2>
        <p className="sub">
          La coordinación de exámenes debe habilitar tu cuenta. Cuando lo haga, al ingresar verás
          el calendario para registrar tu disponibilidad.
        </p>
      </div>
    )
  return <PanelDocente perfil={perfil} recargarPerfil={recargarPerfil} />
}

/* ---------- Completar perfil (primer ingreso) ---------- */
function CompletarPerfil({ sesion, alGuardar }) {
  const [nombre, setNombre] = useState('')
  const [gmail, setGmail] = useState('')
  const [esps, setEsps] = useState([])
  const [sel, setSel] = useState([])
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('especialidades').select('*').order('nombre').then(({ data }) => setEsps(data || []))
  }, [])

  const guardar = async () => {
    setMsg(null)
    const { error } = await supabase.from('profesores').insert({
      auth_id: sesion.user.id,
      nombre: nombre.trim(),
      correo_ms: sesion.user.email,
      correo_gmail: gmail.trim() || null,
      especialidades: sel,
    })
    if (error) setMsg({ t: 'error', x: error.message })
    else alGuardar()
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: '30px auto' }}>
      <div className="eyebrow">Primer ingreso</div>
      <h2>Completa tu perfil docente</h2>
      <p className="sub">Estos datos permiten vincularte como profesor/a guía y armar comisiones según especialidad.</p>
      <label className="campo">
        <span>Nombre completo (tal como aparece en actas)</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre Apellido Apellido" />
      </label>
      <label className="campo">
        <span>Correo Gmail (si figuras con él en la planilla de tesis; opcional)</span>
        <input value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="nombre@gmail.com" />
      </label>
      <h3>Áreas de especialidad</h3>
      <div className="check-grid">
        {esps.map((e) => (
          <label key={e.id}>
            <input
              type="checkbox"
              checked={sel.includes(e.nombre)}
              onChange={(ev) =>
                setSel(ev.target.checked ? [...sel, e.nombre] : sel.filter((x) => x !== e.nombre))
              }
            />
            {e.nombre}
          </label>
        ))}
      </div>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      <div className="acciones">
        <button className="primario" onClick={guardar} disabled={!nombre.trim()}>Guardar perfil</button>
      </div>
    </div>
  )
}

/* ---------- Panel docente habilitado ---------- */
function PanelDocente({ perfil, recargarPerfil }) {
  const [tab, setTab] = useState('disponibilidad')
  const [misExamenes, setMisExamenes] = useState([])

  useEffect(() => {
    supabase
      .from('examenes')
      .select('id')
      .eq('presidente_id', perfil.id)
      .eq('estado', 'agendado')
      .then(({ data }) => setMisExamenes(data || []))
  }, [perfil.id, tab])

  return (
    <div>
      <nav className="tabs">
        <button className={tab === 'disponibilidad' ? 'activa' : ''} onClick={() => setTab('disponibilidad')}>
          Mi disponibilidad
        </button>
        <button className={tab === 'evaluar' ? 'activa' : ''} onClick={() => setTab('evaluar')}>
          Evaluar exámenes
          {misExamenes.length > 0 && <span className="badge">{misExamenes.length}</span>}
        </button>
        <button className={tab === 'perfil' ? 'activa' : ''} onClick={() => setTab('perfil')}>Mi perfil</button>
      </nav>
      {tab === 'disponibilidad' && <Disponibilidad profesorId={perfil.id} />}
      {tab === 'evaluar' && <Evaluar perfil={perfil} />}
      {tab === 'perfil' && <EditarPerfil perfil={perfil} alGuardar={recargarPerfil} />}
    </div>
  )
}

/* ---------- Disponibilidad ---------- */
export function Disponibilidad({ profesorId, titulo }) {
  const [ventanas, setVentanas] = useState([])
  const [disps, setDisps] = useState([])
  const [msg, setMsg] = useState(null)

  const cargar = async () => {
    const hoy = hoyISO()
    const [v, d] = await Promise.all([
      supabase.from('ventanas').select('*').gte('fecha', hoy).order('fecha'),
      supabase.from('disponibilidades').select('*').eq('profesor_id', profesorId),
    ])
    setVentanas(v.data || [])
    setDisps(d.data || [])
  }
  useEffect(() => { cargar() }, [profesorId])

  const agregar = async (ventana, ini, fin) => {
    setMsg(null)
    if (!ini || !fin || fin <= ini) {
      setMsg({ t: 'error', x: 'La hora de término debe ser posterior a la de inicio.' })
      return
    }
    const { error } = await supabase.from('disponibilidades').insert({
      profesor_id: profesorId, fecha: ventana.fecha, hora_inicio: ini, hora_fin: fin,
    })
    if (error) setMsg({ t: 'error', x: error.message })
    else cargar()
  }

  const quitar = async (id) => {
    await supabase.from('disponibilidades').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="card">
      <div className="eyebrow">Disponibilidad horaria</div>
      <h2>{titulo || 'Marca tus franjas disponibles'}</h2>
      <p className="sub">
        En cada fecha habilitada por coordinación, agrega los rangos en que puedes participar en
        comisiones. El sistema encajará bloques de 90 minutos dentro de tus rangos.
      </p>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      {ventanas.length === 0 && (
        <div className="vacio">Aún no hay fechas de exámenes habilitadas por coordinación.</div>
      )}
      {ventanas.map((v) => (
        <DiaDisponibilidad
          key={v.id}
          ventana={v}
          franjas={disps.filter((d) => d.fecha === v.fecha)}
          onAgregar={agregar}
          onQuitar={quitar}
        />
      ))}
    </div>
  )
}

function DiaDisponibilidad({ ventana, franjas, onAgregar, onQuitar }) {
  const [ini, setIni] = useState(ventana.hora_inicio?.slice(0, 5) || '09:00')
  const [fin, setFin] = useState(ventana.hora_fin?.slice(0, 5) || '18:00')
  return (
    <div className="dia-card">
      <div className="fecha">{fmtFechaLarga(ventana.fecha)}</div>
      <div style={{ fontSize: 12.5, color: 'var(--gris)' }}>
        Ventana habilitada: {ventana.hora_inicio?.slice(0, 5)}–{ventana.hora_fin?.slice(0, 5)}
      </div>
      {franjas.map((f) => (
        <div className="franja" key={f.id}>
          <span className="chip verde mono">
            {f.hora_inicio.slice(0, 5)} – {f.hora_fin.slice(0, 5)}
          </span>
          <button className="suave mini" onClick={() => onQuitar(f.id)}>Quitar</button>
        </div>
      ))}
      <div className="franja">
        <input type="time" value={ini} onChange={(e) => setIni(e.target.value)} aria-label="Hora inicio" />
        <span>a</span>
        <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} aria-label="Hora término" />
        <button className="secundario mini" onClick={() => onAgregar(ventana, ini, fin)}>
          Agregar franja
        </button>
      </div>
    </div>
  )
}

/* ---------- Editar perfil ---------- */
function EditarPerfil({ perfil, alGuardar }) {
  const [esps, setEsps] = useState([])
  const [sel, setSel] = useState(perfil.especialidades || [])
  const [gmail, setGmail] = useState(perfil.correo_gmail || '')
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('especialidades').select('*').order('nombre').then(({ data }) => setEsps(data || []))
  }, [])

  const guardar = async () => {
    const { error } = await supabase
      .from('profesores')
      .update({ especialidades: sel, correo_gmail: gmail.trim() || null })
      .eq('id', perfil.id)
    setMsg(error ? { t: 'error', x: error.message } : { t: 'ok', x: 'Perfil actualizado.' })
    if (!error) alGuardar()
  }

  return (
    <div className="card">
      <div className="eyebrow">Mi perfil</div>
      <h2>{perfil.nombre}</h2>
      <p className="sub">{perfil.correo_ms}</p>
      <label className="campo" style={{ maxWidth: 380 }}>
        <span>Correo Gmail alternativo</span>
        <input value={gmail} onChange={(e) => setGmail(e.target.value)} />
      </label>
      <h3>Áreas de especialidad</h3>
      <div className="check-grid">
        {esps.map((e) => (
          <label key={e.id}>
            <input
              type="checkbox"
              checked={sel.includes(e.nombre)}
              onChange={(ev) =>
                setSel(ev.target.checked ? [...sel, e.nombre] : sel.filter((x) => x !== e.nombre))
              }
            />
            {e.nombre}
          </label>
        ))}
      </div>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      <div className="acciones">
        <button className="primario" onClick={guardar}>Guardar cambios</button>
      </div>
    </div>
  )
}
