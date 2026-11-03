// Yükleme geçişleri (05 §10, R4): TanStack Query sonucundan ve isteğin kimliğinden türer; paket istek göndermez.
// Kimlik = arama + filtre + sıralama + sayfa. Verinin ait olduğu kimlik "snapshot"ta saklanır: `keepPreviousData` ile yeni
// anahtarda eski veri gösterilirken snapshot eski kimliktedir, bu yüzden geçiş kimlik değiştiren sayılır.
import { useEffect, useState } from 'react'
import type { DataTableResult } from '../types/list'

const SLOW_MS = 400
const BAR_MS = 150
const STILL_LOADING_MS = 10_000

/** `token` boş değilken `ms` dolunca true; token değişince yeniden sayar. */
function useElapsed(token: string | null, ms: number): boolean {
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => {
    if (token === null) return
    const t = setTimeout(() => setDone(token), ms)
    return () => clearTimeout(t)
  }, [token, ms])
  return token !== null && done === token
}

export interface Snapshot {
  identity: string
  page: { number: number; size: number }
  data: unknown
  at: number | undefined
}

export function useLoadState<Row extends object>(
  result: DataTableResult<Row> | undefined,
  identity: string,
  page: { number: number; size: number },
) {
  const pending = !!result && (result.status === 'pending' || !!result.isFetching)
  const settled = !!result && result.status === 'success' && !result.isFetching && !result.isPlaceholderData
  // Snapshot yalnızca yeni veriyle ilerler: istek değişip sonuç henüz güncellenmediyse eski veri yeni kimliğe yazılmaz.
  const [snap, setSnap] = useState<Snapshot | null>(null)
  if (settled && (!snap || snap.data !== result.data || snap.at !== result.dataUpdatedAt))
    setSnap({ identity, page, data: result.data, at: result.dataUpdatedAt })

  // Aynı anahtarda yenileme hatası eski satırları korur (Stale); yeni anahtarın hatasında veri yoktur (Error).
  const errorKind: 'error' | 'stale' | null =
    result?.status === 'error' ? (result.data?.rows.length ? 'stale' : 'error') : null
  const rows: Row[] = errorKind === 'error' ? [] : (result?.data?.rows ?? [])
  const hasRows = rows.length > 0
  const identityChange = pending && snap?.identity !== identity
  const dim = identityChange && hasRows

  // Aynı kimlikte art arda iki yükleme ayrı sayılsın: zamanlayıcı anahtarı son veri zamanını da taşır.
  const token = `${identity}|${result?.dataUpdatedAt ?? 0}`
  const slow = useElapsed(dim ? token : null, SLOW_MS)
  const refreshing = pending && !identityChange
  const bar = useElapsed(refreshing ? token : null, BAR_MS)
  const stillLoading = useElapsed(pending ? token : null, STILL_LOADING_MS)
  const skeleton = (pending && !hasRows) || slow

  return {
    pending,
    rows,
    hasRows,
    errorKind,
    dim,
    skeleton,
    /** 150 ms'den kısa yenilemede çubuk görünmez. */
    bar,
    stillLoading,
    refreshing,
    /** Footer'ın sayfalaması kilitli: kimlik değiştiren istek ya da ilk yükleme sürüyor. */
    busy: identityChange || (skeleton && !hasRows),
    /** Footer'ın okuduğu sayfa: ekrandaki verinin sayfası. */
    page: snap?.page ?? page,
    /** Ekrandaki verinin zamanı: yeni anahtar yüklenirken de eski verinin zamanı görünür. */
    updatedAt: snap?.at ? new Date(snap.at) : null,
  }
}
