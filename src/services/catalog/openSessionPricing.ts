import { getPageTranslations } from "@/utils/i18n";

export const OPEN_SESSION_TICKETS = [
  "solo",
  "pair_shared",
  "pair_two",
] as const;

export type OpenSessionTicket = (typeof OPEN_SESSION_TICKETS)[number];

export type OpenSessionCart = Record<OpenSessionTicket, number>;

export const OPEN_SESSION_CAPACITY = 6;

/** Max people in a single checkout — mixes allowed, e.g. 1 couple + 2 solo. */
export const OPEN_SESSION_MAX_PEOPLE_PER_PURCHASE = 4;

export const OPEN_SESSION_PRICE: Record<OpenSessionTicket, number> = {
  solo: 3200,
  pair_shared: 4700,
  pair_two: 6200,
};

export const OPEN_SESSION_GUESTS: Record<OpenSessionTicket, number> = {
  solo: 1,
  pair_shared: 2,
  pair_two: 2,
};

export function emptyOpenSessionCart(): OpenSessionCart {
  return { solo: 0, pair_shared: 0, pair_two: 0 };
}

export function openSessionPeople(cart: OpenSessionCart): number {
  return OPEN_SESSION_TICKETS.reduce(
    (sum, ticket) => sum + cart[ticket] * OPEN_SESSION_GUESTS[ticket],
    0,
  );
}

export function openSessionAmountCents(cart: OpenSessionCart): number {
  return OPEN_SESSION_TICKETS.reduce(
    (sum, ticket) => sum + cart[ticket] * OPEN_SESSION_PRICE[ticket],
    0,
  );
}

export function maxOpenSessionQuantity(
  ticket: OpenSessionTicket,
  options: {
    cart?: OpenSessionCart;
    spotsLeft?: number | null;
  } = {},
): number {
  const cart = options.cart ?? emptyOpenSessionCart();
  const othersPeople = openSessionPeople({ ...cart, [ticket]: 0 });
  let remaining = OPEN_SESSION_MAX_PEOPLE_PER_PURCHASE - othersPeople;
  if (options.spotsLeft != null) {
    remaining = Math.min(remaining, options.spotsLeft - othersPeople);
  }
  return Math.max(0, Math.floor(remaining / OPEN_SESSION_GUESTS[ticket]));
}

export function clampOpenSessionCart(
  cart: OpenSessionCart,
  spotsLeft?: number | null,
): OpenSessionCart {
  const next = emptyOpenSessionCart();
  for (const ticket of OPEN_SESSION_TICKETS) {
    const max = maxOpenSessionQuantity(ticket, { cart: next, spotsLeft });
    next[ticket] = Math.min(Math.max(0, cart[ticket] || 0), max);
  }
  return next;
}

export function openSessionQuantityFromGuests(
  ticket: OpenSessionTicket,
  guests: number,
): number | null {
  const perTicket = OPEN_SESSION_GUESTS[ticket];
  if (guests <= 0 || guests % perTicket !== 0) return null;
  return guests / perTicket;
}

export function cartFromTicketAndGuests(
  ticket: OpenSessionTicket,
  guests: number,
): OpenSessionCart | null {
  const quantity = openSessionQuantityFromGuests(ticket, guests);
  if (quantity == null) return null;
  return { ...emptyOpenSessionCart(), [ticket]: quantity };
}

export function isValidOpenSessionCart(cart: OpenSessionCart): boolean {
  const people = openSessionPeople(cart);
  if (people < 1 || people > OPEN_SESSION_MAX_PEOPLE_PER_PURCHASE) {
    return false;
  }
  for (const ticket of OPEN_SESSION_TICKETS) {
    const quantity = cart[ticket];
    if (!Number.isInteger(quantity) || quantity < 0) return false;
    if (quantity > maxOpenSessionQuantity(ticket, { cart })) return false;
  }
  return true;
}

export function isValidOpenSessionPurchase(
  ticket: OpenSessionTicket,
  guests: number,
): boolean {
  const cart = cartFromTicketAndGuests(ticket, guests);
  return cart != null && isValidOpenSessionCart(cart);
}

export function isOpenSessionTicket(
  value: string | null | undefined,
): value is OpenSessionTicket {
  return (
    value === "solo" || value === "pair_shared" || value === "pair_two"
  );
}

export function formatOpenSessionProductName(
  cart: OpenSessionCart,
  lang: string,
): string {
  const book = getPageTranslations(lang, "book");
  const labels: Record<OpenSessionTicket, string> = {
    solo: book.open_ticket_solo,
    pair_shared: book.open_ticket_shared,
    pair_two: book.open_ticket_pair,
  };
  const parts = OPEN_SESSION_TICKETS.flatMap((ticket) => {
    const quantity = cart[ticket];
    if (quantity <= 0) return [];
    return [quantity > 1 ? `${quantity} × ${labels[ticket]}` : labels[ticket]];
  });
  const summary = parts.join(" + ") || labels.solo;
  return `${summary}, Splash, 30×40`;
}
