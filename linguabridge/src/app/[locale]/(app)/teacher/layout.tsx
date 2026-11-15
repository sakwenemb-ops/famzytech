import { requireRole } from "@/server/session";

/** Every page under /teacher requires the TEACHER role (admins are sent to their own dashboard). */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("TEACHER");
  return children;
}
