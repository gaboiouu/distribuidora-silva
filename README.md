# Distribuciones Silva

Sistema integral para el negocio familiar de venta mayorista de chocolates y golosinas (**Distribuciones Silva**). Especializado en la comercialización por **display o caja máster** de productos de alta rotación (Triángulo, variedades de Sublime, multipacks, Morochas, Bon o Bon), permitiendo a los clientes armar pedidos con productos mezclados.

---

## 🏛 Arquitectura del Sistema

El repositorio está organizado como monorepo con backend y frontend desacoplados:

- **Backend (`/backend`)**:
  - Runtime: **Node.js 22** (TypeScript, NestJS 11).
  - Base de datos: **PostgreSQL en Neon** gestionado con **Prisma ORM 6**. Conexión agrupada (*pooler* con PgBouncer) para la aplicación y conexión directa para migraciones.
  - Autenticación: JWT con rotación de sesiones, contraseñas cifradas con **Argon2id** y control de roles (`ADMIN` y `MEMBER`).
  - Idempotencia: Soporte de `requestKey` (UUID v4) en ventas, compras, cobros, devoluciones y facturas para evitar registros duplicados por reintentos de red.
  - Facturación electrónica: Conexión con **Nubefact (Demo)** para emisión de Boletas, Facturas, Notas de Crédito y Guías de Remisión.
- **Frontend (`/frontend`)**:
  - SPA construida con **React 18**, **TypeScript**, **Vite** y **Tailwind CSS**.
  - **Web Pública**: Catálogo mayorista de productos con precios actualizados y generador de pedidos directo a WhatsApp.
  - **Panel Familiar**: Tablero de gestión con módulos de:
    - Resumen ejecutivo y ventas del día.
    - Registro de ventas mayoristas (descuento de inventario, precios negociados, entregas).
    - Inventario (control de stock, aperturas de cajas máster a displays, ajustes de stock y kardex).
    - Cuentas por cobrar y abonos parciales.
    - Compras a proveedores (contado y tarjeta de crédito en cuotas) y gastos operativos.
    - Devoluciones y anulaciones comerciales.
    - Facturación electrónica SUNAT (envío a Nubefact, consulta de estado, descarga de PDF oficial, XML firmado y CDR; incluye vista previa de diseño personalizada sin validez tributaria).
    - Directorio de clientes y proveedores.
    - Cuentas de usuarios familiares (solo administradores).
- **Entornos y Ramas de Base de Datos**:
  - Detallados en [`docs/entornos.md`](docs/entornos.md). Cada entorno (`development`, `staging`, `production`) opera con su propia rama independiente en Neon.

---

## 🚀 Puesta en marcha local

### Requisitos previos
- Node.js 22+ y npm.
- Proyecto PostgreSQL en Neon (ramas configuradas para cada entorno).

### 1. Backend (`/backend`)
```bash
cd backend

# Configurar variables de entorno (copiar desde .env.example)
# En Windows PowerShell:
copy .env.example .env

# Configurar en .env: DATABASE_URL, DIRECT_URL, JWT_SECRET, CORS_ORIGIN
npm install
npx prisma generate

# Aplicar migraciones pendientes
npm run db:migrate

# Iniciar servidor en modo desarrollo
npm run dev
```
El backend estará disponible en `http://localhost:3000/api/v1` (documentación Swagger disponible en `/docs` en desarrollo).

### 2. Frontend (`/frontend`)
```bash
cd frontend

# Configurar variables de entorno si es necesario
# En Windows PowerShell:
copy .env.example .env

npm install
npm run dev
```
La aplicación web se ejecutará en `http://localhost:5173`.

---

## 🧪 Pruebas y Validación

- **Backend**:
  - Compilación TypeScript: `npm run build` en `backend/`.
  - Pruebas automatizadas (Jest / Supertest): `npm run test` en `backend/` para validar flujos de facturación, inventario y finanzas en la rama de staging.
- **Frontend**:
  - Compilación y verificación de tipos: `npm run build` en `frontend/`.

---

## 📌 Estado del Proyecto y Próximos Pasos

- [x] Backend completo con ventas mixtas, cajas máster, compras en cuotas, abonos y devoluciones.
- [x] Frontend completo conectado con catálogo público y panel familiar de administración.
- [x] Migraciones y configuración multi-entorno de Neon (desarrollo, staging y producción).
- [x] Integración de facturación electrónica con Nubefact Demo.
- [ ] Validación final de respuesta de comprobantes en Nubefact antes de paso a producción.
- [ ] Contenedorización con Docker y automatización de despliegue continuo (CI/CD) para el cierre del proyecto.
