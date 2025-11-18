import { useState } from "react";
import { useTranslator } from "../TranslatorContext";

type PictureType = "one_small" | "one_big" | "individual";
export default function CouplesOptions() {
  const [pictureType, setPictureType] = useState<PictureType>("one_big");
  const t = useTranslator();
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
