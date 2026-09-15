# Guion de la presentación (máximo 8 minutos)

Guion para grabar la demostración que pide el enunciado: la aplicación funcionando, la organización
del proyecto y la arquitectura. Cubre acceso, diferencias entre roles, gestión de usuarios, crear,
editar y eliminar notas, mover una nota y conservar su posición, y el dashboard.

- **Duración objetivo: 7:30.** Deja 30 s de margen sobre el límite de 8:00.
- El texto entre comillas es para **decirlo** con tus palabras; no hace falta leerlo literal.
- **Pantalla** indica qué mostrar mientras hablas.
- Ritmo de referencia: ~130 palabras por minuto. Cada bloque está medido para ese ritmo.

---

## Preparación (antes de grabar, no cuenta en el tiempo)

1. **Datos limpios:** en la raíz del proyecto ejecuta `docker compose down -v` y después
   `docker compose up -d --build`. Espera a que `docker compose ps` muestre `api` como `healthy`.
   Así hay exactamente 2 cuentas demo y 4 notas de ejemplo.
2. **Ventanas abiertas:**
   - **Navegador normal** en `http://localhost:8080`, sin sesión (se usará como administrador).
   - **Ventana de incógnito** en `http://localhost:8080/dashboard`, sin sesión (se usará como el
     usuario nuevo).
   - **Terminal** en la raíz del proyecto, con letra grande.
   - **Editor** con el árbol del repositorio y `README.md` abierto en la sección de arquitectura
     (vista previa de Markdown, para que se vean los diagramas), además de `infra/template.yaml`.
3. Zoom del navegador al 110-125 %. Cierra notificaciones y pestañas que no uses.
4. **Datos del usuario nuevo:** nombre `Ana Pérez` · correo `ana@demo.test` · contraseña
   `Ana12345!` · rol **Usuario**.
5. Haz un ensayo completo con cronómetro. Después vuelve a ejecutar el paso 1 para grabar con datos
   limpios.

---

## Bloque 1 · 0:00–0:40 · Presentación y organización del proyecto

**Pantalla:** editor con el árbol de carpetas (`api`, `lambda/metrics`, `web`, `infra`, `scripts`,
`docs`).

> «Hola, soy ⟨tu nombre⟩. Les presento el portal de equipo con tablero de notas de la prueba técnica.
> El repositorio está organizado por componentes: en `api` está el backend en NestJS con TypeScript
> y PostgreSQL, organizado en un módulo por dominio: autenticación, usuarios, notas y métricas. En
> `lambda/metrics` está la función Lambda que calcula las métricas. En `web` está el frontend en
> React con Vite. En `infra` está la plantilla de AWS SAM, y en `scripts`, el smoke test y los
> scripts de despliegue y retirada. La planeación y las decisiones están documentadas en `docs`.»

## Bloque 2 · 0:40–1:40 · Arquitectura local y en AWS

**Pantalla:** `README.md`, sección 7, con los dos diagramas. Señala cada caja mientras la nombras.

> «En local todo corre con Docker Compose, sin cuenta de AWS. Nginx sirve el frontend y reenvía
> `/api` a la API. La API guarda los datos en PostgreSQL, en un volumen persistente. Un servicio
> `migrate` crea el esquema y carga las cuentas demo una sola vez.
>
> Las métricas del dashboard las calcula y las entrega una Lambda. En local corre en la imagen
> oficial de AWS Lambda, que trae un emulador, y la API la invoca con el mismo SDK de AWS que usaría
> en la nube.
>
> En AWS, la arquitectura es la que pide el enunciado: el frontend en S3, distribuido por
> CloudFront; la API y PostgreSQL en una instancia EC2 con Docker Compose, y la Lambda dentro de la
> VPC, consultando la base de datos. CloudFront envía `/api` a EC2, así que el frontend usa el mismo
> build en local y en la nube, sin configurar CORS.»

## Bloque 3 · 1:40–2:20 · Arranque y acceso

**Pantalla:** terminal → `docker compose ps` (todo *healthy*) → ventana de incógnito (en
`/dashboard`, redirige al login) → navegador normal: login con `admin@demo.test` / `Admin123!`.

> «El entorno se levanta con un solo comando: `docker compose up -d --build`. Aquí están la base de
> datos, la API, la Lambda y la web en marcha; el servicio de migraciones ya terminó su trabajo.
>
> Si intento abrir el dashboard sin sesión, la aplicación me lleva al login: el tablero, el
> dashboard y la administración solo están disponibles con sesión. La API también responde 401.
> Entro como administrador. La sesión viaja en una cookie httpOnly, y en cada petición la API
> consulta en la base de datos el rol y si el usuario sigue activo.»

## Bloque 4 · 2:20–3:50 · Tablero: crear, editar, guardar, mover, eliminar

**Pantalla:** navegador normal en **Tablero**.

1. Clic en **+ Nueva nota**.
2. Escribe un título («Preparar demo»), un texto, y cambia el estado a **En curso**. Señala el aviso
   «Cambios sin guardar».
3. Clic en **Guardar** → «Guardado».
4. Arrastra la nota desde su cabecera a otra zona del lienzo y suéltala.
5. Pulsa **F5**: la nota sigue con su contenido y en la nueva posición.
6. En otra nota de ejemplo, clic en la papelera → confirma → desaparece.

> «Este es el tablero compartido: un lienzo libre, sin columnas. Creo una nota nueva y la edito
> directamente sobre la tarjeta: título, texto y estado, que puede ser Pendiente, En curso o Hecho.
> La nota me avisa de que hay cambios sin guardar, y los confirmo con Guardar.
>
> Ahora la muevo con el ratón. Al soltarla, la posición se guarda sola, en un endpoint separado del
> contenido: mover una nota nunca guarda ni descarta una edición a medio escribir.
>
> Si recargo la página, la nota conserva su contenido, su estado y su posición.
>
> También puedo eliminar notas, con confirmación. Todos los usuarios activos pueden crear, editar,
> mover y eliminar todas las notas, porque el tablero es único y compartido.»

## Bloque 5 · 3:50–4:35 · Dashboard

**Pantalla:** **Dashboard** → señala *Total de notas*, *Distribución por estado* y el texto «vía AWS
Lambda» → vuelve al **Tablero**, cambia una nota a **Hecho** → **Guardar** → **Dashboard** →
**Actualizar**.

> «El dashboard muestra el total de notas y la distribución por estado. La API no cuenta nada: valida
> la sesión e invoca la Lambda, que consulta PostgreSQL, calcula las cifras y las devuelve.
>
> Si cambio una nota a Hecho en el tablero y vuelvo al dashboard, con Actualizar se ven las cifras
> nuevas.»

## Bloque 6 · 4:35–6:05 · Usuarios y diferencias entre roles

**Pantalla:** navegador normal → **Usuarios**.

1. **Nuevo usuario** → `Ana Pérez`, `ana@demo.test`, rol **Usuario**, contraseña `Ana12345!` →
   **Crear usuario**.
2. **Ventana de incógnito:** login con `ana@demo.test` / `Ana12345!`. Señala que el menú solo tiene
   *Tablero* y *Dashboard*, sin *Usuarios*.
3. **Navegador normal:** en la fila de Ana, **Desactivar** → confirma → estado *Inactivo*.
4. **Incógnito:** haz clic en *Dashboard* o en *Tablero* (**no** uses F5: al recargar, el login
   aparece sin el aviso) → vuelve al login con «Sesión finalizada o usuario inactivo». Intenta entrar
   de nuevo → «Tu usuario está inactivo».
5. **Navegador normal:** **Reactivar** a Ana.
6. En la fila de `admin@demo.test`, **Desactivar** → confirma → aparece el mensaje de que debe quedar
   al menos un administrador activo.

> «La administración de usuarios solo está disponible para el rol administrador. Aquí puedo listar,
> crear y editar usuarios, asignar su rol y desactivarlos o reactivarlos. No hay registro público:
> creo a Ana con rol Usuario y una contraseña inicial, y con ese correo y esa contraseña ella ya puede
> iniciar sesión.
>
> Entro como Ana en otra ventana. Como usuaria normal ve el tablero y el dashboard, pero no la
> administración. Aunque escribiera la URL a mano, la API le respondería 403.
>
> Ahora, como administrador, desactivo a Ana. Ella todavía tiene la sesión abierta, pero en su
> siguiente acción la aplicación la expulsa, porque el estado se comprueba en cada petición. Tampoco
> puede volver a entrar. La reactivo y ya puede entrar otra vez.
>
> Por último, la regla del último administrador: si intento desactivar al único administrador
> activo, el sistema lo impide. Lo mismo pasa si intento quitarle el rol. La API lo resuelve dentro
> de una transacción con bloqueo, así que se cumple aunque lleguen dos peticiones a la vez.»

## Bloque 7 · 6:05–6:50 · Persistencia al reiniciar el entorno

**Pantalla:** terminal → `docker compose down` → `docker compose up -d` → espera a que
`docker compose ps` muestre `api` *healthy* → navegador normal: **F5** en el **Tablero** (la sesión
sigue abierta y la nota creada sigue en su posición).

> «Los datos viven en un volumen de Docker. Apago todo el entorno con `docker compose down` y lo
> vuelvo a levantar.
>
> *(mientras arranca)* Las migraciones y el seed están registrados en la base de datos, así que al
> reiniciar no se duplican datos ni vuelven a aparecer notas borradas. Solo `down -v` borra el
> volumen y reinicia la demo.
>
> Recargo el tablero: la nota que creé sigue con su contenido y en la posición donde la dejé.»

> Si el arranque tarda, sigue hablando del bloque 8 con el editor y vuelve al navegador al final.

## Bloque 8 · 6:50–7:30 · Infraestructura como código y despliegue

**Pantalla:** `infra/template.yaml` (desplázate por los recursos) → `scripts/deploy.sh` (cabecera
con los pasos) → `scripts/teardown.sh`.

> «Para AWS, la plantilla de SAM y CloudFormation define el bucket S3 y CloudFront con acceso
> privado, la instancia EC2 con su rol IAM mínimo, y la Lambda con su grupo de logs y sus grupos de
> seguridad. La instancia usa los mismos Dockerfiles y los mismos nombres de variables que en local,
> y la Lambda es exactamente el mismo handler.
>
> `deploy.sh` valida los parámetros, sube el bundle de la API, ejecuta `sam build` y `sam deploy`,
> publica el frontend en S3 e invalida la caché de CloudFront. `teardown.sh` elimina el stack y los
> buckets, y verifica que no quede nada. La plantilla está validada con el linter de SAM, pero no la
> desplegué en una cuenta real.»

## Bloque 9 · 7:30–7:55 · Tiempo y pendientes

**Pantalla:** `README.md`, sección 13.

> «Trabajé por sesiones cortas, cada una con sus pruebas y su commit. En total fueron ⟨tiempo
> efectivo⟩. Como pendientes quedan el despliegue real en AWS, restringir el acceso directo a la
> instancia y usar un gestor de secretos en la nube. Todo está detallado en el README. Gracias.»

---

## Si vas justo de tiempo

| Recorte | Ahorro |
|---------|--------|
| Bloque 5: no cambies el estado de la nota; solo muestra las cifras | ~20 s |
| Bloque 6: omite el intento de volver a entrar como Ana inactiva (paso 4, segunda parte) | ~10 s |
| Bloque 7: usa `docker compose restart` en lugar de `down` + `up` y dilo así | ~15 s |
| Bloque 8: muestra solo `template.yaml` y nombra los scripts sin abrirlos | ~15 s |

## Lista de verificación de lo que pide el enunciado

| Requisito del video | Bloque |
|---------------------|:------:|
| Aplicación funcionando | 3-7 |
| Organización del proyecto y arquitectura | 1, 2, 8 |
| Acceso (login, rutas protegidas, cerrar sesión o expulsión) | 3, 6 |
| Diferencias entre roles | 6 |
| Gestión de usuarios (crear, editar rol, desactivar, reactivar, último admin) | 6 |
| Crear, editar (con Guardar) y eliminar notas | 4 |
| Mover una nota y conservar su posición | 4, 7 |
| Dashboard | 5 |
