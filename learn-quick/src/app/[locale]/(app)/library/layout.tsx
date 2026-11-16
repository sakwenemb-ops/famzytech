import { requireRole } from "@/server/session";

/** Taking tests is for students and teachers (free); admins can still open results. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT", "TEACHER", "ADMIN");
  return children;
}
