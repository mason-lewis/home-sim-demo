interface SiteConfig {
  name: string;
  copyrightOwner: string;
  contactEmail: string | null;
  streamUrl: string | null;
  streamPasswordHash: string;
}
// Public presentation settings only. Never put credentials or private model URLs here.
export const siteConfig: SiteConfig = {
  name: "DREAM VIEW",
  copyrightOwner: "DREAM VIEW",
  contactEmail: null,
  streamUrl:
    "https://streams.vagon.io/streams/0356b86d-6c61-4e87-ad9c-c9dba62e8ba2",
  // Casual access gate only. The browser must be able to read this digest.
  streamPasswordHash:
    "cdb1cf26ad261fb2b601b814b8385032894c8e9e30fcc437592eb48813a356bd",
};
