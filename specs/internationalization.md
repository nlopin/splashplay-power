# Internationalization

## Purpose & Motivation

The website at hand is aimed to users that speak three languages — English, Spanish and Catalan.
All the pages must have a version in each language mentioned above.

The default language is Spanish.

## Requirements

Translations are stored in one or several translation files. A translation file is a JSON with an object
 containing translation keys and corresponding translations to each language.

Page template is written only once. No duplication allowed.
If there is an `about.astro` it must serve all languages. There must be no `en/about.astro` or `cat/about.astro`.

### URL structure

There must be unprefixed URLs, they correspond to the default language. Other languages are prefixed.
Examples:
- `/` shows home page in Spanish, `/en` shows homepage in English;
- `/about` shows about page in Spanish, `/en/about` shows about page in English;

### Translation File Structure

The translation files must use the default structure proposed by the library used.
Translations must be scoped by page to facilitate the loading

Each translation file should follow this format:
{
  "home": {
    "key1": "value1",
    "key2": "value2"
  },
  "about" : {
    "about_key1": "value3"
  }
}

### Language Configuration

Supported languages configuration:
- Spanish (es): Default language, no URL prefix
- English (en): URL prefix `/en`
- Catalan (ca): URL prefix `/ca`

Language detection priority:
1. URL prefix (highest priority)
2. Browser Accept-Language header
3. Default to Spanish if no match

### Fallback Strategy

When a translation is missing:
1. return the translation key
2. log error in development mode

For missing pages:
- Return 404 page in the requested language
- If 404 translation missing, use Spanish 404

### Development Requirements

- Build-time warnings for incomplete translations
- Type safety for translation keys (TypeScript definitions)
- Hot reload support for translation file changes

Testing requirements:
- All pages must render in all three languages
- URL routing must work correctly
- Language switching must preserve page context

Consider using default Astro i18n or alternatives like astro-i18n (https://github.com/Alexandre-Fernandez/astro-i18n) and paraglide (https://inlang.com/m/gerre34r/library-inlang-paraglideJs/astro)

### Performance Considerations

Translation loading:
- All translations loaded at build time (static generation)
- No runtime translation loading required
- Minimize bundle size by only including necessary translations per page
- Consider tree-shaking unused translation keys
