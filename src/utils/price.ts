import { DEFAULT_LOCALE } from "@/constants";

export function formatPrice(amountInCents: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}
