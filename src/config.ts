interface SiteConfig {
  name: string;
  copyrightOwner: string;
  contactEmail: string | null;
  demoPasswordHash: string;
}
// Public presentation settings only. Never put credentials or private model URLs here.
export const siteConfig: SiteConfig = {
  name: "DREAM VIEW",
  copyrightOwner: "DREAM VIEW",
  contactEmail: null,
  // Casual access gate only. The browser must be able to read this digest.
  demoPasswordHash:
    "cdb1cf26ad261fb2b601b814b8385032894c8e9e30fcc437592eb48813a356bd",
};
