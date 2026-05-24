"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-sky-600 text-white">
            <LockKeyhole className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Inventory Pricing</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in to continue
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Username</span>
            <Input name="username" autoComplete="username" required autoFocus />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Password</span>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {state.error ? (
            <p className="text-sm text-rose-600">{state.error}</p>
          ) : null}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
