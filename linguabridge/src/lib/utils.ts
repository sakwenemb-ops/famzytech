import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer XAF amount, e.g. 5000 -> "5 000 FCFA". */
export function formatXaf(amount: number, locale: "en" | "fr" = "fr") {
  const n = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 0 })
    .format(amount)
    .replace(/[  ,]/g, " ");
  return `${n} FCFA`;
}
