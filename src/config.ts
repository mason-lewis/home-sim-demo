interface SiteConfig {
  name: string;
  copyrightOwner: string;
  contactEmail: string | null;
  streamUrl: string | null;
}
// Public presentation settings only. Never put credentials or private model URLs here.
export const siteConfig: SiteConfig = {
  name: "FORM / SPACE",
  copyrightOwner: "FORM / SPACE",
  contactEmail: null,
  streamUrl: null,
};
