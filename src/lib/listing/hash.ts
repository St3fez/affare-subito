/** Hash djb2 in base 36: serve solo a dare una chiave stabile a testi e dati inseriti a mano. */
export function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
