# Distribuidora Silva

Backend mayorista en Node.js 24 LTS, TypeScript, NestJS 11, PostgreSQL 17 y Prisma 6. Monorepo con `backend/`, `frontend/` e `infra/`. Primera versión del backend; frontend y emisión SUNAT pendientes.

## Funcionalidades

- Inicio de sesión, JWT de 15 minutos, renovación rotativa de 7 días y cierre con revocación inmediata. Contraseñas Argon2id; sin registro público ni credenciales por defecto.
- Dos permisos: ADMIN administra catálogo, compras y gastos; MEMBER registra clientes, ventas, cobros y entregas. Crear cuentas individuales para conservar quién hizo cada operación.
- Productos por presentación: una unidad de stock equivale a una caja de esa presentación. Caja pequeña y master se registran como SKU separados; no se convierten existencias automáticamente.
- Catálogo público con precios, sin costos ni stock interno. Publicación optativa por producto.
- Proveedores, compras que ingresan stock, ventas que lo descuentan, precios/costos históricos, pagos parciales, cuentas por cobrar, gastos y entregas.
- Transacciones serializables y restricciones de stock/saldo en PostgreSQL. UUID `requestKey` para reintentar sin duplicar ventas, compras, cobros ni gastos. Reutilizar clave con contenido distinto devuelve 409.
- Auditoría de productos y operaciones financieras/entregas. Sin borrado de operaciones financieras.
- Swagger en desarrollo (`/docs`), validación estricta, límites de peticiones, Helmet y CORS explícito.

## Desarrollo

Requisitos: Node.js 24, npm y Docker/Compose. Desde la raíz:

```bash
docker run -d --name silva-dev-db \
  -e POSTGRES_USER=silva -e POSTGRES_PASSWORD=test-local-only \
  -e POSTGRES_DB=silva_test -p 127.0.0.1:5433:5432 postgres:17-alpine
cd backend
cp .env.example .env
npm ci
npm run db:generate
```

Configurar JWT_SECRET en `backend/.env` con una cadena aleatoria, por ejemplo generada con `openssl rand -hex 48`. La contraseña del ejemplo es solo para desarrollo local.

```bash
npm run db:migrate
npm run dev
```

API: `http://localhost:3000/api/v1`. Swagger: `http://localhost:3000/docs`. Salud con consulta real a PostgreSQL: `GET /api/v1/health`.

Crear cuentas desde `backend/` usando variables de entorno sin escribir contraseñas en argumentos:

```bash
read -r -p 'Email: ' ADMIN_EMAIL
read -r -p 'Nombre: ' ADMIN_NAME
read -r -s -p 'Contraseña (mínimo 14 caracteres): ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
export ADMIN_ROLE=ADMIN # o MEMBER
npm run user:create
unset ADMIN_PASSWORD ADMIN_EMAIL ADMIN_NAME ADMIN_ROLE
```

No sobrescribe cuentas existentes. Para deshabilitar una cuenta, establecer `User.active=false` mediante administración de base de datos; el guard lo verifica en cada solicitud. La interfaz de usuarios está pendiente.

## Flujo de uso

Todas las rutas siguientes llevan prefijo `/api/v1`:

1. `POST /auth/login`: email y password. Usar `Authorization: Bearer <accessToken>`; en Swagger pulsar Authorize.
2. Crear producto, proveedor y cliente. Importes como strings de dos decimales, por ejemplo `"35.50"`, en PEN.
3. `POST /purchases`: requestKey, supplierId, items: [{productId, quantity, unitCost}]. Ingresa stock y actualiza el costo al último de compra.
4. `POST /sales`: requestKey, customerId, items: [{productId, quantity}], dueAt opcional ISO. Usa precios de catálogo desde el servidor.
5. `POST /sales/:id/payments`: requestKey, amount, method (CASH, TRANSFER, YAPE, PLIN). Una venta nace pendiente de pago; para contado registrar su cobro completo.
6. `GET /receivables`: saldo = total - paid. `PATCH /sales/:id/delivery`: PENDING → DISPATCHED → DELIVERED o PENDING → PICKED_UP.

Listados: skip y take (máximo 100). Ante 409 por concurrencia, reintentar con la misma requestKey y espera gradual; conflictos de stock/saldo requieren corregir la operación.

El futuro frontend mantendrá access tokens en memoria. La integración de renovación mediante cookie HttpOnly y protección CSRF se resolverá con el frontend. Esta API devuelve refresh tokens en el cuerpo para clientes de confianza; no almacenarlos en localStorage por defecto.

## Pruebas

Usar exclusivamente una base dedicada cuyo nombre contenga `silva_test`. Las pruebas crean datos aislados mediante UUID sin borrar datos de otras ejecuciones.

```bash
cd backend
npm run db:migrate
npm run format:check
npm run build
npm test
```

NestJS, Jest, Supertest y PostgreSQL real: autenticación, permisos, validación, privacidad del catálogo, atomicidad, stock concurrente, pagos parciales/concurrentes, idempotencia, entregas y revocación. TypeScript estricto. GitHub Actions ejecuta estas verificaciones y construye Docker.

## Despliegue

Configuración inicial: VPS Linux con Docker/Compose, Python 3, curl y flock; dominio api apuntando al servidor y puertos 80/443 disponibles. Copiar el repo, crear `.env` desde `.env.example`, configurar valores y protegerlo con `chmod 600 .env`. DATABASE_URL debe coincidir con PostgreSQL y usar host `db`. Usar contraseña aleatoria alfanumérica o codificar caracteres especiales en la URL. Configurar `docker login` del registro elegido.

```bash
./deploy.sh
# equivalente:
make deploy
```

Verifica herramientas/configuración, bloquea ejecuciones simultáneas, construye/publica imagen, inicia PostgreSQL, hace backup, aplica migraciones, inicia API/proxy y verifica HTTPS. API: `https://API_DOMAIN/api/v1`. Caddy gestiona TLS. PostgreSQL no expone puerto al exterior. El frontend todavía no existe y el script lo indica expresamente.

Actions publica la imagen en GHCR con tag SHA después de CI exitoso en main. Configurar BACKEND_IMAGE=ghcr.io/gaboiouu/distribuidora-silva-backend e IMAGE_TAG=<sha-verificado> en el servidor y ejecutar:

```bash
DEPLOY_PULL_ONLY=1 ./deploy.sh
```

El workflow no accede a un servidor remoto: falta elegir hosting y configurar acceso. No hay URL de producción publicada. Para crear cuentas en producción, exportar las variables de la sección Desarrollo y ejecutar:

```bash
docker compose run --rm -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD -e ADMIN_ROLE backend npm run user:create
unset ADMIN_PASSWORD ADMIN_EMAIL ADMIN_NAME ADMIN_ROLE
```

Backups previos en backups/ con acceso restringido. Configurar también copias periódicas fuera del servidor, retención y pruebas de restauración antes de uso real. No hay rollback automático del esquema: usar migraciones compatibles hacia adelante. Para revertir aplicación, seleccionar tag anterior y ejecutar modo pull comprobando compatibilidad. El despliegue de una instancia puede interrumpir brevemente el servicio.

## Pendiente

- Frontend interno y web pública con URLs, imágenes, búsqueda y contacto WhatsApp.
- SUNAT/proveedor, XML firmado, CDR, series, impuestos, notas de crédito y contingencias. Las ventas actuales son registros comerciales, no comprobantes fiscales; no se simula aceptación SUNAT.
- Precios escalonados/personalizados, promociones, conversiones de cajas, lotes/vencimientos, devoluciones, anulaciones, pagos a proveedores y conciliación. Resumen actual = cobros y gastos registrados, no utilidad ni saldo bancario.
- Rate limiting en memoria para una instancia; usar almacén compartido antes de escalar. No se confía automáticamente en cabeceras de proxy enviadas por clientes.

## Convenciones

Conventional Commits: feat(auth), fix(inventory), test(sales), ci. Nunca versionar .env, respaldos, contraseñas, certificados ni claves SOL. Revisar CI antes de integrar cambios a main.
