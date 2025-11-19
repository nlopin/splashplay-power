import { useState, useEffect } from "react";
import { useTranslator } from "../TranslatorContext";

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

export default function CouplesOptions({ onChange }: CouplesOptionsProps) {
  const [pictureType, setPictureType] = useState<PictureType>("one_big");
  const t = useTranslator();

  useEffect(() => {
    onChange(getPricing(pictureType));
  }, [pictureType]);

  return (
    <fieldset>
      <label>
        <input
          type="radio"
          name="picture_type"
          value="one_small"
          checked={pictureType === "one_small"}
          onChange={() => setPictureType("one_small")}
        />
        {t("couples_one_small")}
      </label>
      <label>
        <input
          type="radio"
          name="picture_type"
          value="one_big"
          checked={pictureType === "one_big"}
          onChange={() => setPictureType("one_big")}
        />
        {t("couples_one_big")}
      </label>
      <label>
        <input
          type="radio"
          name="picture_type"
          value="individual"
          checked={pictureType === "individual"}
          onChange={() => setPictureType("individual")}
        />
        {t("couples_individual")}
      </label>
    </fieldset>
  );
}
