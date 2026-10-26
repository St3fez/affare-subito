const STALE_AFTER_SEMESTERS = 4; // due anni

const ORDINAL = { 1: "primo", 2: "secondo" } as const;

/**
 * Un avviso quando i valori di mercato (OMI) sono vecchi: confrontare i prezzi di oggi con quelli di anni fa dà verdetti sbagliati.
 * `semester` ha la forma "2018-S2"; se non si riconosce non si avvisa.
 */
export function staleDataWarning(semester: string, now: Date): string | null {
  const match = semester.match(/^(\d{4})-S([12])$/);
  if (!match) return null;

  const year = Number(match[1]);
  const half = Number(match[2]) as 1 | 2;
  const current = now.getUTCFullYear() * 2 + (now.getUTCMonth() < 6 ? 1 : 2);
  const age = current - (year * 2 + half);
  if (age < STALE_AFTER_SEMESTERS) return null;

  return `I valori di mercato sono del ${ORDINAL[half]} semestre ${year}: i prezzi di oggi possono essere molto diversi, quindi il confronto è poco affidabile.`;
}
