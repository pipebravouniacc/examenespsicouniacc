import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [modo, setModo] = useState('entrar')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = async () => {
    setMsg(null)
    setOcupado(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: correo, password: clave })
        if (error) throw error
        if (data.session === null)
          setMsg({ t: 'info', x: 'Revisa tu correo para confirmar la cuenta y luego inicia sesión.' })
      }
    } catch (e) {
      setMsg({ t: 'error', x: traducir(e.message) })
    }
    setOcupado(false)
  }

  return (
    <div className="login-marco">
      <div className="login-caja">
        <div className="eyebrow">Facultad de Psicología · UNIACC</div>
        <h1>Exámenes de Título y Grado</h1>
        <p className="sub">
          {modo === 'entrar'
            ? 'Ingresa con tu cuenta de docente o coordinación.'
            : 'Crea tu cuenta con tu correo institucional. La coordinación habilitará tu acceso.'}
        </p>
        <label className="campo">
          <span>Correo institucional</span>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="nombre.apellido@uniacc.cl"
            autoComplete="email"
          />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
          />
        </label>
        {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
        <button className="primario" style={{ width: '100%' }} onClick={enviar} disabled={ocupado || !correo || !clave}>
          {modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
        <div style={{ marginTop: 14, fontSize: 13, textAlign: 'center' }}>
          {modo === 'entrar' ? (
            <>¿Primera vez? <a href="#" onClick={(e) => { e.preventDefault(); setModo('crear'); setMsg(null) }}>Crear cuenta de docente</a></>
          ) : (
            <>¿Ya tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); setModo('entrar'); setMsg(null) }}>Iniciar sesión</a></>
          )}
        </div>
      </div>
    </div>
  )
}

function traducir(m) {
  if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.'
  if (/already registered/i.test(m)) return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (/at least 6/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/valid email/i.test(m)) return 'Ingresa un correo válido.'
  return m
}
