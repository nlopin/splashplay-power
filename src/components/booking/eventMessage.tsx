const TRANSACTION_TITLE = `Transaction ID: `;
const TRANSACTION_ID_REGEX = /Transaction ID: (\w+)/g;

export function formatEventComment(
  transactionId: string,
  sessionTitle: string,
): string {
  return `${sessionTitle}\n${TRANSACTION_TITLE}${transactionId}`;
}

/**
 * What the group-event calendar can show: companions besides the booker,
 * then how many canvases they booked. One person has no "+0".
 */
export function formatOpenSessionInviteeName(
  name: string,
  guests: number,
  canvases?: number,
): string {
  const companions = guests - 1;
  const withCompanions =
    Number.isInteger(companions) && companions >= 1
      ? `${name} +${companions}`
      : name;
  if (!Number.isInteger(canvases) || (canvases ?? 0) < 1) return withCompanions;
  const label = canvases === 1 ? "canvas" : "canvases";
  return `${withCompanions}, ${canvases} ${label}`;
}

export function getTransactionIdFromEventComment(eventComment: string): string {
  const matches = [...eventComment.matchAll(TRANSACTION_ID_REGEX)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1];
  }
  return "";
}

export function getSessionTitleFromEventComment(eventComment: string): string {
  const [sessionTitle] = eventComment.split(TRANSACTION_TITLE);

  return sessionTitle.trim();
}
