## Conversión a Plataforma SaaS Multi-Tenant

Transformar el POS actual (single-tenant) en una plataforma multi-negocio con trial de 30 días, planes, control de vigencia y panel super-admin. La renovación será **manual** (sin Stripe por ahora), pero la arquitectura quedará lista para pagos automáticos en el futuro.

---

### Fase 1 — Base de datos multi-tenant

**Nuevas tablas:**

- `businesses` — id, name, slug, plan (`trial|basic|pro|enterprise`), status (`active|expired|suspended|cancelled`), trial_ends_at, subscription_ends_at, feature_flags (jsonb), owner_user_id, created_at, updated_at.
- `business_users` — relación N:N entre `auth.users` y `businesses` con `role_in_business` (owner/staff). Un usuario puede pertenecer a más de un negocio.
- `super_admins` — tabla simple con user_id de super-administradores de la plataforma.
- `subscription_events` — historial de cambios de plan/vigencia (auditoría: extensiones, suspensiones, etc).

**Migración de tablas existentes — agregar `business_id`:**

`ordenes`, `orden_items`, `productos`, `categorias`, `insumos`, `producto_insumos` (recetas), `compras_insumos`, `menus`, `menu_opciones`, `menu_opcion_items`, `meseros`, `mesas` (si existe), `comprobantes`, `aperturas_caja`, `cierres_caja`, `movimientos_caja`, `costos_operativos`, `recompensas`, `descuentos_activos`, `puntos_usuario`, `alertas_stock`, `alertas_stock_config`, `configuracion_empresa`, `asignacion_mesas`, `roles_custom`, `rol_permisos`, `user_roles`.

**Backfill:** crear un negocio "Negocio Principal" en estado `active` con plan `pro` (sin expiración) y asignar todos los datos existentes + todos los `user_roles` actuales a ese business_id. Esto preserva 100% de la información actual.

**Funciones SECURITY DEFINER:**

- `current_business_id()` — lee el business activo del usuario (default = primero al que pertenece, o el seleccionado vía claim/preferencia).
- `is_super_admin(uid)` — check contra `super_admins`.
- `business_is_operational(bid)` — `status='active' AND (subscription_ends_at IS NULL OR subscription_ends_at > now()) AND (plan != 'trial' OR trial_ends_at > now())`.
- `has_role_in_business(uid, bid, role)` — reemplazo de `has_role` con scope de negocio.

**RLS reescrita en todas las tablas:**

- SELECT: `business_id = current_business_id() OR is_super_admin(auth.uid())`.
- INSERT/UPDATE/DELETE: además requiere `business_is_operational(business_id)` (modo lectura cuando expira).
- Super-admins ven y gestionan todo.

---

### Fase 2 — Backend / hooks

- `useCurrentBusiness()` — hook que devuelve el negocio activo, plan, status, días restantes de trial, flags de features.
- `useBusinessGate()` — devuelve `{ canWrite, isExpired, isTrial, daysLeft }` para condicionar UI.
- Selector de negocio en el header (cuando el usuario pertenece a varios).
- Edge function `create-business` — crea negocio + asigna owner + setea trial 30 días al registrarse.
- Edge function `admin-manage-business` (solo super-admin) — extender vigencia, cambiar plan, suspender, reactivar; escribe en `subscription_events`.

---

### Fase 3 — UI / UX

**Indicadores globales (AdminLayout):**

- Badge en sidebar: "Trial — X días restantes" (amarillo si <7, rojo si <3).
- Banner superior si suscripción vencida: "Tu suscripción ha expirado. Renueva tu plan para continuar operando." (bloquea botones de crear).
- Modal de bienvenida al registrarse explicando trial de 30 días.

**Gate de operaciones:**

Componente `<RequireActiveSubscription>` que envuelve botones de crear pedido / producto / compra. Si expirado → tooltip + disabled. Read-only mode preserva navegación y reportes.

**Onboarding nuevo negocio:**

- `/onboarding/business` — formulario simple (nombre del negocio) tras signup → crea business en trial.

**Super Admin Panel** (`/super-admin`, ruta protegida):

- Tabla de negocios: Nombre · Plan · Estado · Vence · Usuarios · Acciones.
- Acciones por fila: Extender vigencia (date picker), Cambiar plan, Suspender / Reactivar, Ver detalles.
- Métricas: total negocios, activos, en trial, expirados.

---

### Fase 4 — Feature flags

Estructura en `businesses.feature_flags` (jsonb):
```json
{ "delivery": true, "advanced_reports": false, "multi_branch": false, "unlimited_users": false }
```

Hook `useFeature('delivery')` para gating limpio. Defaults por plan en una constante (`PLAN_DEFAULTS`), pero el flag por negocio puede sobrescribir. Evita `if plan === 'pro'` regado por el código.

---

### Detalles técnicos

```text
businesses ──< business_users >── auth.users
     │
     ├──< ordenes, productos, insumos, ... (business_id FK)
     └──< subscription_events
```

- Todas las queries del frontend siguen igual: RLS filtra por business automáticamente vía `current_business_id()`.
- `current_business_id()` lee de `user_metadata.active_business_id` (seteado al hacer login/seleccionar negocio) con fallback al primer business del usuario.
- Migración en 2 pasos: (1) agregar columna nullable + backfill + crear business default, (2) NOT NULL + RLS nueva. Así no rompe nada en producción.
- Índices compuestos `(business_id, created_at)` en tablas de alto volumen (ordenes, orden_items, movimientos_caja).
- Cron diario (edge function) que marca `status='expired'` cuando vence — opcional, la función `business_is_operational()` ya lo evalúa en tiempo real.

### Fuera de alcance (preparado para futuro)

- Stripe / MercadoPago / facturación recurrente.
- Multi-sucursal dentro de un mismo negocio (estructura lista vía `feature_flags.multi_branch`).
- Analytics cross-tenant en super-admin (solo métricas básicas en v1).

---

### Orden de implementación

1. Migración SQL: tablas nuevas + business_id en todas las tablas + backfill + RLS.
2. Hooks `useCurrentBusiness` / `useBusinessGate` / `useFeature`.
3. Edge functions `create-business` y `admin-manage-business`.
4. AdminLayout: badge trial + banner expiración + selector de negocio.
5. Onboarding post-signup.
6. Super Admin Panel.
7. Aplicar gating a botones de creación clave.

¿Apruebas el plan para empezar con la migración (Fase 1)?
