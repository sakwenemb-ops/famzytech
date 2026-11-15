import {
  BookOpenText, CalendarDays, ClipboardCheck, CreditCard, FileClock, LayoutDashboard, Library,
  MessageSquare, Settings, Star, Users, Video, Wallet,
} from "lucide-react";
import type { NavItem } from "./shell";

type T = (key: string) => string;

export const studentNav = (t: T): NavItem[] => [
  { href: "/student", label: t("overview"), icon: LayoutDashboard, ready: true },
  { href: "/student/lessons", label: t("lessons"), icon: Video, ready: false },
  { href: "/teachers", label: t("teachers"), icon: Users, ready: false },
  { href: "/student/messages", label: t("messages"), icon: MessageSquare, ready: false },
  { href: "/student/wallet", label: t("wallet"), icon: Wallet, ready: false },
  { href: "/library", label: t("library"), icon: BookOpenText, ready: false },
  { href: "/student/settings", label: t("settings"), icon: Settings, ready: false },
];

export const teacherNav = (t: T): NavItem[] => [
  { href: "/teacher", label: t("overview"), icon: LayoutDashboard, ready: true },
  { href: "/teacher/application", label: t("application"), icon: ClipboardCheck, ready: false },
  { href: "/teacher/calendar", label: t("calendar"), icon: CalendarDays, ready: false },
  { href: "/teacher/lessons", label: t("lessons"), icon: Video, ready: false },
  { href: "/teacher/earnings", label: t("earnings"), icon: Wallet, ready: false },
  { href: "/teacher/reviews", label: t("reviews"), icon: Star, ready: false },
  { href: "/library", label: t("library"), icon: BookOpenText, ready: false },
  { href: "/teacher/messages", label: t("messages"), icon: MessageSquare, ready: false },
  { href: "/teacher/settings", label: t("settings"), icon: Settings, ready: false },
];

export const adminNav = (t: T): NavItem[] => [
  { href: "/admin", label: t("overview"), icon: LayoutDashboard, ready: true },
  { href: "/admin/applications", label: t("applications"), icon: ClipboardCheck, ready: false },
  { href: "/admin/users", label: t("users"), icon: Users, ready: false },
  { href: "/admin/payments", label: t("payments"), icon: CreditCard, ready: false },
  { href: "/admin/library", label: t("content"), icon: Library, ready: false },
  { href: "/admin/audit", label: t("auditLog"), icon: FileClock, ready: false },
  { href: "/admin/settings", label: t("settings"), icon: Settings, ready: false },
];
