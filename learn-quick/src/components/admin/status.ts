import type { ApplicationStatus } from "@prisma/client";

export const statusTone: Record<ApplicationStatus, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "primary",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};
