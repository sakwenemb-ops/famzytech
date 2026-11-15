import { requireRole } from "@/server/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT");
  return children;
}
