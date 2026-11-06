import { Suspense } from "react";
import { CheckInFlow } from "./flow";
export const dynamic = "force-dynamic";
export default function CheckInPage() {
  return <Suspense><CheckInFlow /></Suspense>;
}
