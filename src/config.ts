interface SiteConfig {
  name: string;
  streamUrl: string | null;
}
// Public presentation settings only. Never put credentials or private model URLs here.
export const siteConfig: SiteConfig = { name: "FORM / SPACE", streamUrl: null };
