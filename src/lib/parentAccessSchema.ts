/** Only missing parent-access schema is recoverable here; other DB failures must surface. */
export function isParentAccessSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; meta?: unknown; message?: string };
  return ['P2021', 'P2022'].includes(value.code || '')
    && /ParentAccessRequest|ParentAccessDelivery/.test(`${JSON.stringify(value.meta || {})} ${value.message || ''}`);
}
