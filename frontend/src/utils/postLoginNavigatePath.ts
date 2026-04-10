import { getSubdomainSlug } from "./eventumSlug";

/**
 * Куда вести пользователя после успешного входа (или если он уже авторизован на /login).
 * Учитывает location.state.from с страницы, с которой открыли вход.
 */
export function postLoginNavigatePath(
  pathname: string,
  search: string,
  from?: { pathname?: string; search?: string }
): string {
  const subdomainSlug = getSubdomainSlug();
  if (pathname === "/login" && from?.pathname && from.pathname !== "/login") {
    return `${from.pathname}${from.search ?? ""}`;
  }
  if (pathname === "/login") {
    return subdomainSlug ? "/" : "/dashboard";
  }
  const path = `${pathname}${search}`;
  if (path === "/" || path === "") {
    return subdomainSlug ? "/" : "/dashboard";
  }
  return path;
}
