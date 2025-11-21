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

export default function CouplesOptions({ onChange }: CouplesOptionsProps) {
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
    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
      <div
        style={{
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        }}
      >
        {options.map((option) => (
          <label
            key={option.value}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px 20px",
              border: "2px solid",
              borderColor: pictureType === option.value ? "#007cba" : "#e9ecef",
              borderRadius: "12px",
              backgroundColor:
                pictureType === option.value ? "#e3f2fd" : "white",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow:
                pictureType === option.value
                  ? "0 2px 8px rgba(0, 124, 186, 0.2)"
                  : "none",
            }}
            onMouseEnter={(e) => {
              if (pictureType !== option.value) {
                e.currentTarget.style.borderColor = "#007cba";
                e.currentTarget.style.backgroundColor = "#f8fafe";
              }
            }}
            onMouseLeave={(e) => {
              if (pictureType !== option.value) {
                e.currentTarget.style.borderColor = "#e9ecef";
                e.currentTarget.style.backgroundColor = "white";
              }
            }}
          >
            <input
              type="radio"
              name="picture_type"
              value={option.value}
              checked={pictureType === option.value}
              onChange={() => setPictureType(option.value as PictureType)}
              style={{
                marginRight: "12px",
                width: "20px",
                height: "20px",
                accentColor: "#007cba",
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: "600",
                  fontSize: "16px",
                  color: "#333",
                  marginBottom: "4px",
                }}
              >
                {option.label}
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#007cba",
                }}
              >
                {option.price}
              </div>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
