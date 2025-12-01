import type { FC } from "react";

import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";
import { formatVisitDateTime } from "@/utils/formatters";

import type { SelectedTimeSlot } from "./types";

type SummaryMode = "preview" | "confirmation";

interface BookingSummaryProps {
  selectedTimeSlot: SelectedTimeSlot | null;
  currentAmount: number;
  currentProductName: string;
  mode: SummaryMode;
  showEditButton?: boolean;
  onEdit?: () => void;
  translations: any;
}

export const BookingSummary: FC<BookingSummaryProps> = ({
  selectedTimeSlot,
  currentAmount,
  currentProductName,
  mode,
  showEditButton = false,
  onEdit,
  translations,
}) => {
  const t = useTranslator();
  const language = usePageLanguage();
  const priceInEuros = (currentAmount / 100).toFixed(0);

  const isPreviewMode = mode === "preview";
  const isConfirmationMode = mode === "confirmation";

  if (isPreviewMode && !selectedTimeSlot) {
    return null;
  }

  return (
    <div className={`booking-summary ${mode}`}>
      {isConfirmationMode && (
        <h2>{translations.booking_summary || "Booking Summary"}</h2>
      )}

      <div className="selected-info">
        {selectedTimeSlot && (
          <div className="selected-time">
            {isConfirmationMode ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                }}
              >
                <span style={{ color: "#666", fontSize: "16px" }}>
                  {translations.date_time || "Date & Time"}:
                </span>
                <strong style={{ color: "#333", fontSize: "16px" }}>
                  {formatVisitDateTime(selectedTimeSlot, language)}
                </strong>
              </div>
            ) : (
              <strong>
                {translations.selected_time || "Selected Time"}:{" "}
                {formatVisitDateTime(selectedTimeSlot, language)}
              </strong>
            )}
          </div>
        )}

        <div className="selected-canvas">
          {isConfirmationMode ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
              }}
            >
              <span style={{ color: "#666", fontSize: "16px" }}>
                {translations.canvas_type || "Canvas"}:
              </span>
              <strong style={{ color: "#333", fontSize: "16px" }}>
                {currentProductName}
              </strong>
            </div>
          ) : (
            <strong>
              {translations.canvas_type || "Canvas"}: {currentProductName}
            </strong>
          )}
        </div>

        {isConfirmationMode && (
          <div className="total-row">
            <span
              style={{ color: "#666", fontSize: "18px", fontWeight: "bold" }}
            >
              {translations.total || "Total"}:
            </span>
            <strong
              style={{
                fontSize: "24px",
                color: "#007cba",
                fontWeight: "bold",
              }}
            >
              €{priceInEuros}
            </strong>
          </div>
        )}
      </div>

      {isPreviewMode && (
        <div className="total-price">
          <div className="price-amount">
            <strong>€{priceInEuros}</strong>
            <span>{translations.total_price || "Total Price"}</span>
          </div>
        </div>
      )}

      {showEditButton && onEdit && (
        <button className="edit-selections-btn" onClick={onEdit}>
          ← {translations.edit_selections || "Edit selections"}
        </button>
      )}
    </div>
  );
};
