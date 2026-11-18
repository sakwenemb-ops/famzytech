"use server";

import { getLocale } from "next-intl/server";
import { signOut } from "@/auth";
import { getCurrentUser } from "./session";
import { DeletionRefused, deleteAccount } from "./account";

export type DeleteState = { error?: string } | undefined;

export async function deleteAccountAction(_: DeleteState, fd: FormData): Promise<DeleteState> {
  const user = await getCurrentUser();
  if (!user) return { error: "session_expired" };
  try {
    await deleteAccount(user, { password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
  } catch (e) {
    if (e instanceof DeletionRefused) return { error: e.code };
    throw e;
  }
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}?accountDeleted=1` });
}
