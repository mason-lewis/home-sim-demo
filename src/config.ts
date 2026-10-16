interface SiteConfig {
  name: string;
  copyrightOwner: string;
  contactEmail: string | null;
  streamUrl: string | null;
}
// Public presentation settings only. Never put credentials or private model URLs here.
export const siteConfig: SiteConfig = {
  name: "DREAM VIEW",
  copyrightOwner: "DREAM VIEW",
  contactEmail: null,
  streamUrl: null,
};
