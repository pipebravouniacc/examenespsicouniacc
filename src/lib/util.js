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
  // El List puede traer @uniacc.edu mientras la cuenta usa @uniacc.cl:
  // se compara también la parte local del correo entrante.
  const tLocal = t.includes('@') ? t.split('@')[0] : null
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
    if (tLocal && candidatos.includes(tLocal)) return p
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

// ---- Cargos institucionales de los docentes de planta ----
// El orden de esta lista ES la prioridad para presidir comisiones.
export const CARGOS = [
  'Directivo',
  'Académico regular',
  'Académico docente',
  'Secretario académico',
]

// Rango numérico del cargo: menor es más prioritario.
// Una ficha sin cargo asignado queda al final.
export const rangoCargo = (prof) => {
  const i = CARGOS.indexOf(prof?.cargo)
  return i === -1 ? CARGOS.length : i
}

// Ordena una lista de docentes por cargo, barajando dentro de cada
// nivel para que no siempre recaiga en la misma persona.
export function ordenarPorCargo(lista) {
  const grupos = new Map()
  for (const p of lista) {
    const r = rangoCargo(p)
    if (!grupos.has(r)) grupos.set(r, [])
    grupos.get(r).push(p)
  }
  return [...grupos.keys()]
    .sort((a, b) => a - b)
    .flatMap((r) => barajar(grupos.get(r)))
}
