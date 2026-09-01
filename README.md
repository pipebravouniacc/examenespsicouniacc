# Plataforma de Exámenes de Título y Grado · Psicología UNIACC

Agendamiento con propuesta automática de comisiones y evaluación con la rúbrica oficial, con generación de PDF de retroalimentación y Registro de Observaciones.

**Stack:** React + Vite (frontend en Netlify) · Supabase (autenticación y base de datos, capa gratuita). No requiere permisos de TI de UNIACC: los datos entran y salen por CSV compatible con el Microsoft List de la coordinación.

---

## 1. Crear el proyecto en Supabase (una sola vez, ~10 min)

1. Entra a https://supabase.com y crea una cuenta (sirve el correo institucional).
2. **New project** → nombre `examenes-psicologia`, región `South America (São Paulo)`, define una contraseña de base de datos y guárdala.
3. Cuando el proyecto termine de crearse, ve a **SQL Editor → New query**, pega el contenido completo de `supabase/schema.sql` y presiona **Run**. Debe terminar sin errores ("Success").
   - Si creaste la base con una versión anterior de este paquete, ejecuta además, en orden, `supabase/migracion_01_list_real.sql`, `supabase/migracion_02_cuentas_y_csv.sql` y `supabase/migracion_03_apto_por_estudiante.sql`.
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

## 5. Columnas del List

El importador es **agnóstico al formato**: reconoce las columnas por su nombre, admitiendo tanto
la base de datos de exámenes como la planilla de planificación, y conserva intactas las columnas
que no gestiona.

| Columna reconocida (y sus variantes) | Uso |
|---|---|
| Nombre del trabajo · Nombre de la tesis | Título del trabajo, aparece en ambos PDF |
| Integrantes · Estudiante 1–4 | Estudiantes, separados por `\|` |
| Rut · RUT 1–4 | RUT de cada estudiante, separados por `\|` **en el mismo orden que Integrantes** |
| Área | Priorización de comisiones por especialidad |
| Docente Guia · Docente guía nombre · Correo Docente Guía | Vinculación del guía: se prueban todas las columnas que mencionen el rol |
| Presidente de comisión · Docente Experto | Comisión ya asignada, si viniera del List |
| Fecha Examen · Hora Inicio · Hora Término | Agendamiento existente (si falta el término se asumen 90 minutos) |
| Modalidad · Sala · Observaciones | Se importan y se devuelven al exportar |
| Apto para Rendir | Habilitación para rendir (arancel de examen al día). Ver más abajo |
| Estado Portal · Resultado Portal | Se guardan y muestran, sin efecto sobre el agendamiento |
| ID Examen · Título | Identificador; si viene vacío o dice "Pendiente" se deduplica por trabajo + integrantes |

Al exportar, el CSV devuelve las columnas originales en su orden y agrega al final las que
gestiona la plataforma: estado, fecha y hora agendadas, comisión asignada, sala, modalidad y las
notas y resultado de cada estudiante (alineados con Integrantes por `\|`).

### Apto para rendir: es por estudiante

Corresponde al pago del arancel de examen, así que se maneja **por estudiante y no por tesis**:
un grupo de tres donde uno no pagó igual rinde con los otros dos.

El importador acepta tres formas de escribirlo en la columna `Apto para Rendir`:

- **Un valor por estudiante separado por `|`**, alineado con Integrantes: `Sí|No|Sí`.
- **Un valor único** (`Sí` o `No`), que se aplica a todo el grupo.
- **Vacío o columna ausente**: se asume que todos están habilitados.

También se reconocen columnas desglosadas `Apto 1` a `Apto 4` si prefieren esa estructura.

Quien no esté habilitado queda excluido de la rúbrica, de las notas, del PDF de retroalimentación
y del Registro de Observaciones, y no se le cuenta como reprobado ni entra en un reagendamiento.
El examen solo queda fuera de las propuestas cuando **ningún** integrante está habilitado.
La coordinación puede corregir la habilitación de cada estudiante en Tesis → Editar, por ejemplo
cuando un pago se regulariza a último momento.

### Sobre los correos

El List usa `@uniacc.edu` y las cuentas suelen ser `@uniacc.cl`. El sistema compara también la
parte anterior a la arroba, de modo que `nicole.castro@uniacc.edu` reconoce a quien se registró
con `nicole.castro@uniacc.cl`.

## 6. Cuentas de docente creadas por la coordinación

Hay dos formas de que un docente tenga acceso, y la coordinación decide cuál usar.

**Con contraseña provisoria (recomendada).** En Docentes → *Crear cuenta de docente*, la
coordinación ingresa nombre, correo, especialidades y una contraseña provisoria. Le entrega esas
credenciales al docente, y en su primer ingreso el sistema le exige definir una contraseña propia
antes de dejarlo continuar. Esto requiere desplegar una vez la Edge Function que viene en
`supabase/functions/crear-docente/index.ts`:

1. En Supabase, ve a **Edge Functions → Deploy a new function**.
2. Nombre exacto: `crear-docente`.
3. Pega el contenido completo del archivo y despliega. No hay que configurar secretos.

**Sin la Edge Function.** Si no la despliegas, el mismo formulario deja igual la ficha del docente
creada, habilitada y con sus especialidades y horarios. El docente entra a la plataforma, usa
*Crear cuenta* con ese mismo correo y el sistema enlaza automáticamente su cuenta con la ficha que
ya estaba preparada. La diferencia es solo quién define la contraseña inicial.

## 7. Precarga de horarios y edición manual

La coordinación puede **cargar la disponibilidad de cualquier docente** desde Docentes → botón
*Horarios*, tanto de planta como profesores hora. Cuando hay varias fechas habilitadas aparece
además un bloque para aplicar una misma franja a todas las fechas de una vez y luego ajustar los
días puntuales.

También puede **crear y editar tesis a mano** desde la pestaña Tesis: el botón *Ingresar tesis
manualmente* abre el formulario completo, y cada fila tiene *Editar* para modificar cualquier
atributo, incluidos estudiantes y sus RUT, área, guía, comisión, fecha, sala, estado y la marca de
apto para rendir. Sirve tanto para tesis que no vienen en el List como para corregir datos
importados.

## Notas técnicas

- Los PDF se generan en el navegador (jsPDF); no se almacenan archivos en el servidor y pueden regenerarse en cualquier momento desde Historial.
- Las políticas RLS de Supabase restringen la escritura: solo la Admin gestiona tesis, docentes y fechas; cada docente solo edita su perfil y disponibilidad; solo el presidente de un examen puede registrar su evaluación. Un trigger impide que un usuario se autoasigne rol de administrador.
- La capa gratuita de Supabase pausa proyectos tras una semana sin uso; basta con entrar a la plataforma o al panel de Supabase para reactivarlo. Para un ciclo de exámenes activo no es un problema.
