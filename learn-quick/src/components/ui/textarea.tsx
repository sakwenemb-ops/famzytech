import { cn } from "@/lib/utils";
import { inputClass } from "./input";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-2.5", className)} {...props} />;
}
