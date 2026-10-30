import { z } from 'zod'

/**
 * PostgreSQL uuid: any 8-4-4-4-12 hex value.
 * Zod's RFC 4122 `.uuid()` rejects seeded ids such as
 * `00000000-0000-0000-0000-000000000001`, which PostgreSQL stores.
 */
export const postgresUuid = z.guid()
