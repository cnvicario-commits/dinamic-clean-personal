// Control de navegación por rol, a nivel de app. No es una frontera de
// autorización: cada dominio debe aplicar RBAC backend y RLS/grants propios.
// Se usa tanto en src/proxy.ts (bloquea navegación) como en NavBar.tsx
// (oculta los links que no correspondan).

export type Rol = 'admin' | 'gerente' | 'compras' | 'supervisor' | 'auditoria' | 'ventas'

export const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'admin', etiqueta: 'Administrador' },
  { valor: 'gerente', etiqueta: 'Gerente' },
  { valor: 'compras', etiqueta: 'Compras' },
  { valor: 'supervisor', etiqueta: 'Supervisor' },
  { valor: 'auditoria', etiqueta: 'Auditoría' },
  { valor: 'ventas', etiqueta: 'Ventas' },
]

// Prefijo de ruta -> roles que pueden entrar. Se evalúa por startsWith, así
// que /pedidos-compra/nuevo o /pedidos-compra/123 quedan cubiertos por la
// entrada de /pedidos-compra sin tener que listarlos aparte. El orden importa:
// se usa la primera entrada cuyo prefijo matchee, por eso /pedidos-compra va
// antes que nada que pudiera confundirse con el resto de Compras.
const RUTAS_PERMITIDAS: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: '/pedidos-compra', roles: ['admin', 'gerente', 'compras', 'supervisor'] },
  { prefijo: '/proveedores', roles: ['admin', 'gerente', 'compras'] },
  { prefijo: '/articulos', roles: ['admin', 'gerente', 'compras'] },
  { prefijo: '/panel-compras', roles: ['admin', 'gerente', 'compras'] },
  { prefijo: '/ordenes-compra', roles: ['admin', 'gerente', 'compras'] },
  { prefijo: '/pedidos-deposito', roles: ['admin', 'gerente', 'compras'] },
  { prefijo: '/clientes', roles: ['admin', 'gerente', 'compras'] },
  { prefijo: '/empresas', roles: ['admin', 'gerente'] },
  { prefijo: '/dashboard', roles: ['admin', 'gerente'] },
  // 'ventas' es un rol acotado a propósito: solo entra a /ventas/*, a ningún
  // otro módulo (no aparece en ninguna otra entrada de esta lista).
  { prefijo: '/ventas', roles: ['admin', 'gerente', 'ventas'] },
  // Administrar el checklist (crear/activar versiones) queda restringido a
  // admin/gerente/auditoria — va antes para matchear primero. El resto del
  // módulo (planificar, cargar auditorías, ver la ficha propia con su plan
  // de acción) son tareas de campo: el rol 'supervisor' entra ahí también.
  // 'auditoria' es un rol acotado a propósito: solo entra a /auditorias/*,
  // a ningún otro módulo (no aparece en ninguna otra entrada de esta lista).
  { prefijo: '/auditorias/checklist', roles: ['admin', 'gerente', 'auditoria'] },
  { prefijo: '/auditorias', roles: ['admin', 'gerente', 'supervisor', 'auditoria'] },
  { prefijo: '/empleados', roles: ['admin', 'gerente'] },
  { prefijo: '/ausencias', roles: ['admin', 'gerente'] },
  { prefijo: '/asignaciones', roles: ['admin', 'gerente'] },
  { prefijo: '/resultados', roles: ['admin'] },
  { prefijo: '/usuarios', roles: ['admin'] },
]

// Rutas que no están en la tabla (/portal, /login, /sin-acceso) quedan
// siempre permitidas: no son módulos con datos, son pantallas comunes.
export function puedeAcceder(rol: Rol | null, pathname: string): boolean {
  const entrada = RUTAS_PERMITIDAS.find((r) => pathname.startsWith(r.prefijo))
  if (!entrada) return true
  if (!rol) return false // sin rol asignado: no entra a ningún módulo (fail closed)
  return entrada.roles.includes(rol)
}
