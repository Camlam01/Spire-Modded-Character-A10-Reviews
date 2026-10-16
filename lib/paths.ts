/** Only same-site paths are allowed as a post-login destination. */
export function safeNextPath(p: string | null | undefined): string {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p;
}
