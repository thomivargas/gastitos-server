# Gastitos - Server

API REST para gestionar finanzas personales. Construida con Express 5, TypeScript, Prisma 7 y PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (para jobs y rate limiting)
- npm

## Instalacion

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Levantar PostgreSQL y Redis
docker compose up -d

# Ejecutar migraciones
npm run db:migrate

# (Opcional) Seed de datos
npm run db:seed

# Iniciar en desarrollo
npm run dev
```

## Variables de entorno

| Variable | Descripcion | Default |
|---|---|---|
| `NODE_ENV` | Entorno (development, production, test) | `development` |
| `PORT` | Puerto del servidor | `3000` |
| `DATABASE_URL` | URL de conexion PostgreSQL | - |
| `JWT_ACCESS_SECRET` | Secret para access tokens (min 16 chars) | - |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens (min 16 chars) | - |
| `JWT_ACCESS_EXPIRES_IN` | Duracion del access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duracion del refresh token | `7d` |
| `BCRYPT_ROUNDS` | Rondas de hashing para passwords | `10` |
| `REDIS_URL` | URL de conexion Redis | `redis://localhost:6379` |
| `CORS_ORIGIN` | Origenes permitidos (separados por coma) | `http://localhost:5173` |
| `MAX_SESIONES` | Sesiones activas por usuario | `5` |

## Scripts

```bash
npm run dev          # Desarrollo con hot-reload (ts-node-dev)
npm run build        # Compilar TypeScript + generar Prisma client
npm start            # Ejecutar build compilado
npm test             # Ejecutar tests (Vitest)
npm run test:watch   # Tests en modo watch

npm run db:migrate      # Ejecutar migraciones (dev)
npm run db:migrate:prod # Ejecutar migraciones (produccion)
npm run db:seed         # Seed de datos iniciales
npm run db:studio       # Abrir Prisma Studio (GUI)
npm run db:generate     # Regenerar Prisma client
npm run db:reset        # Resetear DB completa
```

## Stack tecnico

| Capa | Tecnologia |
|---|---|
| Framework | Express 5 |
| Lenguaje | TypeScript 5.9 (strict) |
| ORM | Prisma 7 con adapter PostgreSQL |
| Base de datos | PostgreSQL 16 |
| Validacion | Zod v4 |
| Autenticacion | JWT (access + refresh tokens) |
| Hashing | bcryptjs |
| Jobs asincronos | BullMQ + Redis |
| Rate limiting | express-rate-limit + rate-limit-redis |
| Logging | Pino + pino-http |
| Testing | Vitest + Supertest |
| CSV | PapaParse + Multer |

## Estructura del proyecto

```
src/
├── app.ts                    # Express: middlewares y rutas
├── server.ts                 # Bootstrap: DB, workers, crons, graceful shutdown
├── config/
│   ├── env.ts                # Validacion de env vars con Zod
│   ├── database.ts           # Prisma client (singleton)
│   ├── logger.ts             # Pino config
│   └── queue.ts              # BullMQ queues + conexion Redis
├── middlewares/
│   ├── auth.middleware.ts    # Verificacion Bearer token
│   ├── validate.middleware.ts# Validacion Zod (body/query/params)
│   ├── error.middleware.ts   # Error handler global
│   ├── errors.ts             # Clases de error (NotFound, BadRequest, etc.)
│   ├── rate-limit.middleware.ts # Rate limiting con Redis
│   └── rol.middleware.ts     # Autorizacion por rol
├── utils/
│   ├── jwt.ts                # Generacion y verificacion de tokens
│   ├── hash.ts               # hashPassword / comparePassword
│   ├── pagination.ts         # getPaginationArgs / buildPaginatedResult
│   ├── asyncHandler.ts       # Wrapper try/catch para controllers
│   ├── logger.ts             # Middleware HTTP logging
│   ├── sanitize.ts           # Sanitizacion de inputs
│   └── params.ts             # Schema UUID para :id
├── modules/
│   ├── auth/                 # Registro, login, refresh, cambiar password
│   ├── usuario/              # Perfil del usuario
│   ├── cuenta/               # Cuentas financieras (banco, efectivo, etc.)
│   ├── categoria/            # Categorias jerarquicas (ingreso/gasto)
│   ├── etiqueta/             # Tags libres para transacciones
│   ├── transaccion/          # Ingresos y gastos con balance atomico
│   ├── transferencia/        # Movimientos entre cuentas
│   ├── presupuesto/          # Presupuestos mensuales con asignacion por categoria
│   ├── recurrente/           # Transacciones recurrentes con motor de frecuencias
│   ├── balance/              # Snapshots historicos y patrimonio
│   ├── reporte/              # Reportes y analitica financiera
│   ├── moneda/               # Tasas de cambio USD/ARS (dolarapi.com)
│   ├── importacion/          # Import/export CSV
│   ├── regla/                # Reglas de auto-categorizacion
│   └── admin/                # Monitoreo de colas (solo ADMIN)
├── jobs/
│   ├── generarRecurrentes.job.ts  # Job: generar transacciones pendientes
│   └── actualizarTasas.job.ts     # Job: actualizar cotizaciones
├── workers/
│   └── index.ts              # Registro de workers BullMQ
├── cron/
│   └── index.ts              # Cron schedules (recurrentes, tasas)
└── tests/
    ├── setup.ts              # Hooks de Vitest (connect/disconnect)
    └── helpers.ts            # crearUsuarioTest, limpiarDB
```

Cada modulo sigue la misma estructura:
```
modulo/
├── modulo.schema.ts      # Schemas Zod (validacion + tipos)
├── modulo.service.ts     # Logica de negocio + queries Prisma
├── modulo.controller.ts  # Handlers HTTP (asyncHandler)
└── modulo.routes.ts      # Definicion de rutas Express
```

## Base de datos

13 modelos en PostgreSQL, todos los nombres en espanol:

```
Usuario ─┬── Cuenta ──── Transaccion ──── TransaccionEtiqueta ──── Etiqueta
         │       │              │
         │       │              └── Transferencia (vincula 2 transacciones)
         │       │
         │       └── BalanceHistorico
         │
         ├── Categoria ──── PresupuestoCategoria ──── Presupuesto
         │       │
         │       └── ReglaCategorizacion
         │
         ├── TransaccionRecurrente
         │
         └── TasaCambio
```

**Enums:** TipoCuenta, ClasificacionCuenta, EstadoCuenta, ClasificacionCategoria, TipoTransaccion, FrecuenciaRecurrencia, Rol

**Precision monetaria:** `Decimal(19, 4)` para montos, `Decimal(19, 10)` para tasas de cambio.

## API - Endpoints

Todas las rutas usan el prefijo `/api`. Salvo auth, todas requieren `Authorization: Bearer <token>`.

### Autenticacion

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/auth/registro` | Crear cuenta (rate limited) |
| `POST` | `/auth/login` | Iniciar sesion (rate limited) |
| `POST` | `/auth/refresh` | Renovar access token (refresh token en cookie) |
| `POST` | `/auth/logout` | Cerrar sesion (limpia cookie) |
| `POST` | `/auth/cambiar-password` | Cambiar contrasena (revoca todas las sesiones) |
| `GET` | `/auth/sesiones` | Listar sesiones activas |
| `DELETE` | `/auth/sesiones` | Cerrar todas las sesiones |
| `DELETE` | `/auth/sesiones/:id` | Cerrar una sesion especifica |

El refresh token se guarda como cookie HttpOnly (el cliente nunca lo ve). El access token se devuelve en el body.
La rotacion de tokens detecta reuso: si un refresh token ya rotado se usa de nuevo, se revocan todas las sesiones del usuario.

### Usuario

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/usuario/perfil` | Obtener perfil |
| `PATCH` | `/usuario/perfil` | Actualizar perfil |

### Cuentas

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/cuentas` | Crear cuenta financiera |
| `GET` | `/cuentas` | Listar cuentas (filtros por estado, tipo) |
| `GET` | `/cuentas/resumen` | Resumen: totales activos/pasivos/patrimonio |
| `GET` | `/cuentas/:id` | Obtener cuenta |
| `PATCH` | `/cuentas/:id` | Actualizar cuenta |
| `PATCH` | `/cuentas/:id/archivar` | Archivar cuenta |
| `PATCH` | `/cuentas/:id/reactivar` | Reactivar cuenta |
| `DELETE` | `/cuentas/:id` | Eliminar cuenta |

Tipos: `EFECTIVO`, `BANCO_CORRIENTE`, `BANCO_AHORRO`, `TARJETA_CREDITO`, `INVERSION`, `PRESTAMO`, `OTRO_ACTIVO`, `OTRO_PASIVO`

### Categorias

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/categorias` | Crear categoria |
| `GET` | `/categorias` | Listar (filtros: clasificacion, con subcategorias) |
| `GET` | `/categorias/:id` | Obtener categoria |
| `PATCH` | `/categorias/:id` | Actualizar |
| `DELETE` | `/categorias/:id` | Eliminar |

Soporta jerarquia padre/hijo (1 nivel). Clasificacion: `INGRESO` o `GASTO`.

### Etiquetas

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/etiquetas` | Crear etiqueta |
| `GET` | `/etiquetas` | Listar todas |
| `PATCH` | `/etiquetas/:id` | Actualizar |
| `DELETE` | `/etiquetas/:id` | Eliminar |

### Transacciones

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/transacciones` | Crear transaccion |
| `GET` | `/transacciones` | Listar (filtros, paginacion, busqueda) |
| `GET` | `/transacciones/:id` | Obtener transaccion |
| `PATCH` | `/transacciones/:id` | Actualizar |
| `DELETE` | `/transacciones/:id` | Eliminar (revierte balance) |

Filtros: `cuentaId`, `categoriaId`, `tipo`, `fechaDesde/Hasta`, `montoMin/Max`, `busqueda`, `etiquetaIds`, `excluida`.

El monto siempre es positivo; `tipo` (INGRESO/GASTO) determina la direccion. Al crear sin `categoriaId`, se auto-categoriza usando las reglas del usuario.

### Transferencias

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/transferencias` | Crear transferencia entre cuentas |
| `GET` | `/transferencias` | Listar transferencias |
| `GET` | `/transferencias/:id` | Obtener transferencia |
| `DELETE` | `/transferencias/:id` | Eliminar (revierte ambos balances) |

Crea dos transacciones vinculadas (una en cada cuenta). Soporta monedas distintas con `montoDestino`. Campo `forzar: true` omite validacion de fecha > 30 dias.

### Presupuestos

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/presupuestos` | Crear presupuesto |
| `GET` | `/presupuestos` | Listar presupuestos |
| `GET` | `/presupuestos/actual` | Presupuesto del mes actual |
| `GET` | `/presupuestos/:id` | Obtener presupuesto |
| `GET` | `/presupuestos/:id/progreso` | Progreso: gastado vs presupuestado por categoria |
| `PATCH` | `/presupuestos/:id` | Actualizar |
| `POST` | `/presupuestos/:id/categorias` | Asignar categoria al presupuesto |
| `DELETE` | `/presupuestos/:id/categorias/:categoriaId` | Quitar categoria |
| `POST` | `/presupuestos/:id/copiar` | Copiar a otro periodo |
| `DELETE` | `/presupuestos/:id` | Eliminar |

### Transacciones recurrentes

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/recurrentes` | Crear recurrente |
| `GET` | `/recurrentes` | Listar recurrentes |
| `GET` | `/recurrentes/:id` | Obtener recurrente |
| `PATCH` | `/recurrentes/:id` | Actualizar |
| `PATCH` | `/recurrentes/:id/activar` | Activar |
| `PATCH` | `/recurrentes/:id/desactivar` | Desactivar |
| `DELETE` | `/recurrentes/:id` | Eliminar |
| `POST` | `/recurrentes/generar` | Generar pendientes (encola job en BullMQ) |

Frecuencias: `DIARIA`, `SEMANAL`, `QUINCENAL`, `MENSUAL`, `BIMESTRAL`, `TRIMESTRAL`, `SEMESTRAL`, `ANUAL`.

### Balances

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/balances/snapshot` | Guardar snapshot del dia |
| `GET` | `/balances/historial` | Historial de balances de una cuenta |
| `GET` | `/balances/patrimonio` | Evolucion del patrimonio total |

### Reportes

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/reportes/resumen-mensual` | Ingresos, gastos, balance de un mes |
| `GET` | `/reportes/gastos-por-categoria` | Desglose de gastos por categoria |
| `GET` | `/reportes/ingresos-por-categoria` | Desglose de ingresos por categoria |
| `GET` | `/reportes/tendencia-mensual` | Tendencia de ingresos/gastos (N meses) |
| `GET` | `/reportes/flujo-de-caja` | Flujo de efectivo por periodo |
| `GET` | `/reportes/top-gastos` | Top N transacciones mas grandes |

### Monedas

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/monedas/tasas` | Tasas del dia (blue, mep, oficial) |
| `GET` | `/monedas/convertir` | Convertir monto entre USD y ARS |
| `POST` | `/monedas/actualizar-tasas` | Forzar actualizacion (encola job) |

Fuente: [dolarapi.com](https://dolarapi.com). Tipos de dolar: blue, mep, oficial.

### Import/Export CSV

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/importacion/preview` | Subir CSV y ver columnas + primeras filas |
| `POST` | `/importacion/ejecutar` | Importar transacciones desde CSV |
| `GET` | `/importacion/exportar` | Exportar transacciones a CSV |
| `GET` | `/importacion/plantilla` | Descargar CSV plantilla |

El import soporta 4 formatos de fecha (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, `DD-MM-YYYY`), separador decimal punto o coma, y aplica reglas de auto-categorizacion.

### Reglas de categorizacion

| Metodo | Ruta | Descripcion |
|---|---|---|
| `POST` | `/reglas` | Crear regla |
| `GET` | `/reglas` | Listar reglas (por prioridad) |
| `GET` | `/reglas/:id` | Obtener regla |
| `PUT` | `/reglas/:id` | Actualizar regla |
| `DELETE` | `/reglas/:id` | Eliminar regla |
| `POST` | `/reglas/sugerir` | Sugerir categoria para una descripcion |
| `POST` | `/reglas/aplicar` | Aplicar reglas a transacciones sin categoria |

Las reglas buscan un patron (texto) dentro de la descripcion de la transaccion. Se evaluan por prioridad (mayor primero). Se aplican automaticamente al crear transacciones y al importar CSV.

### Admin (requiere rol ADMIN)

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/admin/queues` | Estado de todas las colas BullMQ |
| `GET` | `/admin/queues/recurrentes/jobs` | Jobs de recurrentes |
| `GET` | `/admin/queues/tasas/jobs` | Jobs de tasas |

## Formato de respuestas

**Exito:**
```json
{ "status": "ok", "data": { ... } }
```

**Exito con paginacion:**
```json
{
  "status": "ok",
  "data": [ ... ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error:**
```json
{ "status": "error", "message": "Descripcion del error" }
```

**Error de validacion (400):**
```json
{
  "status": "error",
  "message": "Error de validacion",
  "errors": { "campo": ["mensaje"] }
}
```

## Jobs y cron

El servidor levanta workers de BullMQ al iniciar:

| Cron | Job | Descripcion |
|---|---|---|
| `0 5 0 * * *` (00:05 UTC) | `generar-recurrentes` | Genera transacciones recurrentes pendientes |
| `0 0 9 * * *` (09:00 UTC) | `actualizar-tasas-apertura` | Actualiza cotizaciones USD/ARS |
| `0 0 18 * * *` (18:00 UTC) | `actualizar-tasas-cierre` | Actualiza cotizaciones USD/ARS |

Los jobs tienen reintentos automaticos (3 intentos con backoff exponencial/fijo).

## Seguridad

- Passwords hasheados con bcryptjs
- JWT con tokens de corta duracion (15m access, 7d refresh)
- **Refresh token en cookie HttpOnly** (no accesible desde JS, protegido contra XSS)
- **Sesiones persistidas en DB** con deteccion de reuso (rotacion de tokens)
- Limite de sesiones activas por usuario (default 5, configurable con `MAX_SESIONES`)
- Cambio de password revoca todas las sesiones
- Helmet para headers de seguridad
- CORS configurable
- Rate limiting global (100 req/min) y estricto en auth (10 req/15min)
- Rate limiting respaldado por Redis (persistente entre reinicios)
- Validacion de inputs en todos los endpoints con Zod
- Autorizacion por rol (USUARIO/ADMIN)
- Operaciones atomicas con `prisma.$transaction()`
- Limpieza automatica de sesiones expiradas cada 6 horas (BullMQ cron)

## Promover usuario a admin

```sql
UPDATE usuarios SET rol = 'ADMIN' WHERE email = 'tu@email.com';
```
