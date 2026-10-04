const readOperations = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
]);

export function isDroppedConnection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string; message?: string };
  // Queue saturation is not a dropped connection: retrying adds more load.
  if (code === 'P2024' || /ECHECKOUTTIMEOUT|unable to check out connection/i.test(message || '')) return false;
  return code === 'P1001' || code === 'P1017' ||
    /closed the connection|Connection reset|Kind: Closed|Engine is not yet connected/i.test(message || '');
}

/** Retry one failed read without closing the pool used by other requests. Never replay writes. */
export async function withDatabaseReadRetry<T>(operation: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (!readOperations.has(operation) || !isDroppedConnection(error)) throw error;
    await new Promise(resolve => setTimeout(resolve, 150));
    return query();
  }
}
