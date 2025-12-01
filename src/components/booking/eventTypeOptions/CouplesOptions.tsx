import { useState, useEffect } from "react";
import { useTranslator } from "../../TranslatorContext";
import { formatPrice } from "@/utils/price";

type PictureType = "one_small" | "one_big" | "individual";

interface PricingData {
  amount: number;
  productName: string;
}

interface CouplesOptionsProps {
  onChange: (data: PricingData) => void;
}

const PRICE: Record<PictureType, number> = {
  one_small: 6000,
  one_big: 8000,
  individual: 9000,
};

export function CouplesOptions({ onChange }: CouplesOptionsProps) {
  const [pictureType, setPictureType] = useState<PictureType>("one_big");
  const t = useTranslator();

  useEffect(() => {
    onChange({
      amount: PRICE[pictureType],
      productName: t(`couples_${pictureType}`),
    });
  }, [pictureType, t]);

  const options: Array<{ value: PictureType; label: string; price: string }> = [
    {
      value: "one_small",
      label: t("couples_one_small"),
      price: formatPrice(PRICE.one_small),
    },
    {
      value: "one_big",
      label: t("couples_one_big"),
      price: formatPrice(PRICE.one_big),
    },
    {
      value: "individual",
      label: t("couples_individual"),
      price: formatPrice(PRICE.individual),
    },
  ];

  return (
    <div className="options-grid">
      {options.map((option) => (
        <label
          key={option.value}
          className={`option-card ${pictureType === option.value ? "selected" : ""}`}
        >
          <input
            type="radio"
            name="picture_type"
            value={option.value}
            checked={pictureType === option.value}
            onChange={() =>
              ((newType: PictureType) => {
                setPictureType(newType);
              })(option.value)
            }
            className="option-input"
          />
          <div className="option-content">
            <div className="option-label">{option.label}</div>
            <div className="option-price">{option.price}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
