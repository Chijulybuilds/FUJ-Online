"use client";
import { useState, type ReactNode } from "react";
import { RegisterForm } from "./register-form";
import { ChildRegisterForm } from "./child-register-form";

type Prefill = { name?: string; phone?: string; email?: string; address?: string };

/** "Who are you registering?" — yourself, or a child who doesn't have a phone. */
export function RegisterTabs({ initial, otp, checkInNote, google, dev }: { initial: "self" | "child"; otp: boolean; checkInNote?: string; google?: ReactNode; dev?: ReactNode }) {
  const [mode, setMode] = useState(initial);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  return (
    <>
      <div className="seg mt-5" role="tablist" aria-label="Who are you registering?">
        <button type="button" role="tab" aria-selected={mode === "self"} className={mode === "self" ? "on" : ""} onClick={() => setMode("self")}>👤 Myself</button>
        <button type="button" role="tab" aria-selected={mode === "child"} className={mode === "child" ? "on" : ""} onClick={() => setMode("child")} data-testid="tab-child">🧒 My child <span className="hidden sm:inline">(no phone)</span></button>
      </div>
      {mode === "self" ? (
        <div className="mt-6">
          {google}
          <RegisterForm key={prefill ? "prefilled" : "blank"} otp={otp} defaults={prefill ?? {}} checkInNote={checkInNote} />
          {dev}
        </div>
      ) : (
        <ChildRegisterForm checkInNote={checkInNote} onRegisterSelf={(g) => { setPrefill({ name: g.guardianName, phone: g.phone, email: g.email, address: g.address }); setMode("self"); }} />
      )}
    </>
  );
}
