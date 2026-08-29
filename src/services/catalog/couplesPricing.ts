import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";
import { getPageTranslations } from "@/utils/i18n";

export type CouplesPicture = "one_small" | "one_big" | "individual";

export const COUPLES_PRICE: Record<CouplesPicture, number> = {
  one_small: 7500,
  one_big: 9000,
  individual: 9000,
};

export function formatCouplesProductName(
  picture: CouplesPicture,
  activityFormat: ActivityFormat,
  lang: string,
): string {
  const book = getPageTranslations(lang, "book");
  const label =
    picture === "one_small"
      ? book.couples_one_small
      : picture === "one_big"
        ? book.couples_one_big
        : book.couples_individual;
  return `${label}, ${activityFormat}`;
}
