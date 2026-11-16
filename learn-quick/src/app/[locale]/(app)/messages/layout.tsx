import { requireRole } from "@/server/session";

/** Messages are between students and teachers. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT", "TEACHER");
  return children;
}
