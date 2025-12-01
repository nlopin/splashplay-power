import type { FC } from "react";

import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";
import { formatVisitDateTime } from "@/utils/formatters";

import type { SelectedTimeSlot } from "./types";

interface BookingSummaryProps {
  selectedTimeSlot: SelectedTimeSlot;
  currentAmount: number;
  currentProductName: string;
  onEdit: () => void;
}

export const BookingSummary: FC<BookingSummaryProps> = ({
  selectedTimeSlot,
  currentProductName,
  onEdit,
}) => {
  const t = useTranslator();
  const language = usePageLanguage();

  return (
    <div className="simplified-summary">
      <h2>{t("booking_summary")}</h2>

      <div className="summary-content">
        <div className="summary-item">
          <span className="label">{t("date_time")}:</span>
          <span className="value">
            {formatVisitDateTime(selectedTimeSlot, "long", language)}
          </span>
        </div>

        <div className="summary-item">
          <span className="label">{t("canvas_type")}:</span>
          <span className="value">{currentProductName}</span>
        </div>
      </div>

      <button className="edit-selections-btn" onClick={onEdit}>
        ← {t("edit_selections")}
      </button>
    </div>
  );
};
