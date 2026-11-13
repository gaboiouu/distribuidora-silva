# Entornos de Distribuidora Silva

Cada entorno usa su propia rama de Neon, su propia URL de backend y su propia configuración de frontend. Los datos no se promocionan: solo se despliega el código y se aplican las migraciones.

| Entorno | Uso | Base de datos | Facturación |
| --- | --- | --- | --- |
| development | Trabajo local | Rama de desarrollo | Sin envíos reales |
| staging | Prueba del flujo completo | Rama de pruebas | Solo ambiente beta |
| production | Ventas reales | Rama de producción | Habilitar tras validar el proveedor |

## Configuración inicial

1. La rama actual de Neon se llama `production` y la rama `staging` ya se creó. No borres ni resetees ninguna de las dos.
2. `backend/.env` es la configuración anterior y se conserva. `backend/.env.staging` es la configuración de pruebas: completa `DATABASE_URL` (pooled) y `DIRECT_URL` (directa) de la rama `staging`. La plantilla `backend/.env.example` sirve de referencia general y no se ejecuta.
3. Cuando se necesite un entorno adicional, copia `backend/.env.example` a `.env.development` o `.env.production` y ajusta `APP_ENV`, `NODE_ENV`, las URL de la rama correspondiente, una clave JWT propia y `CORS_ORIGIN`. No compartas esos archivos ni los subas a Git.
4. El frontend local usa `frontend/.env`. Para un frontend de pruebas desplegado, crea `frontend/.env.staging` desde `frontend/.env.example` y cambia `VITE_API_URL` al backend de pruebas. Para producción, configura las variables en el hosting o crea `frontend/.env.production`.
5. Antes de usar cada base, aplica las migraciones y crea un usuario administrador en ese entorno. La creación de usuarios requiere ejecutar el comando con las variables de ese entorno.

## Comandos locales (desde `backend`)

| Acción | Desarrollo | Pruebas | Producción |
| --- | --- | --- | --- |
| Migrar | `npm run migrate:dev` | `npm run migrate:staging` | `npm run migrate:production` |
| Iniciar backend compilado | `npm run start:dev` | `npm run start:staging` | `npm run start:production` |

Compila antes con `npm run build`. Los comandos anteriores verifican que el perfil seleccionado coincida con `APP_ENV`, que las URL pooled/directa apunten a la misma rama y que dos perfiles locales no compartan rama. No ejecutan borrados ni reseteos.

Desde `frontend`, usa `npm run build:staging` para pruebas y `npm run build` para producción. Vite incorpora `VITE_API_URL` al compilar; si cambias la URL, vuelve a compilar. En despliegues alojados, configura estas mismas variables en el proveedor de hosting y asigna una rama de Neon distinta a cada servicio.

La facturación está desactivada por defecto (`BILLING_PROVIDER=DISABLED`): las ventas, abonos, compras y devoluciones funcionan sin emitir comprobantes electrónicos. El cliente de facturación existente es de Nubefact y no corresponde a APIsPERU. Cuando se elija el proveedor, habrá que configurar la empresa, implementar y probar la integración en beta antes de habilitar la emisión. No cargues credenciales de producción en desarrollo o staging.

Las migraciones `202611120001_purchase_installments` y `202611120002_sale_returns` agregan cuotas de compras y devoluciones. Aplica `npm run migrate:staging` desde tu PowerShell antes de iniciar la versión actualizada del backend de pruebas. Comprueba que el comando termine sin errores; si falla, no pruebes estos flujos hasta resolver la conexión o la migración.
