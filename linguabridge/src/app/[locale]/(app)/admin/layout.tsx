import { requireRole } from "@/server/session";

/** Every page under /admin requires the ADMIN role (admins are sent to their own dashboard). */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return children;
}
