import type { ResultsRepository } from '../../infrastructure/db/results-repository.js'

type Actor = { userId: string; requestId: string }

export function createResultsService(
  repo: ResultsRepository,
  log: (d: Record<string, unknown>, m: string) => void,
) {
  const audit = (a: Actor, action: string) =>
    log(
      { requestId: a.requestId, actorUserId: a.userId, action, result: 'ok' },
      'results domain operation',
    )

  return {
    list: repo.list,
    detail: repo.detail,
    preview: repo.preview,
    apply: (i: Parameters<typeof repo.apply>[0], key: string, a: Actor) =>
      repo.apply(i, key, a.userId).then((v) => {
        audit(a, 'results.import.apply')
        return v
      }),
  }
}
