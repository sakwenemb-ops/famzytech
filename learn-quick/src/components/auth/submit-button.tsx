"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** `pending` overrides the form status, for forms submitted with onSubmit (useKeepFormAction). */
export function SubmitButton({ children, pending: pendingProp, ...props }: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" block disabled={pending} aria-busy={pending} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
