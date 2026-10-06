import { createHash, randomUUID } from "node:crypto";
import { AppError, badRequest } from "../../http/errors/app-error.js";
import type { ClientsRepository } from "../../infrastructure/db/clients-repository.js";
import type { ClientQuotesStorage } from "../../infrastructure/storage/client-quotes-storage.js";

export const MAX_QUOTE_BYTES = 15 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF-");
const IDEMPOTENCY_WAIT_MS = 50;
const IDEMPOTENCY_WAIT_ATTEMPTS = 500;

type QuoteRecord = {
  id: string;
  cliente_id: string;
  nombre_archivo: string;
  subido_por: string | null;
  created_at: string;
};
type QuoteWithStorage = QuoteRecord & { storage_path: string };
type Logger = (data: Record<string, unknown>, message: string) => void;

export function decodePdf(input: { fileName: string; contentBase64: string }) {
  const name = input.fileName.trim();
  if (!name || name.length > 255) throw badRequest("Invalid file name");
  if (!/\.pdf$/i.test(name)) throw badRequest("Only PDF files are allowed");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64))
    throw badRequest("Invalid file encoding");
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length === 0) throw badRequest("File is required");
  if (bytes.length > MAX_QUOTE_BYTES)
    throw new AppError(413, "quote_too_large", "Quote file exceeds 15 MB");
  if (bytes.subarray(0, PDF_MAGIC.length).compare(PDF_MAGIC) !== 0)
    throw badRequest("File content is not a PDF");
  return { name, bytes };
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}
function payloadHash(name: string, bytes: Buffer) {
  return createHash("sha256").update(name, "utf8").update("\0").update(bytes).digest("hex");
}
function publicQuote(quote: QuoteWithStorage | QuoteRecord): QuoteRecord {
  return {
    id: quote.id,
    cliente_id: quote.cliente_id,
    nombre_archivo: quote.nombre_archivo,
    subido_por: quote.subido_por,
    created_at: quote.created_at,
  };
}
function pause() {
  return new Promise<void>((resolve) => setTimeout(resolve, IDEMPOTENCY_WAIT_MS));
}
function errorCode(error: unknown) {
  return error instanceof AppError ? error.code : "unknown";
}

export function createClientQuotesService(
  repo: ClientsRepository,
  storage: ClientQuotesStorage,
  log: Logger,
) {
  async function markFailed(input: {
    clientId: string;
    actorId: string;
    idempotencyKey: string;
    payloadHash: string;
    storagePath: string;
    requestId: string;
    stage: string;
    originalError: unknown;
    quoteId?: string;
  }) {
    try {
      await repo.failQuoteUpload(input);
    } catch (markError) {
      log(
        {
          requestId: input.requestId,
          operation: "client_quote.upload",
          clientId: input.clientId,
          quoteId: input.quoteId ?? null,
          storagePath: input.storagePath,
          stage: `${input.stage}.idempotency_mark_failed`,
          originalErrorCode: errorCode(input.originalError),
          compensationErrorCode: errorCode(markError),
          result: "error",
        },
        "client quote idempotency failure state could not be persisted",
      );
    }
  }
  async function claim(input: {
    clientId: string;
    actorId: string;
    idempotencyKey: string;
    payloadHash: string;
    fileName: string;
  }) {
    for (let attempt = 0; attempt < IDEMPOTENCY_WAIT_ATTEMPTS; attempt += 1) {
      const storagePath = `${input.clientId}/${randomUUID()}_${safeName(input.fileName)}`;
      const result = await repo.claimQuoteUpload({ ...input, storagePath });
      if (result.state === "owner") return result;
      if (result.state === "completed")
        return {
          state: "completed" as const,
          quote: publicQuote(
            (await repo.getQuote(input.clientId, result.quoteId)) as QuoteWithStorage,
          ),
        };
      await pause();
    }
    throw new AppError(
      409,
      "idempotency_request_in_progress",
      "A matching quote upload is still in progress",
    );
  }
  return {
    list: (clientId: string) => repo.listQuotes(clientId),
    async upload(input: {
      clientId: string;
      fileName: string;
      contentBase64: string;
      actorId: string;
      requestId: string;
      idempotencyKey: string;
    }) {
      await repo.get(input.clientId);
      const file = decodePdf(input);
      const hash = payloadHash(file.name, file.bytes);
      const claimed = await claim({
        clientId: input.clientId,
        actorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
        payloadHash: hash,
        fileName: file.name,
      });
      if (claimed.state === "completed") return { record: claimed.quote, replayed: true };
      const storagePath = claimed.storagePath;
      try {
        await storage.upload(storagePath, file.bytes);
      } catch (error) {
        await markFailed({
          clientId: input.clientId,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: hash,
          storagePath,
          requestId: input.requestId,
          stage: "storage_upload",
          originalError: error,
        });
        throw error;
      }
      try {
        const record = (await repo.insertQuoteAndCompleteUpload({
          clientId: input.clientId,
          storagePath,
          fileName: file.name,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: hash,
        })) as QuoteRecord;
        log(
          {
            requestId: input.requestId,
            actorUserId: input.actorId,
            action: "client_quote.upload",
            clientId: input.clientId,
            resourceId: record.id,
            result: "ok",
          },
          "client domain mutation",
        );
        return { record: publicQuote(record), replayed: false };
      } catch (error) {
        try {
          await storage.remove(storagePath);
        } catch (compensationError) {
          log(
            {
              requestId: input.requestId,
              operation: "client_quote.upload",
              clientId: input.clientId,
              quoteId: null,
              storagePath,
              stage: "metadata_insert.storage_delete_compensation",
              originalErrorCode: errorCode(error),
              compensationErrorCode: errorCode(compensationError),
              result: "error",
            },
            "client quote compensation failed",
          );
        }
        await markFailed({
          clientId: input.clientId,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: hash,
          storagePath,
          requestId: input.requestId,
          stage: "metadata_insert",
          originalError: error,
        });
        throw error;
      }
    },
    async download(clientId: string, quoteId: string) {
      const quote = (await repo.getQuote(clientId, quoteId)) as QuoteWithStorage;
      return {
        url: await storage.signedUrl(quote.storage_path, 60),
        expiresIn: 60,
        fileName: quote.nombre_archivo,
      };
    },
    async remove(input: { clientId: string; quoteId: string; actorId: string; requestId: string }) {
      const quote = (await repo.deleteQuote(input.clientId, input.quoteId)) as QuoteWithStorage;
      try {
        await storage.remove(quote.storage_path);
      } catch (error) {
        try {
          await repo.restoreQuote({
            id: quote.id,
            clientId: input.clientId,
            storagePath: quote.storage_path,
            fileName: quote.nombre_archivo,
            actorId: quote.subido_por ?? input.actorId,
            createdAt: quote.created_at,
          });
        } catch (compensationError) {
          log(
            {
              requestId: input.requestId,
              operation: "client_quote.delete",
              clientId: input.clientId,
              quoteId: quote.id,
              storagePath: quote.storage_path,
              stage: "storage_delete.metadata_restore_compensation",
              originalErrorCode: errorCode(error),
              compensationErrorCode: errorCode(compensationError),
              result: "error",
            },
            "client quote compensation failed",
          );
        }
        throw error;
      }
      log(
        {
          requestId: input.requestId,
          actorUserId: input.actorId,
          action: "client_quote.delete",
          clientId: input.clientId,
          resourceId: quote.id,
          result: "ok",
        },
        "client domain mutation",
      );
    },
  };
}
