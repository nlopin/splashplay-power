const excludedIndexPathSuffixes = ["/404/", "/500/", "/complete/"];

export const normalizeSeoPath = (path) => {
  if (path === "/") {
    return path;
  }

  return `${path.replace(/\/+$/, "")}/`;
};

export const shouldExcludeFromIndex = (path) => {
  const normalizedPath = normalizeSeoPath(path);

  return excludedIndexPathSuffixes.some(
    (excludedPath) =>
      normalizedPath === excludedPath || normalizedPath.endsWith(excludedPath),
  );
};

/**
 * @astrojs/sitemap calls filter() with the full absolute URL for each page.
 * Keep only canonical public pages in the generated sitemap.
 */
export const shouldIncludeInSitemap = (page) => {
  const { pathname } = new URL(page);
  const normalizedPath = normalizeSeoPath(pathname);

  if (normalizedPath === "/es/" || normalizedPath.startsWith("/es/")) {
    return false;
  }

  return !shouldExcludeFromIndex(normalizedPath);
};
