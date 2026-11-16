import {
  BookOpenText, CalendarDays, ClipboardCheck, CreditCard, FileClock, Flag, LayoutDashboard, Library,
  MessageSquare, Scale, Settings, Star, Users, Video, Wallet,
} from "lucide-react";
import type { NavItem } from "./shell";

type T = (key: string) => string;

export const studentNav = (t: T): NavItem[] => [
  { href: "/student", label: t("overview"), icon: LayoutDashboard, ready: true },
  { href: "/student/lessons", label: t("lessons"), icon: Video, ready: true },
  { href: "/teachers", label: t("teachers"), icon: Users, ready: true },
  { href: "/messages", label: t("messages"), icon: MessageSquare, ready: true },
  { href: "/student/wallet", label: t("wallet"), icon: Wallet, ready: true },
  { href: "/library", label: t("library"), icon: BookOpenText, ready: true },
  { href: "/student/settings", label: t("settings"), icon: Settings, ready: true },
];

export const teacherNav = (t: T): NavItem[] => [
  { href: "/teacher", label: t("overview"), icon: LayoutDashboard, ready: true },
  { href: "/teacher/application", label: t("application"), icon: ClipboardCheck, ready: true },
  { href: "/teacher/calendar", label: t("calendar"), icon: CalendarDays, ready: true },
  { href: "/teacher/lessons", label: t("lessons"), icon: Video, ready: true },
  { href: "/teacher/earnings", label: t("earnings"), icon: Wallet, ready: true },
  { href: "/teacher/reviews", label: t("reviews"), icon: Star, ready: true },
  { href: "/library", label: t("library"), icon: BookOpenText, ready: true },
  { href: "/messages", label: t("messages"), icon: MessageSquare, ready: true },
  { href: "/teacher/settings", label: t("settings"), icon: Settings, ready: true },
];

export const adminNav = (t: T): NavItem[] => [
  { href: "/admin", label: t("overview"), icon: LayoutDashboard, ready: true },
  { href: "/admin/applications", label: t("applications"), icon: ClipboardCheck, ready: true },
  { href: "/admin/users", label: t("users"), icon: Users, ready: true },
  { href: "/admin/payments", label: t("payments"), icon: CreditCard, ready: true },
  { href: "/admin/disputes", label: t("disputes"), icon: Scale, ready: true },
  { href: "/admin/reports", label: t("reports"), icon: Flag, ready: true },
  { href: "/library/manage", label: t("content"), icon: Library, ready: true },
  { href: "/admin/audit", label: t("auditLog"), icon: FileClock, ready: true },
  { href: "/admin/settings", label: t("settings"), icon: Settings, ready: true },
];

/** The dashboard menu for a role (pages shared by several roles use this). */
export const navFor = (role: "STUDENT" | "TEACHER" | "ADMIN", t: T) => (role === "ADMIN" ? adminNav(t) : role === "TEACHER" ? teacherNav(t) : studentNav(t));
