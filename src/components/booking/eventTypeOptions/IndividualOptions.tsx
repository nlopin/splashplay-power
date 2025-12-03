import { useEffect } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

// Fixed price for individual booking
const INDIVIDUAL_PRICE = 6000;

export function IndividualOptions({ onChange }: EventTypeOptionsProps) {
  const t = useTranslator();

  // Set the fixed price on mount and notify parent
  useEffect(() => {
    onChange({
      amount: INDIVIDUAL_PRICE,
      productName: t("individual_session"),
    });
  }, [onChange, t]);

  return (
    <div className="friends-options">
      <div className="options-grid-unified">
        <div className="option-label total-price-label">{t("total_price")}</div>
        <div></div>
        <div className="total-price">{formatPrice(INDIVIDUAL_PRICE)}</div>
        <div></div>
      </div>
    </div>
  );
}
