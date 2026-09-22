import { useEffect, useRef, useState } from "react";

import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";
import {
  clampOpenSessionCart,
  emptyOpenSessionCart,
  formatOpenSessionProductName,
  isOpenSessionTicket,
  maxOpenSessionQuantity,
  OPEN_SESSION_GUESTS,
  OPEN_SESSION_PRICE,
  OPEN_SESSION_TICKETS,
  openSessionAmountCents,
  openSessionPeople,
  type OpenSessionCart,
  type OpenSessionTicket,
} from "@/services/catalog/openSessionPricing";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

const DEFAULT_CART: OpenSessionCart = emptyOpenSessionCart();

function cartsEqual(a: OpenSessionCart, b: OpenSessionCart): boolean {
  return OPEN_SESSION_TICKETS.every((ticket) => a[ticket] === b[ticket]);
}

function cartFromUrl(): OpenSessionCart | null {
  const params = new URLSearchParams(window.location.search);
  const cart = emptyOpenSessionCart();
  let found = false;
  for (const ticket of OPEN_SESSION_TICKETS) {
    const parsed = parseInt(params.get(ticket) ?? "", 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      cart[ticket] = parsed;
      found = true;
    }
  }
  if (found) return cart;

  const option = params.get("option");
  if (isOpenSessionTicket(option)) {
    return { ...emptyOpenSessionCart(), [option]: 1 };
  }
  return null;
}

function writeCartToUrl(cart: OpenSessionCart) {
  const url = new URL(window.location.href);
  url.searchParams.delete("option");
  for (const ticket of OPEN_SESSION_TICKETS) {
    if (cart[ticket] > 0) {
      url.searchParams.set(ticket, String(cart[ticket]));
    } else {
      url.searchParams.delete(ticket);
    }
  }
  window.history.replaceState({}, "", url);
}

export function OpenSessionOptions({
  onChange,
  spotsLeft,
}: EventTypeOptionsProps) {
  const t = useTranslator();
  const lang = usePageLanguage();
  const [cart, setCart] = useState<OpenSessionCart>(DEFAULT_CART);
  const didHydrate = useRef(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      const fromUrl = cartFromUrl();
      if (fromUrl && !cartsEqual(fromUrl, cart)) {
        setCart(clampOpenSessionCart(fromUrl, spotsLeft));
        return;
      }
    }

    const clamped = clampOpenSessionCart(cart, spotsLeft);
    if (!cartsEqual(clamped, cart)) {
      setCart(clamped);
      return;
    }

    onChangeRef.current({
      amount: openSessionAmountCents(cart),
      productName: formatOpenSessionProductName(cart, lang),
      guests: openSessionPeople(cart),
      openCart: cart,
    });

    writeCartToUrl(cart);
  }, [cart, lang, spotsLeft]);

  const setQuantity = (ticket: OpenSessionTicket, quantity: number) => {
    setCart((current) => {
      const max = maxOpenSessionQuantity(ticket, { cart: current, spotsLeft });
      return {
        ...current,
        [ticket]: Math.min(Math.max(0, quantity), max),
      };
    });
  };

  const options: Array<{
    value: OpenSessionTicket;
    label: string;
    desc: string;
    featured: boolean;
  }> = [
    {
      value: "solo",
      label: t("open_ticket_solo"),
      desc: t("open_ticket_solo_desc"),
      featured: false,
    },
    {
      value: "pair_shared",
      label: t("open_ticket_shared"),
      desc: t("open_ticket_shared_desc"),
      featured: false,
    },
    {
      value: "pair_two",
      label: t("open_ticket_pair"),
      desc: t("open_ticket_pair_desc"),
      featured: true,
    },
  ];

  const selectedTypes = OPEN_SESSION_TICKETS.filter(
    (ticket) => cart[ticket] > 0,
  ).length;

  return (
    <div className="open-session-options">
      <h3 className="open-session-options-title">{t("choose_ticket")}</h3>
      <div className="open-ticket-list">
        {options.map((option) => {
          const quantity = cart[option.value];
          const maxQty = maxOpenSessionQuantity(option.value, {
            cart,
            spotsLeft,
          });
          const slotTooSmall =
            spotsLeft != null &&
            spotsLeft < OPEN_SESSION_GUESTS[option.value] &&
            quantity === 0;
          const selected = quantity > 0;
          return (
            <div
              key={option.value}
              className={`open-ticket-card${selected ? " selected" : ""}${slotTooSmall ? " disabled" : ""}`}
            >
              {option.featured && (
                <div className="popular-badge">{t("most_popular")}</div>
              )}
              <div className="open-ticket-copy">
                <span className="open-ticket-label">{option.label}</span>
                <span className="open-ticket-desc">{option.desc}</span>
                {slotTooSmall && (
                  <span className="open-ticket-unavailable">
                    {t("ticket_not_enough_spots")}
                  </span>
                )}
                <div className="open-ticket-stepper">
                  <button
                    type="button"
                    className="open-ticket-stepper-btn"
                    onClick={() => setQuantity(option.value, quantity - 1)}
                    disabled={quantity <= 0}
                    aria-label="-"
                  >
                    −
                  </button>
                  <span className="open-ticket-stepper-value">{quantity}</span>
                  <button
                    type="button"
                    className="open-ticket-stepper-btn"
                    onClick={() => setQuantity(option.value, quantity + 1)}
                    disabled={quantity >= maxQty || slotTooSmall}
                    aria-label="+"
                  >
                    +
                  </button>
                </div>
              </div>
              <span className="open-ticket-price">
                {formatPrice(
                  OPEN_SESSION_PRICE[option.value] * Math.max(quantity, 1),
                )}
              </span>
            </div>
          );
        })}
      </div>
      {selectedTypes > 1 && (
        <div className="open-ticket-total">
          {t("total_price")} {formatPrice(openSessionAmountCents(cart))}
        </div>
      )}
    </div>
  );
}
