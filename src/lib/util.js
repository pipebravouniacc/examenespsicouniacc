// Utilidades generales

export const normalizar = (s) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

// Intenta vincular el texto del guía del List con un profesor registrado.
// Acepta: correo Microsoft, correo Gmail, parte local de cualquiera de los dos,
// o nombre completo (normalizado, sin tildes, sin importar mayúsculas).
export function matchProfesor(texto, profesores) {
  const t = normalizar(texto)
  if (!t) return null
  for (const p of profesores) {
    const candidatos = [
      p.correo_ms,
      p.correo_gmail,
      (p.correo_ms || '').split('@')[0],
      (p.correo_gmail || '').split('@')[0],
      p.nombre,
    ]
      .map(normalizar)
      .filter(Boolean)
    if (candidatos.includes(t)) return p
  }
  return null
}

// ---- horas como minutos desde medianoche ----
export const aMin = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
export const aHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export const fmtFechaLarga = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export const fmtNota = (n) => (n == null ? '—' : Number(n).toFixed(1))

export const nombreCorto = (p) => (p ? p.nombre : '—')

export function barajar(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
