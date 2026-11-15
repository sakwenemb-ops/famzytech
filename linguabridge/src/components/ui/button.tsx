import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const base = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        secondary: "bg-surface text-fg border border-border hover:bg-surface-2",
        ghost: "text-fg hover:bg-surface-2",
        danger: "bg-danger text-white hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-12 px-6 text-base" },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** Class names for a button-styled element; conflicting classes passed in (e.g. "hidden") win. */
export function buttonVariants({ className, ...v }: VariantProps<typeof base> & { className?: string } = {}) {
  return cn(base(v), className);
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof base>;

export function Button({ className, variant, size, block, ...props }: Props) {
  return <button className={buttonVariants({ variant, size, block, className })} {...props} />;
}
