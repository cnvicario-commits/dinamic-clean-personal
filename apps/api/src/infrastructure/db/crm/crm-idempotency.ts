import crypto from "node:crypto";
import type pg from "pg";
import type { Db } from "../pool.js";
import { conflict } from "../../../http/errors/app-error.js";

const hash = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createCrmOpportunityIdempotency(
  db: Db,
  tx: <T>(db: Db, run: (c: pg.PoolClient) => Promise<T>) => Promise<T>,
  first: <T>(rows: T[], message: string) => T,
) {
  return async <T>(
    actor: string,
    key: string,
    payload: unknown,
    run: (c: pg.PoolClient) => Promise<T>,
  ) =>
    tx(db, async (c) => {
      const h = hash(payload);
      await c.query(
        "insert into public.crm_operation_idempotency(actor_id,operation,idempotency_key,payload_hash,status) values($1,'opportunity_create',$2,$3,'PROCESSING') on conflict do nothing",
        [actor, key, h],
      );
      const current = first(
        (
          await c.query<{ payload_hash: string; status: string; response: T | null }>(
            "select payload_hash,status,response from public.crm_operation_idempotency where actor_id=$1 and operation=$2 and idempotency_key=$3 for update",
            [actor, "opportunity_create", key],
          )
        ).rows,
        "Idempotency unavailable",
      );
      if (current.payload_hash !== h)
        throw conflict("Idempotency-Key was already used with a different payload");
      if (current.status === "COMPLETED" && current.response)
        return { replayed: true, response: current.response };
      const response = await run(c);
      await c.query(
        "update public.crm_operation_idempotency set status='COMPLETED',response=$4,updated_at=now() where actor_id=$1 and operation=$2 and idempotency_key=$3",
        [actor, "opportunity_create", key, JSON.stringify(response)],
      );
      return { replayed: false, response };
    });
}
