import { useState, useEffect } from "react";
import one_small from "@/assets/img/30x40_compartido.jpg";
import one_big from "@/assets/img/60x80_compartido.jpg";
import individual from "@/assets/img/30x40_2individuales.jpg";

import { formatPrice } from "@/utils/price";
import { useTranslator } from "@/components/TranslatorContext";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

type PictureType = "one_small" | "one_big" | "individual";

const PRICE: Record<PictureType, number> = {
  one_small: 7500,
  one_big: 9000,
  individual: 9000,
};

const IMAGES: Record<PictureType, string> = {
  one_small: one_small.src,
  one_big: one_big.src,
  individual: individual.src,
};

export function CouplesOptions({
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const [pictureType, setPictureType] = useState<PictureType>("one_big");
  const t = useTranslator();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("option") as PictureType | null;

    if (
      typeParam &&
      (typeParam === "one_small" ||
        typeParam === "one_big" ||
        typeParam === "individual")
    ) {
      setPictureType(typeParam);
    }
  }, []);

  useEffect(() => {
    onChange({
      amount: PRICE[pictureType],
      productName: t(`couples_${pictureType}`),
    });

    // Update URL with the selected option
    const url = new URL(window.location.href);
    url.searchParams.set("option", pictureType);
    window.history.replaceState({}, "", url);
  }, [pictureType, t]);

  const options: Array<{
    value: PictureType;
    label: string;
    price: string;
    discountedPrice: string | null;
    image: string;
  }> = [
    {
      value: "one_small",
      label: t("couples_one_small"),
      price: formatPrice(PRICE.one_small),
      discountedPrice: discount
        ? formatPrice(Math.round(PRICE.one_small * (1 - discount / 100)))
        : null,
      image: IMAGES.one_small,
    },
    {
      value: "one_big",
      label: t("couples_one_big"),
      price: formatPrice(PRICE.one_big),
      discountedPrice: discount
        ? formatPrice(Math.round(PRICE.one_big * (1 - discount / 100)))
        : null,
      image: IMAGES.one_big,
    },
    {
      value: "individual",
      label: t("couples_individual"),
      price: formatPrice(PRICE.individual),
      discountedPrice: discount
        ? formatPrice(Math.round(PRICE.individual * (1 - discount / 100)))
        : null,
      image: IMAGES.individual,
    },
  ];

  return (
    <div className="couples-options-section">
      <h3 className="couples-options-title">{t("choose_canvas")}</h3>
      <div className="couples-options-grid">
        {options.map((option) => (
          <label
            key={option.value}
            className={`couples-option-card ${
              pictureType === option.value ? "selected" : ""
            }`}
          >
            {option.value === "one_big" && (
              <div className="popular-badge">{t("most_popular")}</div>
            )}
            <input
              type="radio"
              name="picture_type"
              value={option.value}
              checked={pictureType === option.value}
              onChange={() => setPictureType(option.value)}
              className="option-input"
            />
            <div className="couples-option-image-container">
              <img
                src={option.image}
                alt={option.label}
                className="couples-option-image"
                loading="lazy"
              />
            </div>
            <div className="option-content">
              <div className="option-label">{option.label}</div>
              {showPrice && (
                <div className="option-price">
                  {option.discountedPrice ? (
                    <>
                      <span className="price-before">
                        <span className="price-original">{option.price}</span>
                        <span className="discount-badge">-{discount}%</span>
                      </span>
                      <span className="price-final">
                        {option.discountedPrice}
                      </span>
                    </>
                  ) : (
                    option.price
                  )}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
