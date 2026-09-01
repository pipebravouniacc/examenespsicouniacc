# Plataforma de Exámenes de Título y Grado · Psicología UNIACC

Agendamiento con propuesta automática de comisiones y evaluación con la rúbrica oficial, con generación de PDF de retroalimentación y Registro de Observaciones.

**Stack:** React + Vite (frontend en Netlify) · Supabase (autenticación y base de datos, capa gratuita). No requiere permisos de TI de UNIACC: los datos entran y salen por CSV compatible con el Microsoft List de la coordinación.

---

## 1. Crear el proyecto en Supabase (una sola vez, ~10 min)

1. Entra a https://supabase.com y crea una cuenta (sirve el correo institucional).
2. **New project** → nombre `examenes-psicologia`, región `South America (São Paulo)`, define una contraseña de base de datos y guárdala.
3. Cuando el proyecto termine de crearse, ve a **SQL Editor → New query**, pega el contenido completo de `supabase/schema.sql` y presiona **Run**. Debe terminar sin errores ("Success").
4. Ve a **Authentication → Sign In / Providers → Email** y desactiva **Confirm email** (recomendado para que los docentes no dependan de un correo de confirmación). Si prefieres mantenerlo activo, cada docente deberá confirmar su correo antes de entrar.
5. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public key**

## 2. Desplegar en Netlify (~10 min)

1. Sube esta carpeta a un repositorio (GitHub) o usa **Netlify Drop** con despliegue por CLI. La vía recomendada:
   - Crea un repositorio en GitHub y sube el contenido de esta carpeta.
   - En https://app.netlify.com → **Add new site → Import an existing project** → conecta el repositorio.
   - Netlify detecta la configuración automáticamente desde `netlify.toml` (build `npm run build`, publish `dist`).
2. Antes del primer deploy, en **Site configuration → Environment variables** agrega:
   - `VITE_SUPABASE_URL` = Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon public key
3. Deploy. La URL resultante (puedes personalizarla, p. ej. `examenes-psicologia-uniacc.netlify.app`) es la que se comparte con los docentes.

Para probar en local: `npm install`, crea un archivo `.env` con esas dos variables y ejecuta `npm run dev`.

## 3. Activar a la coordinadora como administradora (una sola vez)

1. La coordinadora entra a la plataforma, **crea su cuenta** y completa su perfil.
2. En Supabase → **SQL Editor**, ejecuta (con su correo real):

```sql
update profesores set es_admin = true, habilitado = true
where correo_ms = 'coordinadora@uniacc.cl';
```

3. Al volver a entrar verá el panel de Coordinación.

## 4. Puesta en marcha del ciclo

1. **Fechas de examen**: la Admin habilita las fechas y horarios del ciclo.
2. **Docentes**: los planta crean su cuenta, indican especialidades y la Admin los habilita. Los profesores hora se agregan desde la pestaña Docentes (con especialidades) y la Admin carga sus horarios con el botón **Horarios**.
3. **Disponibilidad**: cada docente planta marca sus franjas libres dentro de las fechas habilitadas.
4. **Tesis**: la Admin exporta el List a CSV y lo importa en la pestaña Tesis. Si algún guía aparece "No vinculado", se resuelve con el selector.
5. **Propuestas**: botón **Generar propuestas**; por cada tesis se puede confirmar (agregando modalidad y sala), pedir otra propuesta, agendar manual o dejar pendiente.
6. **Evaluación**: el día del examen, el presidente entra a **Evaluar exámenes**, registra los puntajes consensuados, el sistema calcula las notas con la tabla oficial (ambas deben ser ≥ 4.0) y al cerrar genera los dos PDF.
7. **Post examen**: si hay reprobados, el panel de la Admin lo alerta; desde Historial, **Reagendar reprobados** crea un nuevo examen solo con ellos, que entra a la próxima ronda de propuestas. **Exportar CSV** entrega la planilla actualizada en el formato del List.

## 5. Columnas del List para la importación

Formato recomendado (la coordinadora puede agregar estas columnas al List y exportarlo a CSV):

| Columna | Contenido |
|---|---|
| ID Examen | Identificador único (ej. EX-2026-001) |
| Nombre del trabajo | Título de la tesis |
| Área | Debe coincidir con un área del catálogo de especialidades |
| Docente guía | Correo Microsoft, correo Gmail o nombre completo |
| Estudiante 1 … Estudiante 4 | Nombre completo |
| RUT 1 … RUT 4 | RUT del estudiante correspondiente |
| Modalidad | Presencial u Online |

También se aceptan las columnas del List original (`Integrantes` separados por `|`, `Docente guía nombre`), aunque sin RUT.

## Notas técnicas

- Los PDF se generan en el navegador (jsPDF); no se almacenan archivos en el servidor y pueden regenerarse en cualquier momento desde Historial.
- Las políticas RLS de Supabase restringen la escritura: solo la Admin gestiona tesis, docentes y fechas; cada docente solo edita su perfil y disponibilidad; solo el presidente de un examen puede registrar su evaluación. Un trigger impide que un usuario se autoasigne rol de administrador.
- La capa gratuita de Supabase pausa proyectos tras una semana sin uso; basta con entrar a la plataforma o al panel de Supabase para reactivarlo. Para un ciclo de exámenes activo no es un problema.
