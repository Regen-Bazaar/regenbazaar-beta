// Public base URL for links that leave the site (token metadata, the agent catalogue). Never derived from
// the request: behind the proxy the standalone server sees its bind address (http://0.0.0.0:3000).
export const SITE_URL = process.env.PUBLIC_SITE_URL || "https://app.regenbazaar.com";

export function siteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
