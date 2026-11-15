import { Link } from "@/i18n/navigation";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid size-8 place-items-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-fg">
        LQ
      </span>
      <span className="text-[17px]">Learn Quick</span>
    </Link>
  );
}
