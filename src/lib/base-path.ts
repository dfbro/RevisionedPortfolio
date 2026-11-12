export const BASE_PATH = "/RevisionedPortfolio";

/** Prefix local public files for project-site hosting; leave external and inline URLs untouched. */
export function withBasePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(value) || /^(?:data|blob|mailto):/i.test(value) || value.startsWith("#")) return value;
  if (value === "/api" || value.startsWith("/api/")) return value;

  const pathname = value.startsWith("/") ? value : `/${value}`;
  if (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)) return pathname;
  return `${BASE_PATH}${pathname}`;
}
