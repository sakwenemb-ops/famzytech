import "server-only";
import type { LedgerAccountType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

/** Accounts that belong to the platform rather than to a person. They have fixed ids. */
const PLATFORM: LedgerAccountType[] = ["PLATFORM_REVENUE", "PLATFORM_CLEARING", "EXTERNAL", "PAYOUT_IN_FLIGHT"];
/** Personal balances can never go below zero. */
const NO_OVERDRAFT: LedgerAccountType[] = ["STUDENT_WALLET", "TEACHER_PENDING", "TEACHER_AVAILABLE", "PLATFORM_CLEARING", "PAYOUT_IN_FLIGHT"];

export type AccountRef = { type: LedgerAccountType; userId?: string };
export const ESCROW: AccountRef = { type: "PLATFORM_CLEARING" };
export const EXTERNAL: AccountRef = { type: "EXTERNAL" };
export const REVENUE: AccountRef = { type: "PLATFORM_REVENUE" };
export const IN_FLIGHT: AccountRef = { type: "PAYOUT_IN_FLIGHT" };

async function accountId(tx: Tx, ref: AccountRef) {
  if (PLATFORM.includes(ref.type)) {
    const id = `platform_${ref.type.toLowerCase()}`;
    await tx.ledgerAccount.upsert({ where: { id }, create: { id, type: ref.type }, update: {} });
    return id;
  }
  if (!ref.userId) throw new Error(`Ledger account ${ref.type} needs a user`);
  const acc = await tx.ledgerAccount.upsert({
    where: { userId_type: { userId: ref.userId, type: ref.type } },
    create: { userId: ref.userId, type: ref.type },
    update: {},
  });
  return acc.id;
}

export class LedgerError extends Error {}

/**
 * Record one money movement. Lines must add up to zero. Posting the same (kind, referenceId)
 * twice is refused by the database, so retries and duplicate webhooks can't pay twice.
 * Returns false if this event was already posted.
 */
export async function post(
  tx: Tx,
  entry: { kind: string; referenceId: string; memo?: string; lines: { account: AccountRef; amount: number }[] },
): Promise<boolean> {
  const lines = entry.lines.filter((l) => l.amount !== 0);
  if (lines.some((l) => !Number.isInteger(l.amount))) throw new LedgerError("Amounts must be whole FCFA");
  if (lines.reduce((s, l) => s + l.amount, 0) !== 0) throw new LedgerError(`Unbalanced ledger entry: ${entry.kind}`);
  if (await tx.ledgerTransaction.findUnique({ where: { kind_referenceId: { kind: entry.kind, referenceId: entry.referenceId } } })) return false;

  const ids = await Promise.all(lines.map((l) => accountId(tx, l.account)));
  await tx.ledgerTransaction.create({
    data: {
      kind: entry.kind,
      referenceId: entry.referenceId,
      memo: entry.memo,
      lines: { create: lines.map((l, i) => ({ accountId: ids[i], amountXaf: l.amount })) },
    },
  });
  for (const [i, l] of lines.entries()) {
    const acc = await tx.ledgerAccount.update({ where: { id: ids[i] }, data: { balanceXaf: { increment: l.amount } } });
    if (acc.balanceXaf < 0 && NO_OVERDRAFT.includes(acc.type)) throw new LedgerError(`Insufficient balance in ${acc.type}`);
  }
  return true;
}

export async function balance(ref: AccountRef) {
  if (PLATFORM.includes(ref.type)) {
    return (await db.ledgerAccount.findUnique({ where: { id: `platform_${ref.type.toLowerCase()}` } }))?.balanceXaf ?? 0;
  }
  return (await db.ledgerAccount.findUnique({ where: { userId_type: { userId: ref.userId!, type: ref.type } } }))?.balanceXaf ?? 0;
}

/** Health check for the admin page: all lines sum to zero and cached balances match the lines. */
export async function verifyLedger() {
  const [total, accounts] = await Promise.all([
    db.ledgerLine.aggregate({ _sum: { amountXaf: true } }),
    db.ledgerAccount.findMany({ include: { lines: { select: { amountXaf: true } } } }),
  ]);
  const mismatched = accounts.filter((a) => a.lines.reduce((s, l) => s + l.amountXaf, 0) !== a.balanceXaf).map((a) => a.id);
  return { sumIsZero: (total._sum.amountXaf ?? 0) === 0, mismatched };
}

/** A person's ledger history for one account (wallet or earnings), newest first. */
export async function history(ref: AccountRef, take = 50) {
  const acc = await db.ledgerAccount.findUnique({ where: { userId_type: { userId: ref.userId!, type: ref.type } } });
  if (!acc) return [];
  return db.ledgerLine.findMany({
    where: { accountId: acc.id },
    orderBy: { transaction: { createdAt: "desc" } },
    take,
    include: { transaction: true },
  });
}
