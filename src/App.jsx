import React, { useEffect, useState, useCallback } from 'react'
import { supabase, configurado } from './lib/supabase'
import Login from './views/Login'
import Admin from './views/Admin'
import Docente from './views/Docente'

export default function App() {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (s) => {
    if (!s) { setPerfil(null); return }
    const { data } = await supabase
      .from('profesores')
      .select('*')
      .eq('auth_id', s.user.id)
      .maybeSingle()
    setPerfil(data || null)
  }, [])

  useEffect(() => {
    if (!configurado) { setCargando(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session)
      await cargarPerfil(data.session)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSesion(s)
      await cargarPerfil(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [cargarPerfil])

  if (!configurado)
    return (
      <div style={{ padding: 40, maxWidth: 640, margin: '0 auto' }}>
        <h1>Configuración pendiente</h1>
        <p>
          Faltan las variables de entorno <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>. Revisa el README para configurarlas en Netlify
          (Site settings → Environment variables) o en un archivo <code>.env</code> local.
        </p>
      </div>
    )

  if (cargando) return <div className="vacio" style={{ paddingTop: 80 }}>Cargando…</div>
  if (!sesion) return <Login />

  const cerrar = () => supabase.auth.signOut()

  return (
    <div>
      <div className="barra-uniacc"><span /><span /><span /><span /></div>
      <header className="app">
        <div className="marca">
          <strong>Exámenes de Título y Grado</strong>
          <small>Facultad de Psicología · UNIACC</small>
        </div>
        <div className="sesion">
          {perfil && <span className="rol">{perfil.es_admin ? 'Coordinación' : 'Docente'}</span>}
          <span>{perfil ? perfil.nombre : sesion.user.email}</span>
          <button className="suave mini" onClick={cerrar}>Cerrar sesión</button>
        </div>
      </header>
      <main className="contenedor">
        {perfil?.es_admin ? (
          <Admin perfil={perfil} />
        ) : (
          <Docente sesion={sesion} perfil={perfil} recargarPerfil={() => cargarPerfil(sesion)} />
        )}
      </main>
    </div>
  )
}
