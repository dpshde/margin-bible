/** Reader paper. Matches `--paper` and the default `theme-color` in the HTML shell. */
export const READER_PAPER = "#f6f5f2";

export const PWA_NAME = "Margin";

export type WebAppIcon = {
  src: string;
  sizes: string;
  type: "image/png";
  purpose: "any";
};

export type WebAppManifest = {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  icons: WebAppIcon[];
};

/** Request path → file under the assets binding. */
const ICONS: Record<string, string> = {
  "/icons/icon-192.png": "/icons/icon-192.png",
  "/icons/icon-512.png": "/icons/icon-512.png",
  "/icons/apple-touch-icon.png": "/icons/apple-touch-icon.png",
  "/apple-touch-icon.png": "/icons/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png": "/icons/apple-touch-icon.png",
};

/**
 * Install identity is the origin, not the page that was saved.
 * iOS otherwise scopes a home-screen app to that page's path (`/notes`
 * would leave `/jhn.2` and open an in-app browser).
 */
export function webAppManifest(): WebAppManifest {
  return {
    id: "/",
    name: PWA_NAME,
    short_name: PWA_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: READER_PAPER,
    theme_color: READER_PAPER,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}

export function manifestResponse(): Response {
  return new Response(`${JSON.stringify(webAppManifest())}\n`, {
    status: 200,
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

/** Install assets. These must not mint a guest library session. */
export function isPwaAssetPath(pathname: string): boolean {
  return (
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icons/") ||
    Object.prototype.hasOwnProperty.call(ICONS, pathname)
  );
}

export function pwaIconAssetPath(pathname: string): string | null {
  return ICONS[pathname] ?? null;
}
