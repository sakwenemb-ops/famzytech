import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale detection and prefixing only. Access control happens on the server
// (requireUser / requireRole in pages, assertRole in server actions).
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
