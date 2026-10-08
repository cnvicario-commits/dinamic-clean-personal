import type { PurchasesRepository } from "../../infrastructure/db/purchases-repository.js";
type Actor = { userId: string; requestId: string };
export function createPurchasesService(
  repo: PurchasesRepository,
  log: (d: Record<string, unknown>, m: string) => void,
) {
  const mutation = async <T>(
    a: Actor,
    action: string,
    id: string | undefined,
    run: () => Promise<T>,
  ) => {
    const result = await run();
    log(
      { requestId: a.requestId, actorUserId: a.userId, action, resourceId: id, result: "ok" },
      "purchases domain mutation",
    );
    return result;
  };
  return {
    catalogs: repo.catalogs,
    listRequests: repo.listRequests,
    request: repo.requestDetail,
    listOrders: repo.listOrders,
    order: repo.orderDetail,
    listWarehouses: repo.listWarehouses,
    warehouse: repo.warehouseDetail,
    previewImport: repo.previewImport,
    createRequest: (i: Parameters<typeof repo.saveRequest>[0], a: Actor) =>
      mutation(a, "purchase_request.create", undefined, () => repo.saveRequest(i, a.userId)),
    updateRequest: (id: string, i: Parameters<typeof repo.saveRequest>[0], a: Actor) =>
      mutation(a, "purchase_request.update", id, () => repo.saveRequest(i, a.userId, id)),
    transition: (
      table: Parameters<typeof repo.transition>[0],
      id: string,
      state: string,
      a: Actor,
    ) => mutation(a, `${table}.transition`, id, () => repo.transition(table, id, state)),
    discard: (id: string, i: Parameters<typeof repo.discard>[1], a: Actor) =>
      mutation(a, "purchase_request_item.discard", id, () => repo.discard(id, i)),
    createOrder: (i: Parameters<typeof repo.createOrder>[0], a: Actor) =>
      mutation(a, "purchase_order.create", undefined, () => repo.createOrder(i, a.userId)),
    assign: (id: string, i: Parameters<typeof repo.applyAssignments>[1], key: string, a: Actor) =>
      mutation(a, "purchase_order.generate", id, () => repo.applyAssignments(id, i, key, a.userId)),
    applyImport: (i: Parameters<typeof repo.applyImport>[0], key: string, a: Actor) =>
      mutation(a, "purchase_request.import", undefined, () => repo.applyImport(i, key, a.userId)),
    duplicate: (kind: Parameters<typeof repo.duplicate>[0], id: string, a: Actor) =>
      mutation(a, `${kind}.duplicate`, id, () => repo.duplicate(kind, id, a.userId)),
  };
}
