import { useState, useEffect } from "react";

import { formatPrice } from "@/utils/price";
import { useTranslator } from "@/components/TranslatorContext";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

type PictureType = "one_small" | "one_big" | "individual";

const PRICE: Record<PictureType, number> = {
  one_small: 6000,
  one_big: 8000,
  individual: 9000,
};

const IMAGES: Record<PictureType, string> = {
  one_small: "/img/30x40_compartido.jpg",
  one_big: "/img/60x80_compartido.jpg",
  individual: "/img/30x40_2individuales.jpg",
};

export function CouplesOptions({ onChange }: EventTypeOptionsProps) {
  const [pictureType, setPictureType] = useState<PictureType>("one_big");
  const t = useTranslator();

  useEffect(() => {
    onChange({
      amount: PRICE[pictureType],
      productName: t(`couples_${pictureType}`),
    });
  }, [pictureType, t]);

  const options: Array<{
    value: PictureType;
    label: string;
    price: string;
    image: string;
  }> = [
    {
      value: "one_small",
      label: t("couples_one_small"),
      price: formatPrice(PRICE.one_small),
      image: IMAGES.one_small,
    },
    {
      value: "one_big",
      label: t("couples_one_big"),
      price: formatPrice(PRICE.one_big),
      image: IMAGES.one_big,
    },
    {
      value: "individual",
      label: t("couples_individual"),
      price: formatPrice(PRICE.individual),
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
              <div className="option-price">{option.price}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
