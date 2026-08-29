// This file is used on both server and client, keep it environment-agnostic
export const DEFAULT_LOCALE = "es";
export const BUSINESS_TIMEZONE = "Europe/Madrid";

export const CONTACT_EMAIL = "info@splashplay.es";

// E.164 (main.whatsapp in the locale files has the spaced "+34 641 671 670" form).
export const WHATSAPP_PHONE = "+34641671670";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_PHONE.slice(1)}`;
