import { useState, useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

export interface FamilyFormData {
  adults: number;
  kids: number;
  canvases: number;
}

export function calculateFamilyPrice(canvases: number): number {
  if (canvases < 1) {
    canvases = 1;
  }

  const basePrices = [
    6000, // 1 canvas: €60
    9000, // 2 canvases: €90
    12000, // 3 canvases: €120
    14000, // 4 canvases: €140
    16000, // 5 canvases: €160
    18000, // 6 canvases: €180
    21000, // 7 canvases: €210
  ];

  if (canvases <= 6) {
    return basePrices[canvases - 1];
  }

  // For more than 6 canvases: base price of 6 canvases + €30 per additional canvas
  const additionalCanvases = canvases - 6;
  return basePrices[5] + additionalCanvases * 3000;
}

export function getDefaultCanvasCount(kids: number): number {
  return Math.max(1, kids);
}

export function validatePeopleCount(adults: number, kids: number): boolean {
  const maxGuests = 7;
  return adults >= 1 && kids >= 1 && adults + kids <= maxGuests;
}

export function calculateNewCanvasCount(
  currentCanvases: number,
  prevKids: number,
  newKids: number,
): number {
  if (currentCanvases === prevKids) {
    return Math.max(1, newKids);
  }

  if (currentCanvases < prevKids && newKids > prevKids) {
    return Math.max(1, newKids);
  }

  return currentCanvases;
}

export function FamilyOptions({ onChange }: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FamilyFormData>({
    adults: 2,
    kids: 1,
    canvases: 1,
  });
  const t = useTranslator();
  const prevKidsRef = useRef(formData.kids);

  // Update canvas count when kids count changes
  useEffect(() => {
    const prevKids = prevKidsRef.current;
    const newKids = formData.kids;

    if (prevKids !== newKids) {
      setFormData((prev) => {
        const newCanvases = calculateNewCanvasCount(
          prev.canvases,
          prevKids,
          newKids,
        );

        prevKidsRef.current = newKids;

        if (newCanvases !== prev.canvases) {
          return {
            ...prev,
            canvases: newCanvases,
          };
        }

        return prev;
      });
    }
  }, [formData.kids]);

  // Calculate total price and notify parent
  useEffect(() => {
    const totalAmount = calculateFamilyPrice(formData.canvases);
    const productName = `${formData.adults} adultos, ${formData.kids} niños, ${formData.canvases} ${formData.canvases === 1 ? "lienzo" : "lienzos"}`;

    onChange({
      amount: totalAmount,
      productName,
    });
  }, [formData, onChange]);

  const handleInputChange = (field: keyof FamilyFormData, value: number) => {
    const clampedValue = Math.max(1, Math.min(value, 7));

    setFormData((prev) => {
      // Validate total people limit for adults/kids changes (max 10)
      if (field === "adults" || field === "kids") {
        const newAdults = field === "adults" ? clampedValue : prev.adults;
        const newKids = field === "kids" ? clampedValue : prev.kids;

        if (newAdults + newKids > 7) {
          return prev; // Don't update if it would exceed 7 total people
        }
      }

      return { ...prev, [field]: clampedValue };
    });
  };

  const totalPeople = formData.adults + formData.kids;
  const totalPrice = calculateFamilyPrice(formData.canvases);

  return (
    <div className="family-options">
      <div className="options-grid-unified">
        <div className="option-label">{t("family_adults_count")}</div>
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
          max="7"
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
          disabled={totalPeople >= 7}
        >
          +
        </button>

        <div className="option-label">{t("family_kids_count")}</div>
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
          max="7"
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
          disabled={totalPeople >= 7}
        >
          +
        </button>

        <div className="option-label">{t("family_canvas_count")}</div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleInputChange("canvases", formData.canvases - 1)}
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
          onClick={() => handleInputChange("canvases", formData.canvases + 1)}
          disabled={formData.canvases >= 10}
        >
          +
        </button>

        <div className="option-label total-price-label">{t("total_price")}</div>
        <div></div>
        <div className="total-price">{formatPrice(totalPrice)}</div>
        <div></div>
      </div>
    </div>
  );
}
