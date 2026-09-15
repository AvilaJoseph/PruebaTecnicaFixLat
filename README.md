# Portal de equipo con tablero de notas

Aplicación web para un equipo: inicio de sesión con dos roles, un **tablero compartido** de notas
tipo post-it que se editan y arrastran libremente, un **dashboard** cuyas métricas calcula una
**AWS Lambda**, y **administración de usuarios**. Corre completa en local con Docker Compose (sin
cuenta de AWS) e incluye la infraestructura como código y los scripts para desplegarla en AWS.

- **Guion de la presentación:** [docs/GUION_VIDEO.md](docs/GUION_VIDEO.md)
- **Planeación, decisiones y contratos:** [docs/PLANEACION.md](docs/PLANEACION.md)
- **Versión entregada:** tag `entrega-v1` del repositorio (`git checkout entrega-v1`)

## Contenido

1. [Arranque rápido](#1-arranque-rápido)
2. [Requisitos](#2-requisitos)
3. [Cuentas demo y usuarios nuevos](#3-cuentas-demo-y-usuarios-nuevos)
4. [Uso](#4-uso)
5. [Persistencia e inicialización](#5-persistencia-e-inicialización)
6. [Lambda en local](#6-lambda-en-local)
7. [Arquitectura](#7-arquitectura)
8. [Despliegue en AWS](#8-despliegue-en-aws)
9. [Retirada de AWS](#9-retirada-de-aws)
10. [Pruebas](#10-pruebas)
11. [Solución de problemas](#11-solución-de-problemas)
12. [Stack y uso de IA](#12-stack-y-uso-de-ia)
13. [Tiempo empleado, limitaciones y pendientes](#13-tiempo-empleado-limitaciones-y-pendientes)

---

## 1. Arranque rápido

Solo se necesita **Docker** (sección 2). No hace falta instalar Node ni crear archivos `.env`.

```bash
git clone https://github.com/AvilaJoseph/PruebaTecnicaFixLat.git
cd PruebaTecnicaFixLat
docker compose up -d --build
```

La primera vez tarda unos minutos, porque descarga las imágenes base y compila la API, la web y la
Lambda. El comando termina cuando los contenedores están creados. La app está lista cuando
`docker compose ps` muestra `api` como `healthy` y `web` como `running`:

```bash
docker compose ps
```

Abre **<http://localhost:8080>** y entra con `admin@demo.test` / `Admin123!`.

> ¿Error `port is already allocated`? Otro programa usa ese puerto: consulta
> [Solución de problemas](#11-solución-de-problemas). Se arregla con una variable, sin tocar código.

Comprobación rápida desde la terminal:

```bash
# bash, macOS, Linux o Git Bash
curl http://localhost:8080/api/health          # {"status":"ok","db":"ok"}

# PowerShell (Windows)
Invoke-RestMethod http://localhost:8080/api/health
```

Para detener: `docker compose down` (conserva los datos). Para empezar de cero:
`docker compose down -v`.

## 2. Requisitos

| Para | Necesitas |
|------|-----------|
| **Ejecutar la app** | Docker Desktop (Windows con WSL 2, macOS Intel o Apple Silicon) o Docker Engine en Linux, con **Compose v2** (`docker compose version`). Unos 3 GB libres en disco, conexión a Internet en el primer arranque y los puertos 8080, 3000, 9000 y 5432 libres (o cambiados, ver sección 11). |
| Ejecutar las pruebas automatizadas | Node.js 22 y npm; para `scripts/smoke.sh`, bash y curl (en Windows, Git Bash). |
| Desplegar en AWS | Cuenta de AWS con credenciales, AWS CLI v2, AWS SAM CLI, Node.js 22, git y bash (sección 8). |

Todas las imágenes (`postgres:16-alpine`, `node:22-alpine`, `nginx:1.30-alpine` y
`public.ecr.aws/lambda/nodejs:22`) son multiarquitectura: funcionan igual en x86_64 y en ARM64. Los
archivos se guardan con finales de línea LF en cualquier sistema operativo (`.gitattributes`).

## 3. Cuentas demo y usuarios nuevos

| Rol | Correo | Contraseña | Acceso |
|-----|--------|-----------|--------|
| Administrador | `admin@demo.test` | `Admin123!` | Tablero, dashboard y usuarios |
| Usuario | `usuario@demo.test` | `Usuario123!` | Tablero y dashboard |

**Cómo se cargan.** El servicio `migrate` de Compose aplica las migraciones de TypeORM al arrancar.
Una de ellas, `SeedDemoData`, crea estas dos cuentas y 4 notas de ejemplo. TypeORM la registra en la
tabla `migrations`, así que **se aplica una sola vez por base de datos**: reiniciar el entorno no
duplica datos ni restaura notas borradas. Las contraseñas salen de `SEED_ADMIN_PASSWORD` y
`SEED_USER_PASSWORD` (ver `.env.example`).

**Cómo inicia sesión un usuario creado desde la app.** Un administrador va a **Usuarios → Nuevo
usuario** y define nombre, correo, rol y una **contraseña inicial** (mínimo 8 caracteres). El nuevo
usuario entra por la pantalla de login con ese correo y esa contraseña. El administrador puede
restablecerla después desde **Editar**.

## 4. Uso

**Tablero** (ambos roles, sobre todas las notas)
- **+ Nueva nota** crea una nota «Nueva nota» en estado Pendiente dentro del área visible.
- El título, el texto y el estado (Pendiente / En curso / Hecho) se editan **sobre la nota**. La
  nota indica «Cambios sin guardar», y los cambios se confirman con **Guardar**.
- Para **mover** una nota se arrastra desde su cabecera. Al soltarla, la posición se guarda
  automáticamente, sin tocar las ediciones pendientes.
- La papelera **elimina** la nota, con confirmación.
- Contenido, estado y posición se conservan al recargar y al reiniciar el entorno.

**Dashboard** (ambos roles): total de notas y distribución por estado, calculados por la Lambda.
Se recalcula al abrirlo o con **Actualizar**.

**Usuarios** (solo administrador): listar, crear, editar (nombre, correo, rol, contraseña),
**Desactivar** y **Reactivar**.
- Un usuario inactivo no puede iniciar sesión. Si ya tenía una sesión abierta, su siguiente acción
  lo devuelve al login, porque el estado se comprueba en la base de datos en cada petición.
- Siempre debe quedar **al menos un administrador activo**. La API rechaza, con `409 LAST_ADMIN`,
  desactivar o quitar el rol al último, incluso si llegan dos peticiones a la vez.
- Un usuario con rol *Usuario* no ve el menú y la API le responde `403`.

**API REST** (prefijo `/api`, sesión en cookie `httpOnly`; contrato completo en
[PLANEACION §5.3](docs/PLANEACION.md#53-api-rest))

| Método y ruta | Acceso |
|---------------|--------|
| `GET /api/health` | público |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | público / sesión / sesión |
| `GET POST /api/notes` · `PUT DELETE /api/notes/:id` · `PATCH /api/notes/:id/position` | sesión |
| `GET /api/metrics` | sesión |
| `GET POST /api/users` · `PATCH /api/users/:id` | administrador |

## 5. Persistencia e inicialización

- **Almacenamiento:** PostgreSQL 16 en el volumen Docker `pgdata`.
- **Inicialización:** el servicio `migrate` (una sola ejecución, antes de la API) aplica el esquema y
  el seed. Se puede relanzar sin efectos: `docker compose run --rm migrate` → «No migrations are
  pending».
- `docker compose down` + `docker compose up -d` → **todo se conserva**: notas, posiciones y
  usuarios.
- `docker compose down -v` → borra el volumen. El siguiente `up` crea la base de datos de cero y
  vuelve a sembrar las cuentas y notas demo.

## 6. Lambda en local

La Lambda (`lambda/metrics`, handler `index.handler`) ejecuta
`SELECT status, COUNT(*) FROM notes GROUP BY status` y devuelve
`{ total, byStatus: { pending, in_progress, done }, generatedAt }`.

**Mecanismo principal: RIE en Compose.** El servicio `metrics-lambda` usa la imagen oficial de AWS
Lambda, que incluye el *Runtime Interface Emulator*. La API la invoca con el mismo SDK de AWS
(`InvokeCommand`) que usaría en la nube, apuntando al emulador con credenciales ficticias. No hace
falta cuenta de AWS. Para invocarla directamente:

```bash
curl -X POST http://localhost:9000/2015-03-31/functions/function/invocations -d '{}'
```
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:9000/2015-03-31/functions/function/invocations -Body '{}'
```

**Alternativa: AWS SAM CLI** (requiere SAM CLI y Docker), con la misma plantilla que se despliega y
contra la base de datos de Compose:

```bash
docker compose up -d db migrate
sam build -t infra/template.yaml
sam local invoke MetricsFunction --env-vars infra/env.sam-local.json
```

## 7. Arquitectura

### Local (Docker Compose)

```mermaid
flowchart LR
  B[Navegador] -->|:8080| W[web · nginx<br/>SPA + proxy /api]
  W -->|/api/*| A[api · NestJS :3000]
  A -->|SQL| D[(db · PostgreSQL<br/>volumen pgdata)]
  A -->|Lambda Invoke API<br/>endpoint RIE| L[metrics-lambda<br/>imagen Lambda + RIE]
  L -->|SELECT status, count| D
  M[migrate · una ejecución<br/>migraciones + seed] --> D
```

### AWS

```mermaid
flowchart LR
  B[Navegador] -->|HTTPS| CF[CloudFront]
  CF -->|por defecto · OAC| S3[(S3 · build del frontend)]
  CF -->|/api/* · sin caché| EC2[EC2 · Docker Compose<br/>api + postgres + migrate]
  EC2 -->|lambda:InvokeFunction · rol IAM| LM[Lambda metrics · en la VPC]
  LM -->|5432 · security group| EC2
```

### Decisiones principales

| Tema | Decisión |
|------|----------|
| Un solo origen | El frontend llama siempre a `/api` relativo. En local lo enruta nginx y en AWS un *behavior* de CloudFront: mismo build, sin CORS, cookie same-origin. |
| Métricas | La API valida la sesión e invoca la Lambda. La Lambda consulta PostgreSQL y calcula la respuesta, y la API solo comprueba que cumple el contrato. La Lambda no se expone públicamente. |
| Sesión | JWT de 8 h en cookie `httpOnly` y `SameSite=Lax`. Rol y estado se leen de la BD **en cada petición**, así que desactivar o cambiar el rol tiene efecto inmediato. |
| Guardar vs. mover | El contenido se confirma con **Guardar** (`PUT`). La posición se guarda al soltar, por un endpoint separado (`PATCH /position`): mover no guarda ni descarta ediciones. |
| Último administrador | Transacción con bloqueo pesimista sobre los administradores activos. |
| Contraseñas | Las define el administrador (no hay registro público); los usuarios no se borran, se desactivan. |
| Concurrencia | La última escritura gana (tiempo real e historial quedan fuera del alcance). |

### Estructura del repositorio

```
api/              API NestJS (auth, users, notes, metrics, health) + migraciones TypeORM + tests
lambda/metrics/   Lambda de métricas (TypeScript, pg) + Dockerfile con RIE
web/              SPA React + Vite, servida por nginx (nginx.conf: proxy /api)
infra/            template.yaml (SAM/CloudFormation), ec2/docker-compose.yml, env.sam-local.json
scripts/          smoke.sh (prueba integral), deploy.sh, teardown.sh, aws-common.sh
docs/             PLANEACION.md (plan y contratos), GUION_VIDEO.md
docker-compose.yml, .env.example
```

## 8. Despliegue en AWS

> **Estado:** la infraestructura está validada (`sam validate --lint`, `sam build`,
> `sam local invoke`, compose de EC2 probado en local), pero **no se ha desplegado en una cuenta
> real**, así que no hay URL pública. Ver sección 13.

**Recursos (`infra/template.yaml`, AWS SAM sobre CloudFormation).** Solo EC2, Lambda, S3 y
CloudFront, más los recursos de conexión: IAM, security groups, un log group de CloudWatch y el
parámetro público de SSM para la AMI.

| Recurso | Qué hace |
|---------|----------|
| `FrontendBucket` + `FrontendOAC` + `Distribution` | Build de la SPA en un bucket privado, servido solo por CloudFront con HTTPS. `/api/*` se reenvía a EC2 sin caché. Una CloudFront Function sirve `index.html` en las rutas de la SPA sin enmascarar los errores de la API. |
| `ApiInstance` (Amazon Linux 2023) | El UserData instala Docker, descarga el bundle (`api/` + `infra/ec2/`) desde S3, escribe `.env` con **los mismos nombres de variables que en local** y ejecuta `docker compose up -d --build`. El stack espera a que `/api/health` responda (`cfn-signal`). |
| `MetricsFunction` + `MetricsLogGroup` | La misma Lambda (`index.handler`, empaquetada con esbuild), dentro de la VPC. Conecta con PostgreSQL por la IP privada de la instancia y su log group tiene 7 días de retención. |
| `ApiSecurityGroup`, `LambdaSecurityGroup`, `DbIngressFromLambda` | HTTP 80 hacia la API, 5432 solo desde la Lambda y SSH opcional desde un CIDR. |
| `ApiInstanceRole` | Solo `s3:GetObject` del bundle y `lambda:InvokeFunction` sobre la función de métricas. |

**Requisitos**
- Cuenta de AWS y credenciales (`aws configure`, `aws sso login` o `AWS_PROFILE`) con permisos
  sobre CloudFormation, EC2, IAM, Lambda, S3, CloudFront y CloudWatch Logs.
- AWS CLI v2, AWS SAM CLI, Node.js 22 + npm, git y bash (Git Bash, WSL, Linux o macOS). Docker no es
  necesario para desplegar.
- Una VPC con *DNS hostnames* habilitado y una subred con ruta a un Internet Gateway. La VPC por
  defecto cumple ambas cosas y el script la detecta sola.
- Los cambios de `api/` deben estar commiteados: el bundle se genera desde `HEAD` con `git archive`.

**Ejecución**

```bash
export DB_PASSWORD="$(openssl rand -hex 16)"
export JWT_SECRET="$(openssl rand -hex 32)"
bash scripts/deploy.sh
```

Pasos del script: validación de parámetros e identidad → bucket de artefactos → bundle de la API →
`sam build` + `sam deploy` → build de la web → `aws s3 sync` → invalidación de CloudFront. Al
terminar imprime la URL de CloudFront y el comando para ejecutar `scripts/smoke.sh` contra ella. La
primera vez tarda ~15-20 min.

**Parámetros** (variables de entorno)

| Variable | Obligatoria | Por defecto | Descripción |
|----------|:-----------:|-------------|-------------|
| `DB_PASSWORD` | sí | — | Contraseña de PostgreSQL, 12-64 caracteres `[A-Za-z0-9._~-]` |
| `JWT_SECRET` | sí | — | Secreto del JWT, 32-256 caracteres `[A-Za-z0-9._~-]` |
| `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` | no | `Admin123!` / `Usuario123!` | Contraseñas de las cuentas demo |
| `STACK_NAME` | no | `portal-notas` | Nombre del stack (minúsculas, números y guiones) |
| `AWS_REGION` | no | la de `aws configure`, o `us-east-1` | Región |
| `ARTIFACT_BUCKET` | no | `<STACK_NAME>-artifacts-<cuenta>` | Bucket del bundle y del paquete de la Lambda |
| `INSTANCE_TYPE` | no | `t3.micro` | `t3.micro`, `t3.small` o `t3.medium` |
| `VPC_ID` / `SUBNET_ID` | no | VPC por defecto y una subred pública | Red donde se crea la instancia |
| `KEY_NAME` + `ALLOWED_SSH_CIDR` | no | — | Juntas: habilitan SSH solo desde ese CIDR |

**Costo aproximado** (precios de referencia en `us-east-1`; confirmar en la calculadora de AWS):
t3.micro ~0,0104 USD/h, IPv4 pública ~0,005 USD/h y 20 GB de gp3 ~1,6 USD/mes, más céntimos de
Lambda, S3 y CloudFront con uso de demostración. En total, **unos 0,02 USD por hora** mientras el
stack existe.

## 9. Retirada de AWS

```bash
bash scripts/teardown.sh          # pide confirmación; --yes para omitirla
```

Usa las mismas `STACK_NAME`, `AWS_REGION` y `ARTIFACT_BUCKET` que el despliegue. Vacía el bucket del
frontend → `sam delete` (CloudFront, EC2 con su volumen, Lambda y log group, IAM, security groups)
→ vacía y borra el bucket de artefactos → **verifica** que ya no existen ni el stack ni los buckets.
Tarda ~10-20 min, porque CloudFront y las interfaces de red de la Lambda se liberan con retraso.

## 10. Pruebas

| Prueba | Comando | Necesita |
|--------|---------|----------|
| Integral (web → API → Lambda → BD) | `bash scripts/smoke.sh` | App levantada, bash y curl |
| API unitarias | `cd api && npm ci && npm test` | Node 22 |
| API e2e (Jest + Supertest) | `cd api && npm run test:e2e` | Node 22 y `docker compose up -d` (BD en `localhost:5432`) |
| Lambda | `cd lambda/metrics && npm ci && npm test` | Node 22 |
| Web (tipos) | `cd web && npm ci && npm run typecheck` | Node 22 |

- `smoke.sh` recorre health → login → métricas → crear nota → moverla → métricas +1 → eliminar →
  logout → `401`. Compara las cifras de forma relativa, así que puede repetirse sobre cualquier base
  de datos. Con otro puerto: `BASE_URL=http://localhost:8081 bash scripts/smoke.sh`.
- Los tests e2e crean datos con sufijo aleatorio sobre la base de datos de desarrollo y se pueden
  repetir. Si cambiaste `DB_PORT`, indica la URL:
  `DATABASE_URL=postgres://app:app@localhost:15432/portal npm run test:e2e`
  (PowerShell: `$env:DATABASE_URL="postgres://app:app@localhost:15432/portal"; npm run test:e2e`).
- Infraestructura: `sam validate --lint -t infra/template.yaml` y `sam build -t infra/template.yaml`.

## 11. Solución de problemas

| Síntoma | Solución |
|---------|----------|
| `Bind for 0.0.0.0:8080 failed: port is already allocated` (u otro puerto) | Crea un `.env` a partir de `.env.example` y cambia el puerto ocupado (`WEB_PORT`, `API_PORT`, `LAMBDA_PORT` o `DB_PORT`), por ejemplo `WEB_PORT=8081`. Después: `docker compose up -d` y abre `http://localhost:8081`. |
| `Cannot connect to the Docker daemon` / `error during connect` | Docker Desktop no está iniciado. Ábrelo y espera a que diga *Engine running*. En Windows necesita WSL 2. |
| La página no carga justo después del `up` | La API aún está arrancando: espera a que `docker compose ps` muestre `api` como `healthy`. Registros: `docker compose logs -f api`. |
| El primer `up --build` falla descargando paquetes | Se necesita Internet (npm y Docker Hub). Vuelve a ejecutar `docker compose up -d --build`. |
| No puedo entrar con las cuentas demo | ¿Cambiaste las contraseñas o desactivaste la cuenta? El seed solo se aplica en una base de datos nueva: `docker compose down -v` y `docker compose up -d`. |
| El dashboard dice que el servicio de métricas no respondió | `docker compose ps metrics-lambda`; si está detenido: `docker compose up -d metrics-lambda`. |
| Quiero volver al estado inicial | `docker compose down -v && docker compose up -d --build` |

## 12. Stack y uso de IA

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite + TypeScript, React Router, arrastre con Pointer Events nativos |
| API | NestJS 11 (Node 22): guards globales de sesión y rol, `class-validator`, TypeORM con migraciones |
| Base de datos | PostgreSQL 16 |
| Métricas | AWS Lambda en Node 22 con `pg`, invocada con `@aws-sdk/client-lambda` |
| Local | Docker Compose, nginx, Lambda Runtime Interface Emulator |
| AWS | AWS SAM / CloudFormation, EC2, Lambda, S3, CloudFront |
| Pruebas | Jest + Supertest (API), Jest (Lambda), smoke test en bash |

**Uso de IA.** El enunciado lo permite. Se usó **Claude Code** (Anthropic) como asistente durante
todo el proyecto: desglose del enunciado y planeación por sesiones (`docs/PLANEACION.md`), generación
y modificación de código, revisión, redacción de pruebas y de esta documentación. Cada sesión se
cerró ejecutando sus pruebas (unitarias, e2e, smoke test y validación de la plantilla) antes del
commit.

## 13. Tiempo empleado, limitaciones y pendientes

### Tiempo

El trabajo se hizo en sesiones cortas con alcance y pruebas propias
([PLANEACION §7](docs/PLANEACION.md#7-sesiones-detalladas)). Cada sesión cerró con un commit:

| Sesión | Alcance | Planificado | Cierre (commit) |
|--------|---------|------------:|-----------------|
| S0 | Lectura del enunciado y planeación | 30 min | 2026-09-14 |
| S1 | Base, persistencia, Compose | 45 min | 2026-09-14 22:24 |
| S2 | Autenticación, roles y sesión | 65 min | 2026-09-14 22:45 |
| S3 | Tablero de notas | 80 min | 2026-09-15 01:17 |
| S4 | Dashboard con Lambda | 55 min | 2026-09-15 01:17 |
| S5 | Administración de usuarios | 50 min | 2026-09-15 01:37 |
| S6 | Integración local y smoke test | 35 min | 2026-09-15 01:52 |
| S7 | Infraestructura AWS y scripts | 60 min | 2026-09-15 02:11 |
| S8 | README, portabilidad y guion | 60 min | 2026-09-15 |
| **Total** | | **8 h** | **Tiempo efectivo: ⟨completar⟩** |

### Limitaciones y pendientes

- **AWS sin desplegar.** La plantilla y los scripts están validados de forma estática y en local
  (`sam validate --lint`, `sam build`, `sam local invoke`, compose de EC2 ejecutado en local,
  validaciones de `deploy.sh`), pero `deploy.sh` y `teardown.sh` no se han ejecutado contra una
  cuenta real. Por eso no hay URL pública.
- **Actualizar la API en AWS.** Volver a ejecutar `deploy.sh` actualiza la Lambda y el frontend,
  pero la API conserva su bundle, porque el UserData solo corre en el primer arranque. Para
  desplegar cambios de `api/` hay que ejecutar `teardown.sh` y después `deploy.sh`.
- **Secretos en AWS.** Viajan como parámetros `NoEcho` y quedan visibles en el UserData de la
  instancia. Secrets Manager o SSM Parameter Store evitarían esto, pero añaden servicios fuera del
  alcance pedido.
- **EC2 y base de datos.** El puerto 80 de la instancia está abierto a Internet: no se restringió al
  rango de CloudFront, así que la API también responde por HTTP directo. PostgreSQL vive en el disco
  de una sola instancia, sin copias de seguridad ni alta disponibilidad.
- **Web sin pruebas automatizadas** de interfaz. Se verificó con comprobación de tipos, el smoke test
  y pruebas manuales.
- **Concurrencia:** la última escritura gana y no hay actualización en tiempo real (fuera del
  alcance del enunciado).
- **Video:** pendiente de grabar siguiendo [docs/GUION_VIDEO.md](docs/GUION_VIDEO.md). Enlace:
  ⟨completar⟩.
