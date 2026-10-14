/** Reject interstitials saved by earlier crawls as successful property content. */
export function isBlockedSource(title:string,content:string) {
  return /attention required.*cloudflare|^just a moment[.!…]*$/i.test(title.trim()) ||
    /sorry, you have been blocked|checking (?:your )?browser before accessing|verify you are human.*security/i.test(content);
}
