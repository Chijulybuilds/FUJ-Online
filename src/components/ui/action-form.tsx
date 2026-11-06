"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

export type ActionState = { ok?: boolean; message?: string; redirectTo?: string } | null;
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Form wrapper for server actions that shows inline success/error feedback. */
export function ActionForm({ action, children, className, resetOnSuccess = false }: { action: Action; children: ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => { ref.current?.setAttribute("data-ready", "true"); }, []);
  useEffect(() => {
    if (state?.redirectTo) {
      const target = state.redirectTo;
      const from = window.location.pathname + window.location.search;
      router.push(target);
      // Fallback: if the client router didn't navigate (rare race after a server action), do a full navigation.
      const timer = setTimeout(() => { if (window.location.pathname + window.location.search === from) window.location.assign(target); }, 2500);
      return () => clearTimeout(timer);
    }
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess, router]);
  return (
    <form ref={ref} action={formAction} className={className} data-action-form>
      {children}
      {state?.message && !state.redirectTo && <p role="status" className={`alert mt-3 ${state.ok ? "alert-ok" : "alert-err"}`}>{state.message}</p>}
    </form>
  );
}

/**
 * Submit button for server-action forms. When `name`/`value` are given, the value is copied into a hidden
 * field on click so it always reaches the action's FormData (the submitter itself isn't always included).
 */
export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Saving…", name, value }: { children: ReactNode; className?: string; pendingText?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} onClick={(e) => {
      const form = e.currentTarget.form;
      if (!form || !name) return;
      let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][data-submitter="${name}"]`);
      if (!input) { input = document.createElement("input"); input.type = "hidden"; input.name = name; input.dataset.submitter = name; form.appendChild(input); }
      input.value = value ?? "";
    }}>
      {pending ? pendingText : children}
    </button>
  );
}
