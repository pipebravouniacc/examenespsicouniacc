import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { claveDedup } from '../lib/csv'
import { validarComision } from '../lib/scheduler'

const vacio = {
  codigo: '', nombre_trabajo: '', area: '', guia_id: '', modalidad: 'Presencial',
  modalidad_carrera: '', sala: '', link_reunion: '', fecha: '', hora_inicio: '', hora_fin: '',
  presidente_id: '', experto_id: '', estado: 'pendiente', apto_rendir: true,
  estado_portal: '', resultado_portal: '', registro_obs: '',
}

export default function EditorTesis({ examen, datos, alCerrar }) {
  const esNuevo = !examen
  const [f, setF] = useState(() => {
    if (!examen) return { ...vacio }
    const o = { ...vacio }
    for (const k of Object.keys(vacio)) if (examen[k] != null) o[k] = examen[k]
    o.hora_inicio = (examen.hora_inicio || '').slice(0, 5)
    o.hora_fin = (examen.hora_fin || '').slice(0, 5)
    return o
  })
  const [ests, setEsts] = useState(() =>
    ((examen?.estudiantes || []).length
      ? [...examen.estudiantes].sort((a, b) => a.orden - b.orden)
      : [{ nombre: '', rut: '', apto_rendir: true }]
    ).map((s) => ({
      id: s.id, nombre: s.nombre || '', rut: s.rut || '',
      apto_rendir: s.apto_rendir !== false,
    }))
  )
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const setEst = (i, k, v) => setEsts((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)))

  const guardar = async () => {
    setMsg(null)
    const limpios = ests.filter((s) => s.nombre.trim())
    if (!f.nombre_trabajo.trim() && !limpios.length) {
      setMsg({ t: 'error', x: 'Indica al menos el nombre del trabajo o un estudiante.' })
      return
    }
    const problemas = validarComision(
      { guia_id: f.guia_id, presidente_id: f.presidente_id, experto_id: f.experto_id },
      datos.profesores
    )
    if (problemas.length) {
      setMsg({ t: 'error', x: problemas.join(' ') })
      return
    }
    setOcupado(true)
    try {
      const campos = {
        codigo: f.codigo.trim() || null,
        nombre_trabajo: f.nombre_trabajo.trim() || null,
        area: f.area || null,
        guia_id: f.guia_id || null,
        presidente_id: f.presidente_id || null,
        experto_id: f.experto_id || null,
        modalidad: f.modalidad || null,
        modalidad_carrera: f.modalidad_carrera || null,
        sala: f.sala.trim() || null,
        link_reunion: f.link_reunion.trim() || null,
        fecha: f.fecha || null,
        hora_inicio: f.hora_inicio || null,
        hora_fin: f.hora_fin || null,
        estado: f.estado,
        apto_rendir: limpios.some((s) => s.apto_rendir !== false),
        estado_portal: f.estado_portal || null,
        resultado_portal: f.resultado_portal || null,
        registro_obs: f.registro_obs || null,
      }

      let examenId = examen?.id
      if (esNuevo) {
        campos.clave_dedup = claveDedup(
          campos.codigo,
          campos.nombre_trabajo,
          limpios.map((s) => s.nombre).join('|')
        )
        campos.raw = {
          'ID Examen': campos.codigo || '',
          'Nombre del trabajo': campos.nombre_trabajo || '',
          'Área': campos.area || '',
          'Integrantes': limpios.map((s) => s.nombre).join('|'),
          'Rut': limpios.map((s) => s.rut).join('|'),
          'Modalidad': campos.modalidad || '',
        }
        const { data, error } = await supabase.from('examenes').insert(campos).select().single()
        if (error) throw error
        examenId = data.id
      } else {
        const { error } = await supabase.from('examenes').update(campos).eq('id', examen.id)
        if (error) throw error
      }

      // Estudiantes: actualiza los existentes, agrega los nuevos, borra los quitados
      const previos = examen?.estudiantes || []
      const conservados = limpios.filter((s) => s.id).map((s) => s.id)
      for (const p of previos) {
        if (!conservados.includes(p.id)) await supabase.from('estudiantes').delete().eq('id', p.id)
      }
      for (let i = 0; i < limpios.length; i++) {
        const s = limpios[i]
        const fila = {
          nombre: s.nombre.trim(), rut: s.rut.trim() || null, orden: i + 1,
          apto_rendir: s.apto_rendir !== false,
        }
        if (s.id) await supabase.from('estudiantes').update(fila).eq('id', s.id)
        else await supabase.from('estudiantes').insert({ ...fila, examen_id: examenId })
      }
      alCerrar(true)
    } catch (e) {
      setMsg({ t: 'error', x: e.message })
      setOcupado(false)
    }
  }

  const areas = datos.especialidades.map((e) => e.nombre)

  // Cada rol excluye a quienes ya están asignados a otro rol del mismo examen
  const sinRepetir = (rol) => {
    const tomados = [
      rol !== 'guia' ? f.guia_id : null,
      rol !== 'presidente' ? f.presidente_id : null,
      rol !== 'experto' ? f.experto_id : null,
    ].filter(Boolean)
    const base = rol === 'presidente'
      ? datos.profesores.filter((p) => p.tipo === 'planta')
      : datos.profesores
    return base.filter((p) => !tomados.includes(p.id))
  }

  return (
    <div className="card">
      <div className="eyebrow">{esNuevo ? 'Nueva tesis' : 'Editar tesis'}</div>
      <h2>{esNuevo ? 'Ingresar tesis manualmente' : f.nombre_trabajo || 'Sin título'}</h2>
      <p className="sub">
        Todos los campos son editables. Los cambios se reflejan en las propuestas de
        agendamiento, en los PDF y en el CSV que exportes.
      </p>

      <div className="fila">
        <label className="campo"><span>ID Examen</span>
          <input value={f.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="EG-2026-001" /></label>
        <label className="campo"><span>Modalidad de la carrera</span>
          <input value={f.modalidad_carrera} onChange={(e) => set('modalidad_carrera', e.target.value)}
            placeholder="Diurno / Vespertino" /></label>
      </div>

      <label className="campo"><span>Nombre del trabajo</span>
        <textarea style={{ minHeight: 60 }} value={f.nombre_trabajo}
          onChange={(e) => set('nombre_trabajo', e.target.value)} /></label>

      <div className="fila">
        <label className="campo"><span>Área</span>
          <select value={f.area} onChange={(e) => set('area', e.target.value)}>
            <option value="">Sin área</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            {f.area && !areas.includes(f.area) && <option value={f.area}>{f.area}</option>}
          </select></label>
        <label className="campo"><span>Docente guía</span>
          <select value={f.guia_id} onChange={(e) => set('guia_id', e.target.value)}>
            <option value="">Sin vincular</option>
            {sinRepetir('guia').map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
            ))}
          </select></label>
      </div>

      <h3>Estudiantes</h3>
      <p className="sub" style={{ marginTop: -6 }}>
        "Habilitado/a" indica que puede rendir (arancel de examen al día). Quien no lo esté no
        aparece en la rúbrica ni en el acta, aunque su grupo sí rinda.
      </p>
      {ests.map((s, i) => (
        <div className="fila" key={i} style={{ alignItems: 'flex-end' }}>
          <label className="campo" style={{ flex: 2 }}><span>Nombre {i + 1}</span>
            <input value={s.nombre} onChange={(e) => setEst(i, 'nombre', e.target.value)} /></label>
          <label className="campo"><span>RUT</span>
            <input value={s.rut} onChange={(e) => setEst(i, 'rut', e.target.value)} placeholder="12.345.678-9" /></label>
          <div style={{ flex: 0, minWidth: 130, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, whiteSpace: 'nowrap' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={s.apto_rendir !== false}
                onChange={(e) => setEst(i, 'apto_rendir', e.target.checked)} />
              Habilitado/a
            </label>
            <button className="suave mini" onClick={() => setEsts(ests.filter((_, j) => j !== i))}
              disabled={ests.length === 1}>Quitar</button>
          </div>
        </div>
      ))}
      {ests.length < 8 && (
        <button className="secundario mini"
          onClick={() => setEsts([...ests, { nombre: '', rut: '', apto_rendir: true }])}>
          Agregar estudiante
        </button>
      )}

      <h3>Agendamiento</h3>
      <div className="fila">
        <label className="campo"><span>Fecha</span>
          <input type="date" value={f.fecha || ''} onChange={(e) => set('fecha', e.target.value)} /></label>
        <label className="campo"><span>Hora inicio</span>
          <input type="time" value={f.hora_inicio} onChange={(e) => set('hora_inicio', e.target.value)} /></label>
        <label className="campo"><span>Hora término</span>
          <input type="time" value={f.hora_fin} onChange={(e) => set('hora_fin', e.target.value)} /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Presidente/a de comisión</span>
          <select value={f.presidente_id} onChange={(e) => set('presidente_id', e.target.value)}>
            <option value="">Sin asignar</option>
            {sinRepetir('presidente').map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{p.cargo ? ` · ${p.cargo}` : ''}</option>
            ))}
          </select></label>
        <label className="campo"><span>Docente experto/a</span>
          <select value={f.experto_id} onChange={(e) => set('experto_id', e.target.value)}>
            <option value="">Sin asignar</option>
            {sinRepetir('experto').map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
            ))}
          </select></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Modalidad del examen</span>
          <select value={f.modalidad} onChange={(e) => set('modalidad', e.target.value)}>
            <option>Presencial</option><option>Online</option>
          </select></label>
        <label className="campo"><span>Sala</span>
          <input value={f.sala} onChange={(e) => set('sala', e.target.value)} /></label>
        <label className="campo"><span>Link reunión</span>
          <input value={f.link_reunion} onChange={(e) => set('link_reunion', e.target.value)} /></label>
      </div>
      <div className="fila">
        <label className="campo"><span>Estado</span>
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            <option value="pendiente">Pendiente de agendar</option>
            <option value="propuesto">Propuesta por confirmar</option>
            <option value="agendado">Agendado</option>
            <option value="realizado">Realizado</option>
          </select></label>
        <label className="campo"><span>Estado Portal</span>
          <input value={f.estado_portal} onChange={(e) => set('estado_portal', e.target.value)} /></label>
        <label className="campo"><span>Resultado Portal</span>
          <input value={f.resultado_portal} onChange={(e) => set('resultado_portal', e.target.value)} /></label>
      </div>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      <div className="acciones">
        <button className="primario" onClick={guardar} disabled={ocupado}>
          {ocupado ? 'Guardando…' : esNuevo ? 'Crear tesis' : 'Guardar cambios'}
        </button>
        <button className="suave" onClick={() => alCerrar(false)}>Cancelar</button>
      </div>
    </div>
  )
}
