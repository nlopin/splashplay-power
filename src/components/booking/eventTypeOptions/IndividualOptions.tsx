import { useEffect } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

// Fixed price for individual booking
const INDIVIDUAL_PRICE = 6000;

export function IndividualOptions({
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const t = useTranslator();

  // Set the fixed price on mount and notify parent
  useEffect(() => {
    onChange({
      amount: INDIVIDUAL_PRICE,
      productName: t("individual_session"),
    });
  }, [onChange, t]);

  const discountedPrice = discount
    ? Math.round(INDIVIDUAL_PRICE * (1 - discount / 100))
    : INDIVIDUAL_PRICE;

  return (
    <div className="options-grid-unified">
      {showPrice && (
        <>
          <div className="option-label total-price-label">
            {t("total_price")}
          </div>
          <div></div>
          <div className="total-price">
            {discount ? (
              <>
                <span className="price-before">
                  <span className="price-original">
                    {formatPrice(INDIVIDUAL_PRICE)}
                  </span>
                </span>
                <span className="price-final">
                  {formatPrice(discountedPrice)}
                </span>
              </>
            ) : (
              formatPrice(INDIVIDUAL_PRICE)
            )}
          </div>
          <div></div>
        </>
      )}
    </div>
  );
}
