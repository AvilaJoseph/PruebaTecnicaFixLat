# Planeación — Portal de equipo con tablero de notas

> Documento de trabajo para ejecutar la prueba técnica en **sesiones cortas e independientes**.
> Fuente: `Prueba técnica.pdf` (3 páginas). Presupuesto: **3 días calendario, máx. 8 h efectivas**.

---

## 0. Cómo usar este documento

1. **Lee §1–§5 una sola vez.** Contienen el desglose del enunciado, las decisiones técnicas y los *contratos compartidos* (estructura, BD, API, variables, puertos). Los contratos son lo que permite que cada sesión arranque sin depender del detalle interno de otra.
2. **Cada sesión (§7) es una conversación nueva de Claude Code** con un alcance cerrado, su propia prueba individual y su commit.
3. **Regla de independencia:**
   - **Cadenas contiguas:** si una sesión necesita código de otra (dependencia dura), va justo después: S1→S2 (Núcleo) y S6→S7→S8 (Cierre).
   - **Bloque B** (Tablero, Dashboard, Usuarios): cada sesión depende solo del **Núcleo completo** (S1+S2), no de las otras dos, y se pueden hacer en cualquier orden. S6 empieza cuando termina la última del Bloque B.
   - Cada prueba individual es **autocontenida**: levanta lo que necesita e inicia sesión por su cuenta. No reutiliza archivos de sesiones anteriores (cookies, datos).
4. **Al terminar cada sesión:** pasar su checklist de aceptación → commit → anotar tiempo en §10.
5. Si una sesión se queda sin tiempo, se registra lo pendiente en §10 (el enunciado exige declararlo).

---

## 1. Desglose del enunciado (matriz de trazabilidad)

Cada requisito tiene un ID, la sesión que lo implementa y cómo se evidencia. Esta tabla es el checklist final de S6 y S8.

### 1.1 Condiciones generales

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| G1 | Entregar en 3 días calendario, máx. 8 h de trabajo efectivo | Todas | Registro §10 |
| G2 | Indicar tiempo empleado y partes pendientes | S8 | README › Tiempo y pendientes |
| G3 | Stack libre; IA permitida (generación, modificación, revisión) | — | README › Stack y uso de IA |

### 1.2 Acceso y usuarios (PDF §1)

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| A1 | Iniciar sesión | S2 | Test API + login en UI |
| A2 | Cerrar sesión | S2 | Botón “Salir” invalida cookie |
| A3 | Dashboard, tablero y administración solo para autenticados | S2 | Rutas protegidas (UI) + `401` en API |
| A4 | Rol **Administrador**: tablero + dashboard + administración de usuarios | S2/S5 | Menú y rutas por rol |
| A5 | Rol **Usuario**: tablero + dashboard, **sin** administración | S2/S5 | `403` en `/api/users`, sin enlace en menú |
| A6 | Listar usuarios | S5 | Tabla de usuarios |
| A7 | Crear usuarios | S5 | Formulario + test |
| A8 | Editar usuarios | S5 | Formulario + test |
| A9 | Asignar rol | S5 | Campo rol en crear/editar |
| A10 | Desactivar y reactivar usuarios | S5 | Acción en tabla + test |
| A11 | Cada usuario: nombre, correo, rol, estado activo/inactivo | S1/S5 | Esquema BD |
| A12 | Usuario inactivo **no puede iniciar sesión** | S2 | Test login inactivo → `403` |
| A13 | Usuario inactivo **no puede continuar** usando el área autenticada (sesión ya abierta) | S2/S5 | Estado verificado en BD en cada request → `401` |
| A14 | Siempre debe existir **al menos un administrador activo** | S5 | Test: desactivar/degradar último admin → `409` |
| A15 | Cuentas de demostración para ambos roles | S1 | Migración de seed (se aplica una sola vez) |
| A16 | Explicar cómo acceder con las cuentas demo y cómo inicia sesión un usuario creado desde la app | S8 | README |

### 1.3 Tablero compartido de notas (PDF §2)

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| T1 | Un **único** tablero compartido | S3 | Sin entidad “tablero” |
| T2 | Lienzo libre con notas tipo post-it, **sin columnas** | S3 | Posicionamiento absoluto x/y |
| T3 | Todos los usuarios activos crean, editan, mueven y eliminan **todas** las notas | S3 | Sin chequeo de autoría |
| T4 | Nota con título, texto, estado (**Pendiente / En curso / Hecho**) y posición | S1/S3 | Esquema + UI |
| T5 | Editar título, texto y estado **directamente sobre la nota** | S3 | Inputs dentro de la tarjeta |
| T6 | Confirmar esos cambios con una acción **Guardar** | S3 | Botón Guardar (sin autosave de contenido) |
| T7 | Eliminar una nota | S3 | Botón Eliminar + confirmación |
| T8 | Mover libremente con el ratón (arrastrar y soltar) | S3 | Pointer events |
| T9 | Al **soltar**, la posición se guarda **automáticamente** | S3 | `PATCH /position` en `pointerup` |
| T10 | Contenido, estado y posición persisten al **recargar** | S3 | Prueba manual F5 |
| T11 | …y al **reiniciar el entorno local** sin borrar datos persistentes | S6 | `docker compose down && up` |

### 1.4 Dashboard (PDF §3)

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| D1 | Número total de notas | S4 | Tarjeta “Total” |
| D2 | Distribución por estado | S4 | Tarjetas + barra por estado |
| D3 | Cifras reflejan el tablero (basta con actualizar al reabrir/recargar) | S4 | Carga al montar + botón “Actualizar” |
| D4 | Cálculo **y** entrega de métricas mediante ≥ 1 **AWS Lambda** | S4 | Lambda consulta la BD y devuelve el JSON |
| D5 | Conexión frontend/API/Lambda/almacenamiento a elección | S4/S8 | Documentado en §4 y README |

### 1.5 Ejecución local (PDF §4)

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| L1 | Ejecutable y demostrable **completamente en local** | S6 | Clon limpio + `docker compose up` |
| L2 | Docker Compose | S1→S6 | `docker-compose.yml` |
| L3 | Dockerfiles necesarios | S1/S4 | `api/`, `web/`, `lambda/metrics/` |
| L4 | Instrucciones para levantar el entorno y **cargar las cuentas demo** | S8 | README |
| L5 | Persistencia y mecanismo de inicialización a elección (documentarlos) | S1/S8 | Volumen `pgdata` + servicio `migrate` |
| L6 | Local **sin** cuenta AWS, despliegue remoto ni suscripción de pago | S4/S6 | Lambda en contenedor RIE, credenciales ficticias |
| L7 | Lambda ejecutable localmente mediante mecanismo documentado | S4/S7 | RIE en Compose (principal) + `sam local invoke` (alternativo) |
| L8 | API vía Compose; frontend servido desde contenedor (EC2/CloudFront no se emulan) | S1 | Servicios `api` y `web` |

### 1.6 Arquitectura AWS (PDF §4)

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| W1 | **EC2**: API de usuarios y notas dentro de contenedor Docker | S7 | `ApiInstance` + UserData con Compose |
| W2 | **Lambda**: cálculo y entrega de métricas | S7 | `MetricsFunction` |
| W3 | **S3 + CloudFront**: almacenamiento y distribución del frontend | S7 | `FrontendBucket` + `Distribution` (OAC) |
| W4 | IaC con **AWS SAM y CloudFormation** | S7 | `infra/template.yaml` |
| W5 | Archivos/scripts para desplegar con **AWS CLI y AWS SAM** | S7 | `scripts/deploy.sh` |
| W6 | Scripts para **retirar** los recursos creados | S7 | `scripts/teardown.sh` |
| W7 | Documentar parámetros y requisitos del despliegue | S7/S8 | README › AWS |
| W8 | Elegir almacenamiento y recursos adicionales de conexión | S7 | §3 y §4 |
| W9 | La configuración AWS **corresponde al proyecto entregado** | S7 | Mismos Dockerfiles, handler y variables |
| W10 | Despliegue real opcional; si se hace, URL funcional (no sustituye local ni video) | S8 | README › URL (opcional) |

### 1.7 Alcance y entrega (PDF §5 y §6)

| ID | Requisito | Sesión | Evidencia |
|----|-----------|--------|-----------|
| X1 | **Fuera de alcance:** tableros múltiples, columnas, asignación, fechas de vencimiento, comentarios, adjuntos, notificaciones, historial, tiempo real, apps móviles nativas | Todas | No implementar |
| X2 | Sin dominio propio; sin servicios AWS extra innecesarios | S7 | Solo EC2, Lambda, S3, CloudFront + IAM/SG/CloudWatch Logs (+ parámetro público SSM para resolver la AMI) |
| E1 | Proyecto completo (repo o zip) con código y archivos de ejecución/despliegue | S8 | Repositorio remoto accesible (`main` + tags) |
| E2 | Identificar versión entregada (commit o archivo) | S8 | Tag `entrega-v1` en el remoto + hash en el mensaje de entrega |
| E3 | README: requisitos, arranque, cuentas demo, uso, persistencia, despliegue y retirada AWS, arquitectura breve, tiempo, limitaciones/pendientes | S8 | `README.md` |
| E4 | Video ≤ 8 min: app funcionando + organización y arquitectura; acceso, diferencias de roles, gestión de usuarios, crear/editar/eliminar notas, mover y conservar posición, dashboard | S8 | Guion §8.2 |
| E5 | URL AWS e instrucciones de acceso, si se desplegó | S8 | README |
| E6 | Revisable **sin asistencia** del candidato | S6/S8 | Prueba en clon limpio |

---

## 2. Decisiones de alcance (interpretaciones explícitas)

| Tema | Decisión | Motivo |
|------|----------|--------|
| Contraseña | El admin define una contraseña inicial al crear el usuario y puede restablecerla al editar | El enunciado no define registro; así un usuario creado puede iniciar sesión (A16) |
| Borrado de usuarios | **No** se implementa; se desactiva | El enunciado pide desactivar/reactivar, no eliminar |
| Rol y estado | Se leen de la BD en **cada request**, no del token | Cumple A13 y aplica cambios de rol al instante |
| Creación de nota | “Nueva nota” crea la nota en BD con valores por defecto y la coloca en la zona visible | Simple; edición posterior con Guardar |
| Guardar vs mover | Contenido → botón Guardar. Posición → autoguardado al soltar, **endpoint separado** | Mover una nota no descarta ni guarda ediciones sin confirmar |
| Concurrencia | Última escritura gana | Tiempo real e historial fuera de alcance (X1) |
| Métricas | Se recalculan al abrir/recargar el dashboard o con “Actualizar” | D3 lo permite |

---

## 3. Stack y justificación

| Capa | Elección | Por qué |
|------|----------|---------|
| Frontend | React 18 + Vite + TypeScript, React Router | Rápido de montar; build estático para S3 |
| Drag & drop | Pointer Events nativos (`setPointerCapture`) | Lienzo libre x/y; sin librería de listas/columnas |
| API | **NestJS 11** (Node 22 + TypeScript): `@nestjs/config`, `@nestjs/jwt`, `@nestjs/typeorm`, `class-validator` + `class-transformer`, `bcryptjs`, `cookie-parser` | Arquitectura modular (módulo/controlador/servicio/DTO), guards y pipes nativos para auth, roles y validación |
| ORM y migraciones | TypeORM (`synchronize: false`) con migraciones versionadas y script de seed | Integración oficial con Nest; transacciones y bloqueo pesimista para la regla del último admin |
| Invocación Lambda | `@aws-sdk/client-lambda` (`InvokeCommand`) inyectado como *provider* de Nest | Mismo código local (endpoint RIE) y en AWS (IAM); fácil de sustituir en tests |
| Base de datos | PostgreSQL 16 en contenedor, volumen `pgdata` | Transacciones; email único |
| Lambda | Node 22 **sin NestJS**, `pg`, imagen `public.ecr.aws/lambda/nodejs:22` en local (incluye Runtime Interface Emulator) | Handler mínimo (arranque en frío y tamaño); comparte con la API solo el contrato de BD |
| Tests | Jest + Supertest (API, runner por defecto de Nest), Jest (Lambda), Vitest opcional (web) | Convenciones estándar de cada herramienta |
| IaC | AWS SAM (`Transform: AWS::Serverless-2016-10-31`) sobre CloudFormation | Pedido explícito |
| Scripts | Bash (Git Bash/WSL/Linux/macOS) + AWS CLI v2 + SAM CLI | Pedido explícito |

**Herramientas de esta máquina:** Node 24, Docker 28, Compose v2.39, Git ✔ · **AWS CLI y SAM CLI no instalados** → requisito previo de S7.

---

## 4. Arquitectura

### 4.1 Local (Docker Compose, sin AWS)

```mermaid
flowchart LR
  B[Navegador] -->|:8080| W[web · nginx<br/>SPA + proxy /api]
  W -->|/api/*| A[api · NestJS :3000]
  A -->|SQL| D[(db · PostgreSQL<br/>volumen pgdata)]
  A -->|Lambda Invoke API<br/>endpoint RIE| L[metrics-lambda<br/>imagen Lambda + RIE :9000]
  L -->|SELECT status, count| D
  M[migrate · one-shot<br/>migraciones + seed] --> D
```

### 4.2 AWS

```mermaid
flowchart LR
  B[Navegador] -->|HTTPS| CF[CloudFront]
  CF -->|default · OAC| S3[(S3 · build del frontend)]
  CF -->|/api/* · HTTP| EC2[EC2 · Docker Compose<br/>api + postgres + migrate]
  EC2 -->|lambda:InvokeFunction · IAM| LM[Lambda metrics · en VPC]
  LM -->|5432 · SG a SG| EC2
```

**Puntos clave del diseño**
- El frontend siempre llama a `/api` **relativo**: en local lo enruta nginx, en AWS un *behavior* de CloudFront. Mismo build, sin CORS, cookie same-origin.
- La API es la única puerta pública; la Lambda **no** se expone (se invoca desde la API con IAM). La API valida sesión antes de invocarla.
- La Lambda consulta PostgreSQL directamente (cálculo **y** entrega en Lambda → D4).
- El bundle de la API se sube al mismo tipo de recurso ya exigido (S3) → no se añade ECR (X2).

---

## 5. Contratos compartidos (fuente de verdad para todas las sesiones)

### 5.1 Estructura del repositorio

```
/
├── api/                    NestJS + TS
│   ├── src/
│   │   ├── main.ts                     prefijo global /api, cookie-parser, pipes y filtros globales
│   │   ├── app.module.ts
│   │   ├── config/                     esquema de validación de variables (§5.5)
│   │   ├── common/                     decorators (@Public, @Roles, @CurrentUser),
│   │   │                               guards (JwtAuthGuard, RolesGuard), filters (HttpErrorFilter)
│   │   ├── database/
│   │   │   ├── data-source.ts          DataSource para la CLI de TypeORM
│   │   │   └── migrations/             esquema inicial + SeedDemoData (se aplica una vez)
│   │   ├── health/                     HealthModule
│   │   ├── auth/                       AuthModule   (controller, service, dto)
│   │   ├── users/                      UsersModule  (entity, controller, service, dto)
│   │   ├── notes/                      NotesModule  (entity, controller, service, dto)
│   │   └── metrics/                    MetricsModule (controller, service, lambda.provider)
│   ├── test/*.e2e-spec.ts              Jest + Supertest
│   └── Dockerfile
├── lambda/metrics/         handler de métricas (TS)
│   ├── src/{index,computeMetrics}.ts
│   └── Dockerfile          (imagen Lambda + RIE para local)
├── web/                    React + Vite
│   ├── src/{api,auth,pages,components}/
│   ├── nginx.conf
│   └── Dockerfile
├── infra/
│   ├── template.yaml       SAM/CloudFormation
│   ├── ec2/docker-compose.yml
│   └── env.sam-local.json
├── scripts/{deploy,teardown,smoke}.sh
├── docs/{PLANEACION.md,api.http}
├── docker-compose.yml
├── .env.example
└── README.md
```

### 5.2 Esquema de base de datos

```sql
CREATE TYPE user_role   AS ENUM ('admin', 'user');
CREATE TYPE note_status AS ENUM ('pending', 'in_progress', 'done');  -- UI: Pendiente / En curso / Hecho

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(120) NOT NULL,
  email         varchar(254) NOT NULL UNIQUE,        -- guardado en minúsculas
  password_hash text NOT NULL,
  role          user_role NOT NULL DEFAULT 'user',
  active        boolean   NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      varchar(120) NOT NULL,
  body       text NOT NULL DEFAULT '',
  status     note_status NOT NULL DEFAULT 'pending',
  pos_x      integer NOT NULL DEFAULT 40 CHECK (pos_x >= 0),
  pos_y      integer NOT NULL DEFAULT 40 CHECK (pos_y >= 0),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla de control `migrations`: la gestiona TypeORM automáticamente.
```

Las entidades TypeORM (`User`, `Note`) mapean exactamente este esquema (`pos_x`/`pos_y` → propiedades `x`/`y` con `@Column({ name: 'pos_x' })`). El SQL anterior es el **contrato**: la Lambda lo consulta directamente sin TypeORM, así que cualquier cambio de nombres debe reflejarse en §5.4.

**Seed de demostración como migración TypeORM** (`…-SeedDemoData`): TypeORM la registra en `migrations`, así que **se aplica una sola vez por base de datos**. Reiniciar el entorno nunca vuelve a crear usuarios ni notas: si el equipo borra todas las notas o cambia el correo de una cuenta demo, el cambio se mantiene. Solo `docker compose down -v` (BD nueva) vuelve a sembrar. Las contraseñas salen de `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`, con estos valores por defecto:

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | `admin@demo.test` | `Admin123!` |
| Usuario | `usuario@demo.test` | `Usuario123!` |

+ 4 notas de ejemplo en la misma migración (permiten probar el dashboard sin el tablero).

### 5.3 API REST

Errores con forma única: `{ "error": { "code": "EMAIL_TAKEN", "message": "..." } }`, producida por un `HttpErrorFilter` global (Nest por defecto responde `{statusCode, message}`; el filtro lo normaliza). La validación de DTOs usa `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, errorHttpStatusCode: 422 })`. Nunca se devuelve `password_hash` (columna con `select: false` + serialización explícita).

| Método | Ruta | Acceso | Cuerpo | Respuesta |
|--------|------|--------|--------|-----------|
| GET | `/api/health` | público | — | `200 {status, db}` |
| POST | `/api/auth/login` | público | `{email, password}` | `200 {user}` + cookie · `401 INVALID_CREDENTIALS` · `403 USER_INACTIVE` |
| POST | `/api/auth/logout` | auth | — | `204` (borra cookie) |
| GET | `/api/auth/me` | auth | — | `200 {user}` · `401` |
| GET | `/api/users` | admin | — | `200 [user]` |
| POST | `/api/users` | admin | `{name, email, password, role}` | `201 {user}` · `409 EMAIL_TAKEN` · `422` |
| PATCH | `/api/users/:id` | admin | `{name?, email?, role?, active?, password?}` | `200 {user}` · `409 EMAIL_TAKEN` · `409 LAST_ADMIN` |
| GET | `/api/notes` | auth | — | `200 [note]` |
| POST | `/api/notes` | auth | `{title?, body?, status?, x, y}` | `201 {note}` |
| PUT | `/api/notes/:id` | auth | `{title, body, status}` | `200 {note}` · `404` |
| PATCH | `/api/notes/:id/position` | auth | `{x, y}` | `200 {note}` · `404` |
| DELETE | `/api/notes/:id` | auth | — | `204` · `404` |
| GET | `/api/metrics` | auth | — | `200 {total, byStatus, generatedAt, source:"lambda"}` · `502 METRICS_UNAVAILABLE` |

Forma `user`: `{id, name, email, role, active, createdAt, updatedAt}`
Forma `note`: `{id, title, body, status, x, y, updatedAt}`

**Sesión:** JWT HS256 (8 h) en cookie `session` `httpOnly`, `SameSite=Lax`, `Secure` según `COOKIE_SECURE`.

**Autorización en Nest (convención para todas las sesiones):**
- `JwtAuthGuard` registrado como `APP_GUARD` global: lee la cookie, verifica el JWT con `JwtService`, **consulta el usuario en BD** y lanza `401` si no existe o está inactivo; adjunta el usuario (rol **desde BD**) a `request.user`. Las rutas públicas se marcan con `@Public()`.
- `RolesGuard` registrado como segundo `APP_GUARD` (el orden de registro importa): si la ruta/controlador tiene `@Roles('admin')` y el rol no coincide → `403`.
- `@CurrentUser()` decorador de parámetro para obtener el usuario autenticado.
- En la tabla, “público” = `@Public()`, “auth” = sin decorador, “admin” = `@Roles('admin')`.

### 5.4 Contrato de la Lambda

- Handler: `index.handler` · Evento: ignorado (`{}`)
- SQL: `SELECT status, COUNT(*)::int AS count FROM notes GROUP BY status`
- Respuesta: `{ "total": 7, "byStatus": { "pending": 3, "in_progress": 2, "done": 2 }, "generatedAt": "ISO-8601" }` (estados sin notas → `0`)
- Pool `pg` creado **fuera** del handler (reutilización entre invocaciones).

### 5.5 Variables de entorno

| Variable | Servicio | Local | AWS |
|----------|----------|-------|-----|
| `PORT` | api | `3000` | `3000` |
| `DATABASE_URL` | api, migrate | `postgres://app:app@db:5432/portal` | `...@db:5432/portal` (compose en EC2) |
| `JWT_SECRET` | api | `dev-secret-change-me` | parámetro `JwtSecret` (NoEcho) |
| `COOKIE_SECURE` | api | `false` | `true` |
| `METRICS_FUNCTION_NAME` | api | `function` (nombre fijo del RIE) | `${StackName}-metrics` |
| `LAMBDA_ENDPOINT` | api | `http://metrics-lambda:8080` | *(vacío → endpoint real)* |
| `AWS_REGION` | api, lambda | `us-east-1` | región del stack |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | api | `local` / `local` (ficticias, el SDK las exige) | *(no se definen; rol IAM)* |
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | lambda | `db` `5432` `app` `app` `portal` | IP privada EC2 · parámetro `DbPassword` |
| `POSTGRES_PASSWORD` | db (y compone `DATABASE_URL`) | `app` | parámetro `DbPassword` (NoEcho) |
| `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` | migrate | valores de §5.2 | parámetros `SeedAdminPassword` / `SeedUserPassword` (NoEcho) |

**Tests en el host:** `api/.env.test` (versionado, solo valores de demo) define `DATABASE_URL=postgres://app:app@localhost:5432/portal` y `JWT_SECRET`, y lo carga el setup de Jest. Los tests generan correos y títulos con sufijo aleatorio para poder repetirse sobre la BD de desarrollo.

### 5.6 Puertos locales

| Servicio | Puerto host | Uso |
|----------|-------------|-----|
| web | `8080` | **URL de la aplicación** |
| api | `3000` | pruebas directas con curl |
| metrics-lambda | `9000` | invocar el RIE con curl |
| db | `5432` | psql |

### 5.7 Convenciones

- Commits: `feat(sN): ...`, `test(sN): ...`, `docs: ...`. Un commit (o más) por sesión; nunca mezclar sesiones.
- `.gitattributes`: `*.sh text eol=lf` (evita CRLF rompiendo scripts dentro de contenedores en Windows).
- NestJS: un módulo por dominio generado con la CLI (`nest g resource <nombre> --no-spec` o `nest g module/controller/service`); lógica en servicios, controladores delgados; DTOs con `class-validator`; excepciones HTTP con `code` propio (`new ConflictException({ code: 'LAST_ADMIN', message })`).
- Nada de secretos reales en el repo; `.env.example` con valores de demo.

---

## 6. Mapa de sesiones y presupuesto

```mermaid
flowchart LR
  subgraph A[Bloque A · Núcleo]
    S1[S1 Base y persistencia] --> S2[S2 Acceso y roles]
  end
  subgraph B[Bloque B · Funcionalidades independientes]
    S3[S3 Tablero]
    S4[S4 Dashboard + Lambda]
    S5[S5 Admin usuarios]
  end
  subgraph C[Bloque C · Cierre]
    S6[S6 Integración local] --> S7[S7 AWS IaC] --> S8[S8 README + video]
  end
  S2 --> S3 & S4 & S5
  S3 & S4 & S5 --> S6
```

| # | Sesión | Tipo | Requiere | Tiempo |
|---|--------|------|----------|--------|
| S1 | Base, persistencia y esqueletos | vertical | — | 45 min |
| S2 | Acceso: autenticación, roles y sesión | vertical | S1 (contigua) | 65 min |
| S3 | Tablero de notas | vertical | Núcleo | 80 min |
| S4 | Dashboard con Lambda | vertical | Núcleo | 55 min |
| S5 | Administración de usuarios | vertical | Núcleo | 50 min |
| S6 | Integración local, persistencia y smoke test | integración | Todo el Bloque B (tras la última) | 35 min |
| S7 | Infraestructura AWS y scripts (incluye instalar AWS CLI/SAM) | infra | S6 (contigua) | 60 min |
| S8 | README (30) + grabación y subida del video (30) | entrega | S7 (contigua) | 60 min |
| | **Total planificado** | | | **7 h 30 min** |
| | **Colchón** (incluye S0: lectura del enunciado y esta planeación) | | | **30 min** |

S1 y S2 suben 5 min respecto a un backend minimalista por el andamiaje de NestJS (módulos, guards globales, TypeORM); a cambio S3 y S5 se aceleran porque reutilizan guards, filtro de errores y patrón de DTOs.

**Orden recomendado del Bloque B:** S3 (mayor peso en la evaluación y en el video) → S4 (mayor riesgo técnico) → S5.
**Si el tiempo aprieta:** recortar primero pulido visual; nunca A12–A14, T9–T11, D4 ni L6–L7.

---

## 7. Sesiones detalladas

Plantilla de cada sesión: **Objetivo · Requiere · Puntos a desarrollar · Prueba individual · Criterios de aceptación · Commit · Prompt de arranque**.

---

### S1 — Base, persistencia y esqueletos · 45 min
**Objetivo:** que `docker compose up` levante BD con esquema y cuentas demo, una API mínima y un frontend vacío servido por nginx.
**Requiere:** nada.
**Cubre:** A11, A15, T4 (esquema), L2, L3, L5, L8.

**Puntos a desarrollar**
1. Estructura de carpetas §5.1; `.gitattributes` (`*.sh eol=lf`), `.env.example`, `api/.env.test` (§5.5), ajustes a `.gitignore` (incluye `cookies.txt`).
2. `api/` con NestJS: `npx @nestjs/cli new api --package-manager npm --skip-git`. En `main.ts`: `setGlobalPrefix('api')`, `cookie-parser`, `ValidationPipe` global (§5.3), `HttpErrorFilter` global, `enableShutdownHooks()`.
3. `ConfigModule.forRoot({ isGlobal: true, validate })` con las variables de §5.5; `TypeOrmModule.forRootAsync` (`synchronize: false`, `autoLoadEntities: true`).
4. Entidades `User` y `Note` (en `users/` y `notes/`, solo entidad; sus controladores llegan en S2/S3/S5) + migración inicial que produce el esquema §5.2 + `database/data-source.ts` para la CLI.
5. Migración `SeedDemoData` (§5.2): usuarios demo con hash bcrypt calculado al ejecutarse (contraseñas desde variables) y 4 notas de ejemplo. Script npm `migration:run` (`typeorm migration:run -d dist/database/data-source.js`).
6. `HealthModule`: `GET /api/health` con `@Public()` que ejecuta `SELECT 1` vía `DataSource` (crear aquí el decorador `@Public()`; el guard que lo lee llega en S2).
7. `api/Dockerfile` multi-stage (`nest build` → runtime `node:22-alpine` con `dist/` y dependencias de producción, usuario no root).
8. `web/`: Vite + React + TS + React Router; `src/api/client.ts` (`fetch` con `credentials: 'include'`, base `/api`, parseo del error estándar); página placeholder.
9. `web/Dockerfile` multi-stage + `nginx.conf`: `location /api/` con `resolver 127.0.0.11` y `set $api http://api:3000; proxy_pass $api;` (el nombre se resuelve en cada petición; nginx no falla si arranca antes que la API), SPA fallback `try_files $uri /index.html`.
10. `docker-compose.yml`: `db` (postgres:16-alpine, volumen `pgdata`, healthcheck `pg_isready`), `migrate` (imagen api, `command: npm run migration:run`, `depends_on: db: service_healthy`), `api` (`depends_on: migrate: service_completed_successfully`, healthcheck `wget -qO- http://localhost:3000/api/health`), `web` (`depends_on: api: service_healthy`). `restart: unless-stopped` en los servicios de larga duración. Valores por defecto en el propio compose para que funcione **sin crear `.env`**.

**Prueba individual**
```bash
docker compose up -d --build
curl http://localhost:3000/api/health          # {"status":"ok","db":"ok"}
curl http://localhost:8080/api/health          # mismo resultado vía nginx
docker compose exec db psql -U app -d portal -c "select email, role, active from users;"
docker compose run --rm migrate                # segunda ejecución: "No migrations are pending", sin duplicados
docker compose down && docker compose up -d    # los datos siguen ahí
```

**Criterios de aceptación**
- [ ] Compose levanta los 4 servicios sin `.env`.
- [ ] `migrate` puede ejecutarse varias veces: no duplica ni vuelve a sembrar.
- [ ] Datos persisten tras `down`/`up` (sin `-v`).
- [ ] `http://localhost:8080` muestra el placeholder y el proxy `/api` responde.

- [ ] `docker compose exec db psql -U app -d portal -c "select * from migrations;"` muestra el esquema inicial y `SeedDemoData` aplicados una sola vez.

**Commit:** `feat(s1): estructura base NestJS, esquema TypeORM, seed demo y docker compose`

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §3, §5 y la sesión S1. Implementa exclusivamente el alcance de S1 respetando los contratos de §5. Al terminar ejecuta la “Prueba individual” y reporta cada criterio de aceptación.

---

### S2 — Acceso: autenticación, roles y sesión · 65 min
**Objetivo:** iniciar/cerrar sesión, proteger rutas por autenticación y rol, y expulsar usuarios inactivos con sesión abierta.
**Requiere:** S1 (contigua).
**Cubre:** A1, A2, A3, A4/A5 (mecanismo), A12, A13.

**Puntos a desarrollar — API**
1. `AuthModule` (importa `JwtModule.registerAsync` con `JWT_SECRET` y `TypeOrmModule.forFeature([User])`), `AuthService`, `AuthController`, `LoginDto` (`@IsEmail`, `@IsString`).
2. `POST /api/auth/login` (`@Public()`, `@HttpCode(200)`): email en minúsculas, `bcrypt.compare`, `401 INVALID_CREDENTIALS` (mensaje genérico), `403 USER_INACTIVE`; emite cookie con `@Res({ passthrough: true })`.
3. `POST /api/auth/logout` (`@HttpCode(204)`, borra cookie) y `GET /api/auth/me` (`@CurrentUser()`).
4. `common/guards/jwt-auth.guard.ts` (`APP_GUARD`): respeta `@Public()` vía `Reflector`; verifica JWT de la cookie → busca usuario en BD → si no existe o `active=false` → `UnauthorizedException` (el filtro borra la cookie); adjunta `request.user` con rol **desde BD**.
5. `common/guards/roles.guard.ts` (`APP_GUARD`, registrado **después** del anterior) + `@Roles()` → `403 FORBIDDEN`; decorador `@CurrentUser()`.
6. Tests e2e (Jest + Supertest, `Test.createTestingModule` con `AppModule` contra la BD de Compose vía `localhost:5432`, usando `api/.env.test` y datos con sufijo aleatorio): login ok, contraseña errónea, inactivo, `/me` sin cookie, usuario desactivado *después* de iniciar sesión → siguiente request `401`. Test unitario de `RolesGuard` con `ExecutionContext` simulado: rol `user` en ruta `@Roles('admin')` → `403`.

**Puntos a desarrollar — Web**
7. `AuthContext`: llama `/auth/me` al cargar; expone `user`, `login`, `logout`.
8. Página `/login` con errores diferenciados (credenciales / usuario inactivo).
9. `ProtectedRoute` y `AdminRoute`; layout con menú: Tablero, Dashboard y **Usuarios solo si admin**; nombre del usuario, rol y botón Salir.
10. Manejo global de `401` en `client.ts`: si **había** un usuario autenticado en `AuthContext`, limpiar la sesión y redirigir a `/login` con el aviso “Sesión finalizada o usuario inactivo”. Se excluyen `POST /auth/login`, que muestra su propio error, y la comprobación inicial de `/auth/me`, porque en una visita anónima el `401` es lo normal.
11. Páginas placeholder `/tablero` (inicio por defecto), `/dashboard`, `/admin/usuarios`.

**Prueba individual**
```bash
docker compose up -d --build
(cd api && npm ci && npm test -- roles && npm run test:e2e -- auth)
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"usuario@demo.test","password":"Usuario123!"}' http://localhost:3000/api/auth/login
curl -b cookies.txt http://localhost:3000/api/auth/me          # 200
docker compose exec db psql -U app -d portal -c "update users set active=false where email='usuario@demo.test';"
curl -b cookies.txt http://localhost:3000/api/auth/me          # 401
docker compose exec db psql -U app -d portal -c "update users set active=true where email='usuario@demo.test';"
```
Manual: entrar con ambas cuentas y comparar menús. Con `usuario` logueado, desactivarlo por psql y navegar: debe volver al login. Reactivarlo al final.

**Criterios de aceptación**
- [ ] Rutas autenticadas inaccesibles sin sesión (UI y API).
- [ ] Menú distinto por rol; `/admin/usuarios` redirige si el rol es `user`.
- [ ] Inactivo no entra y es expulsado en su siguiente acción.
- [ ] Logout invalida el acceso (volver atrás no muestra datos).

**Commit:** `feat(s2): autenticación con cookie JWT, guardas por rol y bloqueo de inactivos`

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §2, §5 y la sesión S2. S1 ya está en el repo. Implementa solo S2, con tests. Ejecuta la prueba individual y reporta los criterios.

---

### S3 — Tablero de notas · 80 min
**Objetivo:** lienzo libre compartido con post-its editables in situ, Guardar explícito, eliminar y arrastrar con autoguardado de posición.
**Requiere:** Núcleo (S1+S2). No depende de S4 ni S5.
**Cubre:** T1–T10, A5 (uso del tablero por ambos roles).

**Puntos a desarrollar — API**
1. `NotesModule` (`TypeOrmModule.forFeature([Note])`), `NotesController`, `NotesService`. Rutas §5.3 protegidas por el guard global (sin `@Roles`, sin chequeo de autoría: T3); `:id` con `ParseUUIDPipe`.
2. DTOs con `class-validator`: `CreateNoteDto` (`title` `@Length(1,120)` opcional, `body` `@MaxLength(2000)`, `status` `@IsEnum(NoteStatus)`, `x,y` `@IsInt @Min(0) @Max(…)`), `UpdateNoteDto` (title/body/status obligatorios), `UpdatePositionDto` (x, y). Límite del lienzo p. ej. 0–4000 / 0–3000.
3. `PUT` actualiza **solo** contenido; `PATCH /position` actualiza **solo** posición; ambos fijan `updated_by` con `@CurrentUser()`; `NotFoundException` si no existe. Serializar a la forma `note` de §5.3.
4. Tests e2e: CRUD completo, `422` por validación y por campo no permitido, `404` en id inexistente, `401` sin sesión, rol `user` puede editar/eliminar notas creadas por admin.

**Puntos a desarrollar — Web**
5. `BoardPage`: contenedor con scroll y lienzo de tamaño fijo (fondo cuadriculado), carga `GET /notes`.
6. `NoteCard` con posición absoluta; color por estado; cabecera como **asa de arrastre**.
7. Edición directa: input título, textarea texto, select estado (etiquetas en español). Estado local `draft`; botón **Guardar** habilitado solo si hay cambios; indicador guardando/guardado/error; opción descartar cambios.
8. Arrastre: `pointerdown` en el asa → `setPointerCapture` → `pointermove` actualiza posición local (limitada al lienzo) → `pointerup` → si cambió, `PATCH /position` (optimista; revierte y avisa si falla). Los inputs no inician arrastre. El borrador sin guardar **se conserva** al mover.
9. **Eliminar** con confirmación.
10. **Nueva nota**: `POST` con título “Nueva nota”, estado Pendiente, posición en el área visible; foco en el título.
11. La nota arrastrada se muestra por encima de las demás (z-index local, no persistido).

**Prueba individual**
```bash
docker compose up -d --build
(cd api && npm ci && npm run test:e2e -- notes)
```
Manual en `http://localhost:8080/tablero`:
1. Crear nota → editar título/texto/estado → Guardar → F5 → persiste.
2. Editar sin guardar → F5 → no persiste (confirma que Guardar es la acción de confirmación).
3. Arrastrar → soltar → F5 → misma posición.
4. Editar texto, arrastrar sin guardar → el borrador sigue; Guardar → persiste.
5. Eliminar → F5 → no existe.
6. Entrar como `usuario` y editar/mover/eliminar una nota creada por admin.

**Criterios de aceptación**
- [ ] Sin columnas; posición libre x/y.
- [ ] Guardar explícito para contenido; autoguardado solo de posición al soltar.
- [ ] Todo persiste tras recarga.
- [ ] Ambos roles operan sobre todas las notas.

**Commit:** `feat(s3): tablero compartido con edición in situ, guardar y drag & drop persistente`

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §2, §5 y la sesión S3. El Núcleo (S1, S2) ya está. Implementa solo S3. Prioriza que el arrastre no interfiera con la edición. Ejecuta la prueba individual y reporta.

---

### S4 — Dashboard con Lambda · 55 min
**Objetivo:** métricas calculadas y entregadas por una Lambda que se ejecuta localmente en su contenedor oficial con RIE, invocada por la API y mostradas en el dashboard.
**Requiere:** Núcleo. Usa las notas de ejemplo del seed, así que **no necesita S3**.
**Cubre:** D1–D5, L6, L7 (mecanismo principal), L3.

**Puntos a desarrollar — Lambda**
1. `lambda/metrics/src/computeMetrics.ts`: función pura `rows → {total, byStatus}` con ceros por defecto + test unitario.
2. `src/index.ts`: pool `pg` fuera del handler; ejecuta SQL §5.4; devuelve el contrato con `generatedAt`; errores registrados y relanzados.
3. `lambda/metrics/Dockerfile`: stage de build (esbuild → `dist/index.js`) → `FROM public.ecr.aws/lambda/nodejs:22`, `CMD ["index.handler"]`.
4. Servicio `metrics-lambda` en Compose (`9000:8080`, variables `PG*`, `depends_on: migrate`).

**Puntos a desarrollar — API**
5. `MetricsModule` con `metrics/lambda.provider.ts`: provider de fábrica con token `LAMBDA_CLIENT` → `new LambdaClient({ region, endpoint: LAMBDA_ENDPOINT || undefined })` usando `ConfigService`.
6. `MetricsService` (inyecta `LAMBDA_CLIENT`): `InvokeCommand({ FunctionName: METRICS_FUNCTION_NAME })`, decodificar `Payload`; si hay `FunctionError` o fallo de red → `BadGatewayException({ code: 'METRICS_UNAVAILABLE' })`.
7. `MetricsController`: `GET /api/metrics` (protegido por el guard global); añade `source: "lambda"`.
8. Variables en el servicio `api`: `LAMBDA_ENDPOINT`, `METRICS_FUNCTION_NAME=function`, credenciales ficticias `local/local`.
9. Tests: unitario de `MetricsService` con `LAMBDA_CLIENT` simulado (`200` y `502`); e2e con `.overrideProvider(LAMBDA_CLIENT)` para no depender del contenedor.

**Puntos a desarrollar — Web**
10. `DashboardPage`: tarjeta Total; tarjetas Pendiente / En curso / Hecho con cantidad y %; barra apilada de distribución; “Generado a las hh:mm · vía AWS Lambda”; botón **Actualizar**; estados de carga, vacío (0 notas) y error.

**Prueba individual**
```bash
docker compose up -d --build
(cd lambda/metrics && npm ci && npm test)
(cd api && npm ci && npm test -- metrics)
curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations -d '{}'
docker compose exec db psql -U app -d portal -c "insert into notes(title,status) values ('prueba-s4','done');"
curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations -d '{}'   # done +1
curl -s -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"usuario@demo.test","password":"Usuario123!"}' http://localhost:3000/api/auth/login
curl -s -b cookies.txt http://localhost:3000/api/metrics                                  # source: "lambda"
docker compose stop metrics-lambda && curl -s -b cookies.txt http://localhost:3000/api/metrics   # 502
docker compose start metrics-lambda
docker compose exec db psql -U app -d portal -c "delete from notes where title='prueba-s4';"
```
Manual: abrir `/dashboard` con ambos roles; cambiar datos y pulsar Actualizar.

**Criterios de aceptación**
- [ ] La cifra la calcula la Lambda (la API no cuenta notas por su cuenta).
- [ ] Funciona sin cuenta AWS ni SAM instalado.
- [ ] Refleja cambios del tablero al recargar/Actualizar.
- [ ] Error de Lambda se muestra de forma controlada.

**Commit:** `feat(s4): lambda de métricas con RIE local, endpoint /api/metrics y dashboard`

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §4, §5 y la sesión S4. El Núcleo ya está. Implementa solo S4 (Lambda + endpoint + dashboard). Ejecuta la prueba individual y reporta.

---

### S5 — Administración de usuarios · 50 min
**Objetivo:** CRUD administrativo (sin borrado) con asignación de rol, activación y la regla del último administrador activo.
**Requiere:** Núcleo. No depende de S3 ni S4.
**Cubre:** A4–A11, A13 (efecto inmediato), A14, A16 (flujo).

**Puntos a desarrollar — API**
1. `UsersController` con `@Roles('admin')` a nivel de controlador: `GET/POST/PATCH /api/users`; `UsersService` (el `UsersModule` y la entidad ya existen desde S1/S2; exportar el servicio si `AuthModule` lo reutiliza).
2. DTOs: `CreateUserDto` (`name` `@Length(1,120)`, `email` `@IsEmail` + `@Transform` a minúsculas, `role` `@IsEnum(UserRole)`, `password` `@MinLength(8)`), `UpdateUserDto` = `PartialType(CreateUserDto)` + `active` `@IsBoolean` opcional (password opcional = restablecer).
3. `ConflictException({ code: 'EMAIL_TAKEN' })` capturando `QueryFailedError` con código `23505`.
4. **Regla del último admin** con `dataSource.transaction(async (manager) => …)`: si el cambio deja al usuario sin ser admin activo (`role → user` o `active → false`), bloquear los admins activos con `createQueryBuilder(User,'u').where("u.role = 'admin' AND u.active").setLock('pessimistic_write').getMany()`; si quedarían 0 → `ConflictException({ code: 'LAST_ADMIN' })`.
5. Tests e2e: `user` → `403`; crear usuario y **iniciar sesión con él**; email duplicado; desactivar/degradar último admin → `409`; con dos admins sí se permite; desactivar usuario con sesión abierta → su siguiente request `401`; reactivar → vuelve a entrar.

**Puntos a desarrollar — Web**
6. `/admin/usuarios`: tabla (nombre, correo, rol, estado con badge, acciones).
7. Formulario crear/editar (modal o panel): nombre, correo, rol, contraseña (en edición: “dejar vacío para no cambiar”).
8. Acción Desactivar/Reactivar con confirmación; mensajes claros para `LAST_ADMIN` y `EMAIL_TAKEN`.
9. Si el admin se degrada o desactiva a sí mismo (permitido si no es el último), refrescar sesión/redirigir según corresponda.

**Prueba individual**
```bash
docker compose up -d --build
(cd api && npm ci && npm run test:e2e -- users)
```
Manual: como admin crear `ana@demo.test` (rol usuario) → salir → entrar como Ana → no ve “Usuarios”. Como admin, desactivar a Ana mientras tiene sesión en otra ventana → Ana es expulsada. Intentar desactivar al único admin → mensaje de error.

**Criterios de aceptación**
- [ ] Listar, crear, editar, asignar rol, desactivar y reactivar funcionan.
- [ ] Usuario creado puede iniciar sesión con la contraseña asignada.
- [ ] Imposible quedarse sin administradores activos (también ante peticiones simultáneas).
- [ ] Rol `user` no accede ni por UI ni por API.

**Commit:** `feat(s5): administración de usuarios con roles, activación y regla de último admin`

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §2, §5 y la sesión S5. El Núcleo ya está. Implementa solo S5 con tests, en especial la regla del último administrador. Ejecuta la prueba individual y reporta.

---

### S6 — Integración local, persistencia y smoke test · 35 min
**Objetivo:** demostrar que el proyecto completo corre desde un clon limpio y que todo persiste al reiniciar el entorno.
**Requiere:** S1–S5; va justo después de la última sesión del Bloque B.
**Cubre:** T11, L1, L6, E6 y verificación de toda la matriz §1.

**Puntos a desarrollar**
1. Revisar el Compose final (healthchecks, `restart`, orden de arranque y volumen de S1) con el servicio `metrics-lambda` añadido en S4.
2. `scripts/smoke.sh` (bash + curl): health → login admin → leer `/metrics` → crear nota → mover → `/metrics` muestra el total **+1** (comparación relativa, sin valores fijos) → eliminar → logout → `/me` = `401`. Sale con código ≠ 0 al primer fallo.
3. Commit de S6 **antes** de clonar (el clon solo ve lo commiteado) y `docker compose down` en el repo de trabajo (libera los puertos 8080/3000/9000/5432).
4. Prueba desde clon limpio en carpeta temporal: `git clone` → `docker compose up -d --build` → smoke.
5. Prueba de persistencia: mover notas → `down` → `up` → mismas posiciones. Borrar **todas** las notas → `down` → `up` → el tablero sigue vacío (el seed no se repite). Documentar que `down -v` reinicia los datos y vuelve a sembrar.
6. Recorrer la matriz §1 (A*, T*, D*, L*) marcando evidencia; anotar pendientes en §10.

**Prueba individual**
```bash
# 1) Repo de trabajo: liberar puertos y commitear
docker compose down
git add -A && git commit -m "chore(s6): smoke test e integración final del entorno local"
# 2) Clon limpio
rm -rf "$TEMP/portal-check" && git clone . "$TEMP/portal-check" && cd "$TEMP/portal-check"
docker compose up -d --build && bash scripts/smoke.sh
# 3) Persistencia sin re-seed
docker compose exec db psql -U app -d portal -c "delete from notes;"
docker compose down && docker compose up -d && bash scripts/smoke.sh
docker compose exec db psql -U app -d portal -c "select count(*) from notes;"   # 0
# 4) Limpieza
docker compose down -v && cd - && rm -rf "$TEMP/portal-check"
```

**Criterios de aceptación**
- [ ] Clon limpio funciona sin pasos manuales extra.
- [ ] Smoke test verde antes y después de reiniciar.
- [ ] Borrar todas las notas y reiniciar no hace reaparecer las de ejemplo.
- [ ] Matriz §1 revisada; pendientes registrados.

**Commit:** hecho en el paso 1 de la prueba (si hay correcciones posteriores: `fix(s6): ...`).

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §1, §5 y la sesión S6. S1–S5 están terminadas. Crea el smoke test, valida el clon limpio y la persistencia, y devuélveme la matriz §1 con el estado de cada requisito.

---

### S7 — Infraestructura AWS (SAM/CloudFormation) y scripts · 60 min
**Objetivo:** plantilla IaC y scripts de despliegue/retirada que correspondan exactamente al proyecto local.
**Requiere:** S6 (contigua; usa los Dockerfiles y el handler finales). **Primer paso de la sesión (≈10 min, cuenta en el tiempo):** instalar AWS CLI v2 y SAM CLI (`winget install Amazon.AWSCLI` · `winget install Amazon.SAM-CLI`).
**Cubre:** W1–W9, X2, L7 (mecanismo alternativo).

**Puntos a desarrollar — `infra/template.yaml`**
1. **Parameters:** `VpcId`, `SubnetId` (subred pública, p. ej. VPC por defecto), `InstanceType` (`t3.micro`), `LatestAmiId` (`AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>` → AL2023), `ArtifactBucket`, `ApiBundleKey`, `DbPassword` (NoEcho), `JwtSecret` (NoEcho), `SeedAdminPassword` / `SeedUserPassword` (NoEcho), `KeyName` + `AllowedSshCidr` (opcionales, condición `HasSsh`). Requisitos que se documentan: la subred debe tener ruta a un Internet Gateway y la VPC debe tener *DNS hostnames* habilitados (la VPC por defecto cumple ambos).
2. **Frontend:** `FrontendBucket` (bloqueo de acceso público) · `FrontendOAC` · `FrontendBucketPolicy` (principal `cloudfront.amazonaws.com` con `AWS:SourceArn` de la distribución) · `SpaRewriteFunction` (CloudFront Function en *viewer-request* del behavior por defecto).
3. **Distribution:** origen S3 (OAC) por defecto con `CachingOptimized`; origen EC2 (`PublicDnsName`, HTTP 80) en behavior `/api/*` con `CachingDisabled`, `AllViewerExceptHostHeader`, todos los métodos. **No usar `CustomErrorResponses` para el SPA**: enmascararía los `401/403/404` de la API.
4. **EC2:** `ApiSecurityGroup` (80 entrante; 22 solo con `HasSsh`) · `ApiInstanceRole` + `InstanceProfile` (`s3:GetObject` del bundle y `lambda:InvokeFunction` sobre el ARN construido con `!Sub`) · `ApiInstance` con `NetworkInterfaces` (`AssociatePublicIpAddress: true`, `DeviceIndex: 0`, `SubnetId`, `GroupSet`), para que exista `PublicDnsName` (origen de CloudFront) y salida a Internet sin NAT. UserData: instala Docker y el plugin compose, descarga el bundle de S3, escribe `.env` con **los mismos nombres de §5.5** (`JWT_SECRET`, `POSTGRES_PASSWORD`, `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD`, `COOKIE_SECURE=true`, `METRICS_FUNCTION_NAME`, `AWS_REGION`) y ejecuta `docker compose up -d --build`.
5. **Lambda:** `MetricsFunction` (`AWS::Serverless::Function`, `nodejs22.x`, `FunctionName: !Sub ${AWS::StackName}-metrics`, `Metadata: BuildMethod: esbuild`, `VpcConfig` con `LambdaSecurityGroup` en `SubnetId`, env `PGHOST: !GetAtt ApiInstance.PrivateIp`) · `MetricsLogGroup` (`/aws/lambda/${AWS::StackName}-metrics`, retención 7 días), para que el log group sea parte del stack y se elimine con él · `AWS::EC2::SecurityGroupIngress` separado: 5432 desde `LambdaSecurityGroup` hacia `ApiSecurityGroup` (evita la dependencia circular).
6. **Outputs:** `CloudFrontUrl`, `FrontendBucketName`, `DistributionId`, `ApiInstanceId`, `MetricsFunctionName`.
7. `infra/ec2/docker-compose.yml`: `db` (publica 5432 hacia la VPC, restringido por SG) + `migrate` + `api` (`80:3000`), mismas imágenes/Dockerfiles que en local; `DATABASE_URL` se compone a partir de `POSTGRES_PASSWORD`.

**Puntos a desarrollar — scripts**
8. `scripts/deploy.sh` (parámetros por variables de entorno, con validación):
   1. comprobar `aws`, `sam`, `node`, identidad (`aws sts get-caller-identity`);
   2. crear `ArtifactBucket` si no existe; empaquetar `api/` + `infra/ec2/docker-compose.yml` → subir `api-<git-sha>.zip`;
   3. `sam build` → `sam deploy --stack-name … --capabilities CAPABILITY_IAM --s3-bucket "$ARTIFACT_BUCKET" --parameter-overrides …` (reutiliza el bucket de artefactos; **no** `--resolve-s3`, que crea un stack gestionado que teardown no retira);
   4. leer Outputs; `npm ci && npm run build` en `web/`; `aws s3 sync web/dist s3://<FrontendBucket> --delete`;
   5. `aws cloudfront create-invalidation --paths "/*"`; imprimir URL y cuentas demo.
9. `scripts/teardown.sh`: vaciar `FrontendBucket` → `sam delete --no-prompts` (elimina también el log group del stack) → vaciar y borrar `ArtifactBucket` → verificar con `aws cloudformation describe-stacks` que el stack ya no existe.
10. `infra/env.sam-local.json` + instrucciones de `sam local invoke MetricsFunction` contra la BD local (`PGHOST=host.docker.internal`).

**Prueba individual (sin cuenta AWS)**
```bash
sam validate --lint -t infra/template.yaml
sam build -t infra/template.yaml
docker compose up -d db migrate
sam local invoke MetricsFunction --env-vars infra/env.sam-local.json   # sin -t: usa .aws-sam/build (el handler compilado)
bash -n scripts/deploy.sh && bash -n scripts/teardown.sh
```
*(Opcional, con cuenta y costo asumido: `deploy.sh` → probar URL → `teardown.sh`.)*

**Criterios de aceptación**
- [ ] Plantilla válida y con lint limpio; sin dependencias circulares.
- [ ] Mismos nombres de variables, handler y Dockerfiles que en local (W9).
- [ ] Deploy y teardown documentados con parámetros y requisitos (W7).
- [ ] Solo EC2, Lambda, S3, CloudFront + recursos de conexión (IAM, SG, log group; AMI resuelta con parámetro público SSM) (X2).
- [ ] Teardown no deja recursos creados por la app (stack, buckets, log group).

**Commit:** `feat(s7): infraestructura SAM/CloudFormation y scripts de despliegue y retirada`

**Prompt de arranque**
> Lee `docs/PLANEACION.md` §4, §5 y la sesión S7. El proyecto local está completo. Genera la plantilla SAM y los scripts de S7 correspondiendo exactamente al código actual. Valida con `sam validate --lint` y `sam local invoke`, y reporta.

---

### S8 — README, entrega y video · 60 min (README 30 + video 30)
**Objetivo:** que un revisor pueda ejecutar, entender y evaluar el proyecto sin asistencia.
**Requiere:** S7 (contigua).
**Cubre:** G2, A16, L4, W7, W10, E1–E6.

**Puntos a desarrollar**
1. `README.md` con la estructura de §8.1.
2. Diagrama de arquitectura (reutilizar §4) y enlace a este documento.
3. Completar §10 con tiempos reales y pendientes → copiar al README.
4. Grabar el video siguiendo §8.2 (≤ 8 min) y subirlo con enlace accesible.
5. El README referencia el **tag** `entrega-v1`, no el hash (escribir el hash obliga a otro commit que cambia el hash). Commit final → `git tag entrega-v1` → `git push origin main --tags` a un repositorio accesible para el revisor (o un zip si no hay repo compartible) → el **hash** (`git rev-parse entrega-v1`) va en el mensaje de entrega.

**Criterios de aceptación**
- [ ] Todas las secciones obligatorias del README presentes (E3).
- [ ] Video ≤ 8:00 cubre todos los puntos de E4.
- [ ] Repo y tag visibles desde una cuenta sin permisos de escritura; hash en el mensaje de entrega (E1, E2).

**Commit:** `docs(s8): README de entrega` · `git tag entrega-v1` · `git push origin main --tags`

---

## 8. Entregables

### 8.1 Estructura del README

1. Descripción y stack (incluye uso de IA)
2. **Requisitos:** para ejecutar, solo Docker Desktop / Docker Engine + Compose v2 · para las pruebas automatizadas, Node 22, bash (Git Bash/WSL) y curl · para desplegar, AWS CLI v2, SAM CLI, Node 22 y cuenta AWS
3. **Arranque local:** `docker compose up -d --build` → `http://localhost:8080`
4. **Cuentas demo** (§5.2) y cómo se cargan (servicio `migrate` → migración `SeedDemoData`, se aplica una sola vez)
5. **Cómo inicia sesión un usuario creado:** el admin lo crea con contraseña inicial → el usuario entra con ese correo y contraseña
6. **Uso:** tablero (crear, editar + Guardar, mover, eliminar), dashboard (Actualizar), usuarios (solo admin)
7. **Persistencia:** volumen `pgdata`; `down` conserva, `down -v` reinicia y re-siembra
8. **Lambda en local:** RIE en Compose (curl de ejemplo) y alternativa `sam local invoke`
9. **Arquitectura** local y AWS (diagramas + decisiones de §2)
10. **Despliegue AWS:** parámetros, requisitos, `deploy.sh`, costos esperados
11. **Retirada AWS:** `teardown.sh`
12. **Pruebas:** `npm test` y `npm run test:e2e` (api), `npm test` (lambda) + `scripts/smoke.sh`
13. **Tiempo empleado** (por sesión) y **limitaciones / pendientes**
14. Versión entregada (tag `entrega-v1`), enlace al video y URL AWS si existe

### 8.2 Guion del video (≤ 8 min)

| Min | Contenido | Requisitos |
|-----|-----------|-----------|
| 0:00–0:45 | Presentación, stack, estructura del repo | E4 organización |
| 0:45–1:45 | Arquitectura local y AWS (diagrama), dónde vive la Lambda | E4 arquitectura, D4 |
| 1:45–2:30 | `docker compose up`, login admin; acceso sin sesión redirige | A1, A3, L1 |
| 2:30–4:00 | Tablero: crear, editar + Guardar, mover, eliminar; F5 conserva contenido y posición | T5–T10 |
| 4:00–4:45 | Dashboard: cifras; volver al tablero, cambiar estado, Actualizar | D1–D3 |
| 4:45–6:15 | Usuarios: crear, editar rol, desactivar (sesión abierta expulsada), reactivar, bloqueo del último admin | A6–A14 |
| 6:15–6:45 | Login como usuario creado: sin menú de administración | A5, A16 |
| 6:45–7:30 | Reinicio de Compose y persistencia; plantilla SAM y scripts de deploy/teardown | T11, W4–W6 |
| 7:30–8:00 | Tiempo empleado y pendientes | G2 |

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| El SDK de AWS exige credenciales incluso contra el RIE local | Credenciales ficticias `local/local` en el servicio `api` |
| Arrastrar mientras se edita dispara guardado o pierde el borrador | Asa de arrastre separada + endpoint de posición independiente |
| Scripts con CRLF fallan en contenedores (Windows) | `.gitattributes` con `eol=lf` desde S1 |
| nginx arranca antes que la API y muere resolviendo `api` | `depends_on: api: service_healthy` + `resolver 127.0.0.11` con `proxy_pass` variable |
| El seed vuelve a crear datos al reiniciar | Seed como migración TypeORM (se aplica una vez) + prueba en S6 |
| Pruebas que dependen de cookies o datos de otra sesión | Cada prueba hace su propio login y limpia lo que crea |
| `CustomErrorResponses` de CloudFront reescriben errores de `/api` | CloudFront Function solo en el behavior por defecto |
| Contenido mixto (CloudFront HTTPS → API HTTP) | API servida detrás de CloudFront en `/api/*`, nunca llamada directo |
| Dependencia circular EC2 ↔ Lambda en la plantilla | `FunctionName` con `!Sub`, ingress de SG como recurso aparte |
| Cambiar el bundle no re-ejecuta UserData | Documentar como limitación: para actualizar, `teardown` + `deploy` (o SSH con `HasSsh`) |
| Carrera al desactivar dos admins a la vez | Transacción TypeORM + `setLock('pessimistic_write')` |
| Migraciones TypeORM apuntando a `.ts` dentro del contenedor | `data-source.ts` con rutas a `dist/**/*.js` en runtime; probar `migrate` en Docker desde S1 |
| Guards globales en orden incorrecto (`RolesGuard` antes de tener `request.user`) | Registrar `JwtAuthGuard` y luego `RolesGuard` como `APP_GUARD`; test unitario del guard |
| `ValidationPipe` de Nest devuelve `400` y otra forma de error | `errorHttpStatusCode: 422` + `HttpErrorFilter` global (§5.3) |
| Exceder las 8 h | Colchón de 30 min; recorte de pulido visual; registrar pendientes |
| Secretos como parámetros NoEcho / variables de entorno | Declararlo como limitación (Secrets Manager añadiría servicios) |

---

## 10. Registro de tiempo y pendientes

| Sesión | Fecha | Inicio | Fin | Minutos | Estado | Pendientes / notas |
|--------|-------|--------|-----|---------|--------|--------------------|
| S0 | | | | | | Lectura del enunciado + planeación (sale del colchón) |
| S1 | | | | | | |
| S2 | | | | | | |
| S3 | | | | | | |
| S4 | | | | | | |
| S5 | | | | | | |
| S6 | 2026-09-15 | | | | Hecho | `scripts/smoke.sh` verde en el repo y en un clon limpio (sin `.env`), antes y después de `down`/`up`. Posiciones iguales tras reiniciar; borrar todas las notas + reiniciar → 0 (el seed no se repite); `down -v` → vuelve a sembrar 4 notas y 2 cuentas. API 19 unit + 95 e2e, Lambda 4, tsc/eslint/typecheck web limpios. El build del clon reutilizó la caché de capas de Docker. Pendiente: W*/X2/L7-alt → S7; README (A16, L4, G2, E*) → S8; backlog de calidad de S1 (cobertura, `lint` con `--fix`, `X-Powered-By`, puerto 5432 fijo) |
| S7 | 2026-09-15 | | | | Hecho (sin despliegue real) | AWS CLI 2.36.45 y SAM CLI 1.166.2 instalados con winget. `sam validate --lint` limpio (cfn-lint sin hallazgos, sin ciclos); `sam build` (esbuild) OK; `sam local invoke` = RIE de Compose = BD (6 notas). `infra/ec2/docker-compose.yml` probado en local desde un bundle `git archive`: health en :80, cookie `Secure`, `/metrics` sin Lambda real → `502 METRICS_UNAVAILABLE`; exige los secretos. UserData renderizado pasa `bash -n`. `deploy.sh`/`teardown.sh`: `bash -n` y validaciones de parámetros probadas; **deploy/teardown contra AWS no ejecutados** (sin cuenta). Añadidos al plan: `CreationPolicy` + `cfn-signal` (el stack espera a `/api/health`), swap de 2 GB (t3.micro), Compose/buildx fijados a las versiones locales, IMDSv2 con 2 saltos, `scripts/aws-common.sh`. En Windows: `sam.cmd`, CRLF de la AWS CLI y esbuild en PATH resueltos en los scripts. Limitaciones → README (S8): el bundle de la API no se actualiza en un stack existente (teardown + deploy), secretos en UserData/NoEcho, :80 de EC2 abierto a Internet (no solo a CloudFront), BD en el disco de la instancia |
| S8 | 2026-09-15 | | | | README y guion hechos; faltan video, tiempos y tag | Por decisión del candidato, en lugar del video se entrega `docs/GUION_VIDEO.md` (guion cronometrado ≤ 8 min, 9 bloques que cubren E4) para grabarlo él. README con las 14 secciones de §8.1 + solución de problemas. Portabilidad: puertos del host configurables (`WEB_PORT`, `API_PORT`, `LAMBDA_PORT`, `DB_PORT`), puertos de depuración en 127.0.0.1, healthchecks sin `start_interval` (Docker Engine < 25), `.gitattributes` con `eol=lf` global. Verificado en un clon con `core.autocrlf=true`: 111 archivos con LF, `build --no-cache --pull` + `up` con puertos alternos desde `.env`, smoke OK, e2e 95/95 contra la BD del clon con `DATABASE_URL`. Pendiente del candidato: tiempo efectivo por sesión (README §13), grabar el video y enlazarlo, `git tag entrega-v1` + push |
| **Total** | | | | | | |
