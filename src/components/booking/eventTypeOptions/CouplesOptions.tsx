import { useState, useEffect, useRef } from "react";
import one_small from "@/assets/img/30x40_compartido.jpg";
import one_big from "@/assets/img/60x80_compartido.jpg";
import two_big from "@/assets/img/60x90_2individuales.jpg";
import individual from "@/assets/img/30x40_2individuales.jpg";

import { formatPrice } from "@/utils/price";
import { useTranslator, usePageLanguage } from "@/components/TranslatorContext";

import type { EventTypeOptionsProps } from "./EventTypeOptions";
import {
  ActivityFormatSelector,
  type ActivityFormat,
} from "./ActivityFormatSelector";
import {
  COUPLES_PRICE,
  formatCouplesProductName,
  type CouplesPicture,
} from "@/services/catalog/couplesPricing";

type PictureType = CouplesPicture;

const PRICE = COUPLES_PRICE;

const IMAGES: Record<PictureType, string> = {
  one_small: one_small.src,
  one_big: one_big.src,
  two_big: two_big.src,
  individual: individual.src,
};

const DEFAULT_SPLASH_PICTURE: PictureType = "one_big";
const DEFAULT_POURING_PICTURE: PictureType = "individual";

function isPictureType(value: string | null): value is PictureType {
  return (
    value === "one_small" ||
    value === "one_big" ||
    value === "two_big" ||
    value === "individual"
  );
}

function isSplashOnlyPicture(value: PictureType): boolean {
  return value === "one_big" || value === "two_big";
}

export function CouplesOptions({
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const [pictureType, setPictureType] = useState<PictureType>(
    DEFAULT_SPLASH_PICTURE,
  );
  const [activityFormat, setActivityFormat] =
    useState<ActivityFormat>("splash");
  const savedSplashPictureTypeRef = useRef<PictureType>(DEFAULT_SPLASH_PICTURE);
  const t = useTranslator();
  const lang = usePageLanguage();

  const handlePictureTypeChange = (type: PictureType) => {
    setPictureType(type);
    if (activityFormat === "splash") {
      savedSplashPictureTypeRef.current = type;
    }
  };

  const handleActivityFormatChange = (format: ActivityFormat) => {
    if (format === activityFormat) return;

    if (format === "pouring") {
      if (activityFormat === "splash") {
        savedSplashPictureTypeRef.current = pictureType;
      }
      setActivityFormat("pouring");
      setPictureType(DEFAULT_POURING_PICTURE);
      return;
    }

    setActivityFormat("splash");
    setPictureType(savedSplashPictureTypeRef.current);
  };

  const isSplash = activityFormat === "splash";

  const didHydrateOption = useRef(false);

  useEffect(() => {
    if (!didHydrateOption.current) {
      didHydrateOption.current = true;
      const typeParam = new URLSearchParams(window.location.search).get(
        "option",
      );
      if (isPictureType(typeParam)) {
        setPictureType(typeParam);
        if (isSplashOnlyPicture(typeParam) || typeParam === "one_small") {
          setActivityFormat("splash");
          savedSplashPictureTypeRef.current = typeParam;
        } else {
          savedSplashPictureTypeRef.current = DEFAULT_SPLASH_PICTURE;
        }
        onChange({
          amount: PRICE[typeParam],
          productName: formatCouplesProductName(
            typeParam,
            isSplashOnlyPicture(typeParam) ? "splash" : activityFormat,
            lang,
          ),
          guests: 2,
        });
        return;
      }
    }

    onChange({
      amount: PRICE[pictureType],
      productName: formatCouplesProductName(pictureType, activityFormat, lang),
      guests: 2,
    });

    const url = new URL(window.location.href);
    url.searchParams.set("option", pictureType);
    window.history.replaceState({}, "", url);
  }, [pictureType, activityFormat, lang]);

  const options: Array<{
    value: PictureType;
    label: string;
    price: string;
    discountedPrice: string | null;
    image: string;
  }> = [
    {
      value: "one_small",
      label: t("couples_one_small"),
      price: formatPrice(PRICE.one_small),
      discountedPrice: discount
        ? formatPrice(Math.round(PRICE.one_small * (1 - discount / 100)))
        : null,
      image: IMAGES.one_small,
    },
    {
      value: "individual",
      label: t("couples_individual"),
      price: formatPrice(PRICE.individual),
      discountedPrice: discount
        ? formatPrice(Math.round(PRICE.individual * (1 - discount / 100)))
        : null,
      image: IMAGES.individual,
    },
    ...(isSplash
      ? [
          {
            value: "one_big" as const,
            label: t("couples_one_big"),
            price: formatPrice(PRICE.one_big),
            discountedPrice: discount
              ? formatPrice(Math.round(PRICE.one_big * (1 - discount / 100)))
              : null,
            image: IMAGES.one_big,
          },
          {
            value: "two_big" as const,
            label: t("couples_two_big"),
            price: formatPrice(PRICE.two_big),
            discountedPrice: discount
              ? formatPrice(Math.round(PRICE.two_big * (1 - discount / 100)))
              : null,
            image: IMAGES.two_big,
          },
        ]
      : []),
  ];

  return (
    <div className="couples-options-section">
      <ActivityFormatSelector
        value={activityFormat}
        onChange={handleActivityFormatChange}
      />
      <h3 className="couples-options-title">{t("choose_canvas")}</h3>
      <div className="couples-options-grid">
        {options.map((option) => (
          <label
            key={option.value}
            className={`couples-option-card ${
              pictureType === option.value ? "selected" : ""
            }`}
          >
            {option.value === "one_big" && (
              <div className="popular-badge">{t("most_popular")}</div>
            )}
            <input
              type="radio"
              name="picture_type"
              value={option.value}
              checked={pictureType === option.value}
              onChange={() => handlePictureTypeChange(option.value)}
              className="option-input"
            />
            <div className="couples-option-image-container">
              <img
                src={option.image}
                alt={option.label}
                className="couples-option-image"
                loading="lazy"
              />
            </div>
            <div className="option-content">
              <div className="option-label">{option.label}</div>
              {showPrice && (
                <div className="option-price">
                  {option.discountedPrice ? (
                    <>
                      <span className="price-before">
                        <span className="price-original">{option.price}</span>
                        <span className="discount-badge">-{discount}%</span>
                      </span>
                      <span className="price-final">
                        {option.discountedPrice}
                      </span>
                    </>
                  ) : (
                    option.price
                  )}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
