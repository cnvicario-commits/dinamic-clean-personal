import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../../plugins/auth.js";
import { badRequest } from "../../errors/app-error.js";
import {
  clientIdSchema,
  createAddressBodySchema,
  createClientBodySchema,
  idempotencyKeySchema,
  quoteUploadBodySchema,
  statusBodySchema,
  updateAddressBodySchema,
  updateClientBodySchema,
} from "../../schemas/clients.js";

export const clientsRoutes: FastifyPluginAsync = async (app) => {
  const id = (raw: unknown) => {
    const p = clientIdSchema.safeParse({ id: raw });
    if (!p.success) throw badRequest("Invalid client id");
    return p.data.id;
  };
  const actor = (r: { auth?: { userId: string }; id: string }) => ({
    userId: r.auth!.userId,
    requestId: r.id,
  });
  app.get("/v1/clients", { preHandler: [requirePermission("clients:read")] }, () =>
    app.clientsService.list(),
  );
  app.get("/v1/clients/:id", { preHandler: [requirePermission("clients:read")] }, (r) =>
    app.clientsService.detail(id((r.params as { id?: unknown }).id)),
  );
  app.post(
    "/v1/clients",
    { preHandler: [requirePermission("clients:create")] },
    async (r, reply) => {
      const p = createClientBodySchema.safeParse(r.body);
      if (!p.success) throw badRequest("Invalid client payload");
      return reply.code(201).send(await app.clientsService.create(p.data, actor(r)));
    },
  );
  app.patch("/v1/clients/:id", { preHandler: [requirePermission("clients:update")] }, async (r) => {
    const p = updateClientBodySchema.safeParse(r.body);
    if (!p.success) throw badRequest("Invalid client payload");
    return app.clientsService.update(id((r.params as { id?: unknown }).id), p.data, actor(r));
  });
  app.get(
    "/v1/clients/:id/addresses",
    { preHandler: [requirePermission("client_addresses:read")] },
    (r) => app.clientsService.addresses(id((r.params as { id?: unknown }).id)),
  );
  app.post(
    "/v1/clients/:id/addresses",
    { preHandler: [requirePermission("client_addresses:update")] },
    async (r, reply) => {
      const p = createAddressBodySchema.safeParse(r.body);
      if (!p.success) throw badRequest("Invalid address payload");
      return reply
        .code(201)
        .send(
          await app.clientsService.createAddress(
            id((r.params as { id?: unknown }).id),
            p.data,
            actor(r),
          ),
        );
    },
  );
  app.patch(
    "/v1/clients/:id/addresses/:addressId",
    { preHandler: [requirePermission("client_addresses:update")] },
    async (r) => {
      const p = updateAddressBodySchema.safeParse(r.body);
      if (!p.success) throw badRequest("Invalid address payload");
      const q = r.params as { id?: unknown; addressId?: unknown };
      return app.clientsService.updateAddress(id(q.id), id(q.addressId), p.data, actor(r));
    },
  );
  app.patch(
    "/v1/clients/:id/addresses/:addressId/status",
    { preHandler: [requirePermission("client_addresses:update")] },
    async (r) => {
      const p = statusBodySchema.safeParse(r.body);
      if (!p.success) throw badRequest("Invalid status payload");
      const q = r.params as { id?: unknown; addressId?: unknown };
      return app.clientsService.setAddressStatus(
        id(q.id),
        id(q.addressId),
        p.data.activo,
        actor(r),
      );
    },
  );
  app.post(
    "/v1/clients/:id/addresses/:addressId/principal",
    { preHandler: [requirePermission("client_addresses:update")] },
    (r) => {
      const p = r.params as { id?: unknown; addressId?: unknown };
      return app.clientsService.setPrincipal(id(p.id), id(p.addressId), actor(r));
    },
  );
  app.get(
    "/v1/clients/:id/quotes",
    { preHandler: [requirePermission("client_quotes:read")] },
    (r) => app.clientQuotesService.list(id((r.params as { id?: unknown }).id)),
  );
  app.post(
    "/v1/clients/:id/quotes",
    { bodyLimit: 22_000_000, preHandler: [requirePermission("client_quotes:create")] },
    async (r, reply) => {
      const p = quoteUploadBodySchema.safeParse(r.body);
      if (!p.success) throw badRequest("Invalid quote upload");
      const key = idempotencyKeySchema.safeParse(r.headers["idempotency-key"]);
      if (!key.success) throw badRequest("Idempotency-Key header is required");
      const clientId = id((r.params as { id?: unknown }).id);
      const result = await app.clientQuotesService.upload({
        clientId,
        ...p.data,
        actorId: r.auth!.userId,
        requestId: r.id,
        idempotencyKey: key.data,
      });
      return reply.code(result.replayed ? 200 : 201).send(result.record);
    },
  );
  app.get(
    "/v1/clients/:id/quotes/:quoteId/download",
    { preHandler: [requirePermission("client_quotes:read")] },
    (r) => {
      const p = r.params as { id?: unknown; quoteId?: unknown };
      return app.clientQuotesService.download(id(p.id), id(p.quoteId));
    },
  );
  app.delete(
    "/v1/clients/:id/quotes/:quoteId",
    { preHandler: [requirePermission("client_quotes:delete")] },
    async (r, reply) => {
      const p = r.params as { id?: unknown; quoteId?: unknown };
      await app.clientQuotesService.remove({
        clientId: id(p.id),
        quoteId: id(p.quoteId),
        actorId: r.auth!.userId,
        requestId: r.id,
      });
      return reply.code(204).send();
    },
  );
};
