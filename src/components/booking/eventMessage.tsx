const TRANSACTION_TITLE = `Transaction ID: `;
const TRANSACTION_ID_REGEX = /Transaction ID: (\w+)/g;

export function formatEventComment(
  transactionId: string,
  sessionTitle: string,
): string {
  return `${sessionTitle}\n${TRANSACTION_TITLE}${transactionId}`;
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
