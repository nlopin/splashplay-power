import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";
import { getPageTranslations } from "@/utils/i18n";

export type CouplesPicture = "one_small" | "one_big" | "two_big" | "individual";

export const COUPLES_PRICE: Record<CouplesPicture, number> = {
  one_small: 7500,
  one_big: 9000,
  two_big: 12400,
  individual: 9000,
};

export function formatCouplesProductName(
  picture: CouplesPicture,
  activityFormat: ActivityFormat,
  lang: string,
): string {
  const book = getPageTranslations(lang, "book");
  const labels: Record<CouplesPicture, string> = {
    one_small: book.couples_one_small,
    one_big: book.couples_one_big,
    two_big: book.couples_two_big,
    individual: book.couples_individual,
  };
  return `${labels[picture]}, ${activityFormat}`;
}
