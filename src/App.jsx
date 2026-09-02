import React, { useEffect, useState, useCallback } from 'react'
import { supabase, configurado } from './lib/supabase'
import Login from './views/Login'
import Admin from './views/Admin'
import Docente from './views/Docente'
import CambiarClave from './views/CambiarClave'

export default function App() {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (s) => {
    if (!s) { setPerfil(null); return }
    let { data } = await supabase
      .from('profesores')
      .select('*')
      .eq('auth_id', s.user.id)
      .maybeSingle()

    // Si no hay ficha ligada, puede existir una creada por coordinación
    // con este correo: se enlaza y se vuelve a leer.
    if (!data) {
      const { data: vinculado } = await supabase.rpc('vincular_perfil')
      if (vinculado) {
        const r = await supabase.from('profesores').select('*').eq('id', vinculado).maybeSingle()
        data = r.data
      }
    }
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
  const recargar = () => cargarPerfil(sesion)

  const encabezado = (
    <>
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
    </>
  )

  // Cuenta creada por coordinación con contraseña genérica: debe cambiarla.
  if (perfil?.debe_cambiar_clave)
    return (
      <div>
        {encabezado}
        <main className="contenedor">
          <CambiarClave perfil={perfil} alTerminar={recargar} />
        </main>
      </div>
    )

  return (
    <div>
      {encabezado}
      <main className="contenedor">
        {perfil?.es_admin ? (
          <Admin perfil={perfil} />
        ) : (
          <Docente sesion={sesion} perfil={perfil} recargarPerfil={recargar} />
        )}
      </main>
    </div>
  )
}
