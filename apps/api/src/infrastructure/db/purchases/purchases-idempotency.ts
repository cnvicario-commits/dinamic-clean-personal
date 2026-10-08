import { createHash } from 'node:crypto'
import type pg from 'pg'
import type { Db } from '../pool.js'
import { AppError } from '../../../http/errors/app-error.js'
import { purchaseFirst, purchaseTransaction } from './purchases-shared.js'

export function createPurchaseIdempotency(
  db: Db,
  first: typeof purchaseFirst = purchaseFirst,
  transaction: typeof purchaseTransaction = purchaseTransaction,
) {
  return async function idempotent<T extends object>(
    actorId: string,
    operation: 'purchase_request_import' | 'purchase_order_generate',
    key: string,
    payload: unknown,
    run: (c: pg.PoolClient) => Promise<T>,
  ) {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    return transaction(db, async (c) => {
      await c.query(
        "insert into public.purchase_operation_idempotency(actor_id,operation,idempotency_key,payload_hash,status) values($1,$2,$3,$4,'PROCESSING') on conflict do nothing",
        [actorId, operation, key, hash],
      )
      const row = first(
        (
          await c.query(
            'select * from public.purchase_operation_idempotency where actor_id=$1 and operation=$2 and idempotency_key=$3 for update',
            [actorId, operation, key],
          )
        ).rows,
        'Idempotency row missing',
      )
      if (row.payload_hash !== hash)
        throw new AppError(
          409,
          'idempotency_key_payload_mismatch',
          'Idempotency-Key already used with a different payload',
        )
      if (row.status === 'COMPLETED') return { replayed: true, response: row.response as T }
      const response = await run(c)
      await c.query(
        "update public.purchase_operation_idempotency set status='COMPLETED',response=$4,updated_at=now() where actor_id=$1 and operation=$2 and idempotency_key=$3",
        [actorId, operation, key, response],
      )
      return { replayed: false, response }
    })
  }
}
