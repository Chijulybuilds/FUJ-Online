"use client";
import { useEffect } from "react";
/** Marks <html data-hydrated> once React has hydrated (used by end-to-end tests). */
export function HydrationMark() {
  useEffect(() => { document.documentElement.dataset.hydrated = "true"; }, []);
  return null;
}
