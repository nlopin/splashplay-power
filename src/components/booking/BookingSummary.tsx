import type { FC } from "react";
import { useTranslator } from "../TranslatorContext";

type SelectedTimeSlot = {
  startTime: string;
  formattedDate: string;
  formattedTime: string;
  schedulingUrl: string;
};

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
  const priceInEuros = (currentAmount / 100).toFixed(0);

  const isPreviewMode = mode === "preview";
  const isConfirmationMode = mode === "confirmation";

  if (isPreviewMode && !selectedTimeSlot) {
    return null;
  }

  const containerStyle = {
    backgroundColor: isPreviewMode ? "white" : "#f8f9fa",
    border: isPreviewMode ? "2px solid #007cba" : "1px solid #e9ecef",
    borderRadius: "12px",
    padding: "24px",
  };

  const headerStyle = {
    textAlign: "center" as const,
    marginBottom: "20px",
    color: "#333",
    fontSize: isPreviewMode ? "1.2rem" : "1.5rem",
  };

  return (
    <div style={containerStyle}>
      {isConfirmationMode && (
        <h2 style={headerStyle}>
          {translations.booking_summary || "Booking Summary"}
        </h2>
      )}

      <div className="selected-info" style={{ marginBottom: "20px" }}>
        {selectedTimeSlot && (
          <div
            className="selected-time"
            style={{
              marginBottom: "12px",
              padding: "12px",
              backgroundColor: isPreviewMode ? "#e3f2fd" : "#fff",
              borderRadius: "8px",
              border: isConfirmationMode ? "1px solid #e9ecef" : "none",
            }}
          >
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
                  {selectedTimeSlot.formattedDate} at{" "}
                  {selectedTimeSlot.formattedTime}
                </strong>
              </div>
            ) : (
              <strong style={{ color: "#007cba" }}>
                {translations.selected_time || "Selected Time"}:{" "}
                {selectedTimeSlot.formattedDate} at{" "}
                {selectedTimeSlot.formattedTime}
              </strong>
            )}
          </div>
        )}

        <div
          className="selected-canvas"
          style={{
            padding: "12px",
            backgroundColor: isPreviewMode ? "#f0f8ff" : "#fff",
            borderRadius: "8px",
            border: isConfirmationMode ? "1px solid #e9ecef" : "none",
            marginBottom: isConfirmationMode ? "12px" : "0",
          }}
        >
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
            <strong style={{ color: "#333" }}>
              {translations.canvas_type || "Canvas"}: {currentProductName}
            </strong>
          )}
        </div>

        {isConfirmationMode && (
          <div
            className="total-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #e9ecef",
            }}
          >
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
        <div className="total-price" style={{ marginBottom: "20px" }}>
          <div className="price-amount" style={{ textAlign: "center" }}>
            <strong
              style={{
                fontSize: "2.5em",
                color: "#007cba",
                display: "block",
                marginBottom: "8px",
              }}
            >
              €{priceInEuros}
            </strong>
            <span style={{ color: "#666", fontSize: "1.1em" }}>
              {translations.total_price || "Total Price"}
            </span>
          </div>
        </div>
      )}

      {showEditButton && onEdit && (
        <button
          onClick={onEdit}
          style={{
            padding: "12px 20px",
            backgroundColor: "transparent",
            color: "#007cba",
            border: "2px solid #007cba",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "500",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#007cba";
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#007cba";
          }}
        >
          ← {translations.edit_selections || "Edit selections"}
        </button>
      )}
    </div>
  );
};
