import { useState, useEffect } from "react";
import { useTranslator } from "../../TranslatorContext";

type PictureType = "one_small" | "one_big" | "individual";

interface PricingData {
  amount: number;
  productName: string;
}

interface CouplesOptionsProps {
  onChange: (data: PricingData) => void;
}

const getPricing = (type: PictureType): PricingData => {
  switch (type) {
    case "one_small":
      return { amount: 6000, productName: "One Small Canvas" };
    case "one_big":
      return { amount: 8000, productName: "One Big Canvas" };
    case "individual":
      return { amount: 9000, productName: "Two Canvases" };
  }
};

export function CouplesOptions({ onChange }: CouplesOptionsProps) {
  const [pictureType, setPictureType] = useState<PictureType>("one_big");
  const t = useTranslator();

  useEffect(() => {
    onChange(getPricing(pictureType));
  }, [pictureType]);

  const options = [
    { value: "one_small", label: t("couples_one_small"), price: "€60" },
    { value: "one_big", label: t("couples_one_big"), price: "€80" },
    { value: "individual", label: t("couples_individual"), price: "€90" },
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
            onChange={() => setPictureType(option.value as PictureType)}
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
