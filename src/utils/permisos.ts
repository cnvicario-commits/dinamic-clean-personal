// Control de navegación por rol, a nivel de app. No es una frontera de
// autorización: cada dominio debe aplicar RBAC backend y RLS/grants propios.
// Se usa tanto en src/proxy.ts (bloquea navegación) como en NavBar.tsx
// (oculta los links que no correspondan).
//
// Roles: contrato generado desde apps/api (rbac-catalog). No redefinir uniones manuales.

import { GENERATED_ROLES, type Role } from '@/lib/api/generated/types'

/** Etiquetas de UI por rol — debe cubrir todos los GENERATED_ROLES (testeado en API). */
export const ROLE_UI_METADATA: Record<Role, { etiqueta: string }> = {
  admin: { etiqueta: 'Administrador' },
  gerente: { etiqueta: 'Gerente' },
  compras: { etiqueta: 'Compras' },
  supervisor: { etiqueta: 'Supervisor' },
  auditoria: { etiqueta: 'Auditoría' },
  ventas: { etiqueta: 'Ventas' },
}

export const ROLES = GENERATED_ROLES.map((valor) => ({
  valor,
  etiqueta: ROLE_UI_METADATA[valor].etiqueta,
}))

// Prefijo de ruta -> roles que pueden entrar. Se evalúa por startsWith, así
// que /pedidos-compra/nuevo o /pedidos-compra/123 quedan cubiertos por la
// entrada de /pedidos-compra sin tener que listarlos aparte. El orden importa:
// se usa la primera entrada cuyo prefijo matchee, por eso /pedidos-compra va
// antes que nada que pudiera confundirse con el resto de Compras.
const RUTAS_PERMITIDAS: { prefijo: string; roles: Role[] }[] = [
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
export function puedeAcceder(rol: Role | null, pathname: string): boolean {
  const entrada = RUTAS_PERMITIDAS.find((r) => pathname.startsWith(r.prefijo))
  if (!entrada) return true
  if (!rol) return false // sin rol asignado: no entra a ningún módulo (fail closed)
  return entrada.roles.includes(rol)
}
