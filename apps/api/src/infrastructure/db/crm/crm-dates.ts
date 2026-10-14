import pg from "pg";
import type { Db } from "../pool.js";

const DATE_OID = pg.types.builtins.DATE;

function hasDateParser(client: pg.PoolClient): boolean {
  return typeof client.setTypeParser === "function" && typeof client.getTypeParser === "function";
}

/** Keep PostgreSQL date (OID 1082) as YYYY-MM-DD on this checkout only. */
export function useCrmCalendarDates(client: pg.PoolClient): pg.PoolClient {
  if (!hasDateParser(client)) return client;
  const previous = client.getTypeParser(DATE_OID, "text");
  client.setTypeParser(DATE_OID, (value: string) => value);
  const release = client.release.bind(client);
  client.release = (err?: Error | boolean) => {
    client.setTypeParser(DATE_OID, previous);
    client.release = release;
    release(err);
  };
  return client;
}

export function withCrmCalendarDates(db: Db): Db {
  if (typeof db.pool?.connect !== "function") return db;
  return {
    ...db,
    async query(text, params) {
      const client = useCrmCalendarDates(await db.pool.connect());
      try {
        return await client.query(text, params);
      } finally {
        client.release();
      }
    },
    pool: {
      connect: async () => useCrmCalendarDates(await db.pool.connect()),
    } as Db["pool"],
  };
}
