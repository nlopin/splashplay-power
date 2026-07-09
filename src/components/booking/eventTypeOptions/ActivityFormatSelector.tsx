import { useTranslator } from "@/components/TranslatorContext";

export type ActivityFormat = "splash" | "pouring";

type ActivityFormatSelectorProps = {
  value: ActivityFormat;
  onChange: (format: ActivityFormat) => void;
};

export function ActivityFormatSelector({
  value,
  onChange,
}: ActivityFormatSelectorProps) {
  const t = useTranslator();
  const isSplash = value === "splash";

  return (
    <div className="canvas-type-selector">
      <div className="canvas-type-label">{t("activity_format")}</div>
      <div className="canvas-type-options">
        <label
          className={`canvas-type-option${isSplash ? " canvas-type-option--selected" : ""}`}
        >
          <input
            type="radio"
            name="activityFormat"
            value="splash"
            checked={isSplash}
            onChange={() => onChange("splash")}
          />
          {t("activity_splash")}
        </label>
        <label
          className={`canvas-type-option${!isSplash ? " canvas-type-option--selected" : ""}`}
        >
          <input
            type="radio"
            name="activityFormat"
            value="pouring"
            checked={!isSplash}
            onChange={() => onChange("pouring")}
          />
          {t("activity_pouring")}
        </label>
      </div>
    </div>
  );
}
