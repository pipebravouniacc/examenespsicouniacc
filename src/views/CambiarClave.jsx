import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CambiarClave({ perfil, alTerminar }) {
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const guardar = async () => {
    setMsg(null)
    if (clave.length < 8) {
      setMsg({ t: 'error', x: 'Usa al menos 8 caracteres.' })
      return
    }
    if (clave !== repetir) {
      setMsg({ t: 'error', x: 'Las contraseñas no coinciden.' })
      return
    }
    setOcupado(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: clave })
      if (error) throw error
      const { error: e2 } = await supabase
        .from('profesores')
        .update({ debe_cambiar_clave: false })
        .eq('id', perfil.id)
      if (e2) throw e2
      alTerminar()
    } catch (e) {
      setMsg({ t: 'error', x: e.message })
      setOcupado(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '30px auto' }}>
      <div className="eyebrow">Primer ingreso</div>
      <h2>Define tu contraseña</h2>
      <p className="sub">
        Tu cuenta fue creada por la coordinación con una contraseña provisoria. Elige una
        propia para continuar.
      </p>
      <label className="campo">
        <span>Nueva contraseña</span>
        <input type="password" value={clave} onChange={(e) => setClave(e.target.value)}
          autoComplete="new-password" />
      </label>
      <label className="campo">
        <span>Repite la contraseña</span>
        <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)}
          autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && guardar()} />
      </label>
      {msg && <div className={`aviso ${msg.t}`}>{msg.x}</div>}
      <button className="primario" onClick={guardar} disabled={ocupado || !clave || !repetir}>
        {ocupado ? 'Guardando…' : 'Guardar y continuar'}
      </button>
    </div>
  )
}
