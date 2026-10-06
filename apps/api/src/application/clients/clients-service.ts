import type { ClientsRepository } from "../../infrastructure/db/clients-repository.js";
import type {
  CreateAddressBody,
  CreateClientBody,
  UpdateAddressBody,
  UpdateClientBody,
} from "../../http/schemas/clients.js";

type Actor = { userId: string; requestId: string };
export function createClientsService(
  repo: ClientsRepository,
  log: (data: Record<string, unknown>, message: string) => void,
) {
  const audit = (actor: Actor, action: string, resourceId: unknown) =>
    log(
      { requestId: actor.requestId, actorUserId: actor.userId, action, resourceId, result: "ok" },
      "client domain mutation",
    );
  return {
    list: () => repo.list(),
    detail: (id: string) => repo.detail(id),
    addresses: (id: string) => repo.addresses(id),
    async create(input: CreateClientBody, actor: Actor) {
      const row = await repo.create(input);
      audit(actor, "client.create", (row as { id?: unknown }).id);
      return row;
    },
    async update(id: string, input: UpdateClientBody, actor: Actor) {
      const row = await repo.update(id, input);
      audit(actor, "client.update", id);
      return row;
    },
    async createAddress(clientId: string, input: CreateAddressBody, actor: Actor) {
      const row = await repo.createAddress(clientId, input);
      audit(actor, "client_address.create", (row as { id?: unknown }).id);
      return row;
    },
    async updateAddress(
      clientId: string,
      addressId: string,
      input: UpdateAddressBody,
      actor: Actor,
    ) {
      const row = await repo.updateAddress(clientId, addressId, input);
      audit(actor, "client_address.update", addressId);
      return row;
    },
    async setAddressStatus(clientId: string, addressId: string, activo: boolean, actor: Actor) {
      const row = await repo.setAddressStatus(clientId, addressId, activo);
      audit(actor, activo ? "client_address.activate" : "client_address.deactivate", addressId);
      return row;
    },
    async setPrincipal(clientId: string, addressId: string, actor: Actor) {
      const row = await repo.setPrincipal(clientId, addressId);
      audit(actor, "client_address.set_principal", addressId);
      return row;
    },
  };
}
