import type { CatalogRepository } from "../../infrastructure/db/catalog-repository.js";
import { createHash } from "node:crypto";
type Actor = { userId: string; requestId: string };
export function createCatalogService(
  repo: CatalogRepository,
  log: (d: Record<string, unknown>, m: string) => void,
) {
  const audit = (a: Actor, action: string, id: unknown) =>
    log(
      { requestId: a.requestId, actorUserId: a.userId, action, resourceId: id, result: "ok" },
      "catalog domain mutation",
    );
  return {
    listSuppliers: () => repo.listSuppliers(),
    supplier: (id: string) => repo.supplier(id),
    supplierArticles: (id: string) => repo.supplierArticles(id),
    pending: () => repo.pending(),
    async createSupplier(i: Record<string, unknown>, a: Actor) {
      const r = await repo.createSupplier(i);
      audit(a, "supplier.create", (r as { id: string }).id);
      return r;
    },
    async updateSupplier(id: string, i: Record<string, unknown>, a: Actor) {
      const r = await repo.updateSupplier(id, i);
      audit(a, "supplier.update", id);
      return r;
    },
    async supplierStatus(id: string, activo: boolean, a: Actor) {
      const r = await repo.supplierStatus(id, activo);
      audit(a, activo ? "supplier.activate" : "supplier.deactivate", id);
      return r;
    },
    listArticles: () => repo.listArticles(),
    article: (id: string) => repo.article(id),
    relations: (id: string) => repo.relations(id),
    previewArticleImport: (rows: Array<Record<string, unknown>>) => repo.previewArticleImport(rows),
    previewPriceList: (i: {
      proveedorId: string;
      archivoOrigen: string;
      rows: Array<Record<string, unknown>>;
    }) => repo.previewPriceList(i),
    async createArticle(i: Record<string, unknown>, a: Actor) {
      const r = await repo.createArticle(i);
      audit(a, "article.create", (r as { id: string }).id);
      return r;
    },
    async updateArticle(id: string, i: Record<string, unknown>, a: Actor) {
      const r = await repo.updateArticle(id, i);
      audit(a, "article.update", id);
      return r;
    },
    async articleStatus(id: string, activo: boolean, a: Actor) {
      const r = await repo.articleStatus(id, activo);
      audit(a, activo ? "article.activate" : "article.deactivate", id);
      return r;
    },
    async createRelation(articleId: string, i: Record<string, unknown>, a: Actor) {
      const r = await repo.createRelation(articleId, i);
      audit(a, "article_supplier.create", (r as { id: string }).id);
      return r;
    },
    async updateRelation(articleId: string, id: string, i: Record<string, unknown>, a: Actor) {
      const r = await repo.updateRelation(articleId, id, i);
      audit(a, "article_supplier.update", id);
      return r;
    },
    async resolvePending(pendingId: string, articleId: string, a: Actor) {
      const r = await repo.resolvePending(pendingId, articleId);
      audit(a, "article_supplier_pending.resolve", pendingId);
      return r;
    },
    async importArticles(rows: Array<Record<string, unknown>>, key: string, a: Actor) {
      const r = await repo.importArticles(rows, {
        actorId: a.userId,
        key,
        payloadHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
      });
      audit(a, "articles.import", null);
      return r;
    },
    async applyPriceList(
      i: { proveedorId: string; archivoOrigen: string; rows: Array<Record<string, unknown>> },
      key: string,
      a: Actor,
    ) {
      const r = await repo.applyPriceList(i, {
        actorId: a.userId,
        key,
        payloadHash: createHash("sha256").update(JSON.stringify(i)).digest("hex"),
      });
      audit(a, "price_list.apply", i.proveedorId);
      return r;
    },
  };
}
