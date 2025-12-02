import { useState, useEffect } from "react";
import { useTranslator } from "../../TranslatorContext";
import { formatPrice } from "@/utils/price";
import type { EventTypeOptionsProps } from "./EventTypeOptions";

const CANVAS_PRICE = 3000; // €30 per canvas in cents

export interface FamilyFormData {
  adults: number;
  kids: number;
  canvases: number;
}

export function FamilyOptions({ onChange }: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FamilyFormData>({
    adults: 2,
    kids: 1,
    canvases: 1,
  });
  const t = useTranslator();

  // Update canvas count when kids count changes (default behavior)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      canvases: Math.max(1, prev.kids), // Ensure at least 1 canvas
    }));
  }, [formData.kids]);

  // Calculate total price and notify parent
  useEffect(() => {
    const totalAmount = formData.canvases * CANVAS_PRICE;
    const productName = `${formData.adults} adults, ${formData.kids} kids, ${formData.canvases} canvases`;

    onChange({
      amount: totalAmount,
      productName,
    });
  }, [formData, t, onChange]);

  const handleInputChange = (field: keyof FamilyFormData, value: number) => {
    const clampedValue = Math.max(
      1,
      Math.min(value, field === "canvases" ? 10 : 9),
    );

    setFormData((prev) => {
      const newData = { ...prev, [field]: clampedValue };

      // Validate total people limit
      if (field === "adults" || field === "kids") {
        const totalPeople =
          (field === "adults" ? clampedValue : prev.adults) +
          (field === "kids" ? clampedValue : prev.kids);

        if (totalPeople > 9) {
          return prev; // Don't update if it would exceed limit
        }
      }

      return newData;
    });
  };

  const totalPeople = formData.adults + formData.kids;
  const totalPrice = formData.canvases * CANVAS_PRICE;

  return (
    <div className="family-options">
      <div className="options-grid">
        <div className="option-card">
          <div className="option-content">
            <div className="option-label">{t("family_adults_count")}</div>
            <div className="number-input-container">
              <button
                type="button"
                className="number-input-btn"
                onClick={() => handleInputChange("adults", formData.adults - 1)}
                disabled={formData.adults <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="9"
                value={formData.adults}
                onChange={(e) =>
                  handleInputChange("adults", parseInt(e.target.value) || 1)
                }
                className="number-input"
              />
              <button
                type="button"
                className="number-input-btn"
                onClick={() => handleInputChange("adults", formData.adults + 1)}
                disabled={totalPeople >= 9}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="option-card">
          <div className="option-content">
            <div className="option-label">{t("family_kids_count")}</div>
            <div className="number-input-container">
              <button
                type="button"
                className="number-input-btn"
                onClick={() => handleInputChange("kids", formData.kids - 1)}
                disabled={formData.kids <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="9"
                value={formData.kids}
                onChange={(e) =>
                  handleInputChange("kids", parseInt(e.target.value) || 1)
                }
                className="number-input"
              />
              <button
                type="button"
                className="number-input-btn"
                onClick={() => handleInputChange("kids", formData.kids + 1)}
                disabled={totalPeople >= 9}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="option-card">
          <div className="option-content">
            <div className="option-label">
              {t("family_canvas_count")}
              <span className="canvas-price-info">
                {formatPrice(CANVAS_PRICE)} {t("family_canvas_price_info")}
              </span>
            </div>
            <div className="number-input-container">
              <button
                type="button"
                className="number-input-btn"
                onClick={() =>
                  handleInputChange("canvases", formData.canvases - 1)
                }
                disabled={formData.canvases <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.canvases}
                onChange={(e) =>
                  handleInputChange("canvases", parseInt(e.target.value) || 1)
                }
                className="number-input"
              />
              <button
                type="button"
                className="number-input-btn"
                onClick={() =>
                  handleInputChange("canvases", formData.canvases + 1)
                }
                disabled={formData.canvases >= 10}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="family-summary">
        <div className="summary-item">
          <span>{t("family_total_people")}: </span>
          <strong>{totalPeople}</strong>
          <span className="limit-info"> ({t("family_people_limit")})</span>
        </div>
        <div className="summary-item">
          <span>{t("family_total_canvases")}: </span>
          <strong>{formData.canvases}</strong>
        </div>
        <div className="summary-item total-price">
          <span>{t("total_price")}: </span>
          <strong>{formatPrice(totalPrice)}</strong>
        </div>
      </div>
    </div>
  );
}
