import type { Db } from "./pool.js";
import { purchaseFirst as first, purchaseTransaction as transaction } from "./purchases/purchases-shared.js";
import { createPurchaseIdempotency } from "./purchases/purchases-idempotency.js";
import { createPurchasesCatalogsAndLists } from "./purchases/purchases-catalogs-lists.js";
import { createPurchaseRequestMethods } from "./purchases/purchase-requests.js";
import { createPurchaseOrderMethods } from "./purchases/purchase-orders.js";
import { createPurchaseAssignmentMethods } from "./purchases/purchase-assignments.js";
import { createPurchaseImportMethods } from "./purchases/purchase-imports.js";
import { createPurchaseDuplicateMethods } from "./purchases/purchase-duplicate.js";

export function createPurchasesRepository(db: Db) {
  const idempotent = createPurchaseIdempotency(db, first, transaction);
  const { catalogs, listRequests, listOrders, listWarehouses } = createPurchasesCatalogsAndLists(db);

  const { validate, requestDetail, saveRequest, transition, discard } = createPurchaseRequestMethods(
    db,
    first,
    transaction,
  );
  const { genericDetail, createOrder } = createPurchaseOrderMethods(db, first, transaction, validate);
  const { applyAssignments } = createPurchaseAssignmentMethods(first, idempotent);
  const { previewImport, applyImport } = createPurchaseImportMethods(db, first, validate, idempotent);
  const { duplicate } = createPurchaseDuplicateMethods(
    db,
    first,
    transaction,
    requestDetail,
    saveRequest,
  );

  return {
    catalogs,
    listRequests,
    requestDetail,
    saveRequest,
    transition,
    createOrder,
    orderDetail: (id: string) => genericDetail("order", id),
    warehouseDetail: (id: string) => genericDetail("warehouse", id),
    listOrders,
    listWarehouses,
    applyAssignments,
    previewImport,
    applyImport,
    duplicate,
    discard,
  };
}
export type PurchasesRepository = ReturnType<typeof createPurchasesRepository>;
