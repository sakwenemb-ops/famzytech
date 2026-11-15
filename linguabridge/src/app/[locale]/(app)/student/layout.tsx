import { requireRole } from "@/server/session";

/** Every page under /student requires the STUDENT role (admins are sent to their own dashboard). */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT");
  return children;
}
