import "server-only";
import { cache } from "react";
import type { Role, User } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/**
 * The session only carries the user id. Role, status and verification are read
 * from the database on every request, so a suspension or role change applies at once.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

export const isVerified = (u: User) => Boolean(u.emailVerified || u.phoneVerified);

export function dashboardPath(role: Role) {
  return role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/teacher" : "/student";
}

async function go(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}

/** For pages: signed in, onboarded and verified, else redirect to the right step. */
export async function requireUser(opts: { allowUnverified?: boolean; allowNotOnboarded?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) return go("/login");
  if (!opts.allowNotOnboarded && !user.onboarded) return go("/onboarding");
  if (!opts.allowUnverified && !isVerified(user)) return go("/verify");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) return go(dashboardPath(user.role));
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function assertRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user || !isVerified(user) || !roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
