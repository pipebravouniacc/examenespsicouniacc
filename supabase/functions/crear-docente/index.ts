// Edge Function · crear-docente
// Permite que la coordinación cree cuentas de docente con una contraseña
// genérica. Se ejecuta en el servidor de Supabase, donde sí puede usarse la
// service_role key sin exponerla en el navegador.
//
// Despliegue desde el panel de Supabase:
//   Edge Functions → Deploy a new function → nombre: crear-docente
//   Pega este archivo completo y despliega.
// No hace falta configurar secretos: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// vienen inyectadas automáticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // 1. Verificar que quien llama es una coordinación autenticada
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'Falta autenticación.' }, 401)

    const comoUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await comoUsuario.auth.getUser()
    if (!userData?.user) return json({ error: 'Sesión inválida.' }, 401)

    const { data: perfil } = await comoUsuario
      .from('profesores')
      .select('es_admin')
      .eq('auth_id', userData.user.id)
      .maybeSingle()

    if (!perfil?.es_admin)
      return json({ error: 'Solo la coordinación puede crear cuentas.' }, 403)

    // 2. Crear la cuenta con privilegios de servicio
    const admin = createClient(url, serviceKey)
    const body = await req.json()
    const {
      correo, clave, nombre, tipo = 'planta', especialidades = [],
      correo_gmail = null, habilitado = true,
    } = body

    if (!correo || !clave || !nombre)
      return json({ error: 'Faltan datos: correo, clave y nombre son obligatorios.' }, 400)
    if (String(clave).length < 6)
      return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)

    const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
      email: correo,
      password: clave,
      email_confirm: true,
    })

    let authId = creado?.user?.id ?? null

    if (errAuth) {
      // Si la cuenta ya existe, se reutiliza y se le fija la clave genérica
      const { data: lista } = await admin.auth.admin.listUsers()
      const existente = lista?.users?.find(
        (u) => (u.email ?? '').toLowerCase() === String(correo).toLowerCase()
      )
      if (!existente) return json({ error: errAuth.message }, 400)
      await admin.auth.admin.updateUserById(existente.id, {
        password: clave,
        email_confirm: true,
      })
      authId = existente.id
    }

    // 3. Crear o actualizar la ficha del docente
    const { data: ficha } = await admin
      .from('profesores')
      .select('id')
      .or(`auth_id.eq.${authId},correo_ms.ilike.${correo}`)
      .maybeSingle()

    const campos = {
      auth_id: authId,
      nombre,
      correo_ms: correo,
      correo_gmail,
      tipo,
      especialidades,
      habilitado,
      debe_cambiar_clave: true,
    }

    if (ficha) {
      await admin.from('profesores').update(campos).eq('id', ficha.id)
      return json({ ok: true, id: ficha.id, reutilizada: true })
    }

    const { data: nueva, error: errFicha } = await admin
      .from('profesores')
      .insert(campos)
      .select()
      .single()

    if (errFicha) return json({ error: errFicha.message }, 400)
    return json({ ok: true, id: nueva.id })
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500)
  }
})
