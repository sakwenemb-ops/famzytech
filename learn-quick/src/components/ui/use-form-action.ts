"use client";

import { startTransition, useActionState } from "react";

/**
 * Like useActionState, but submits through onSubmit so React does NOT reset the
 * form afterwards. Use for forms where people should keep what they entered or
 * selected after a validation error.
 */
export function useKeepFormAction<S>(action: (state: Awaited<S>, fd: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Include the button that was clicked (e.g. name="continue" value="1")
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending] as const;
}
