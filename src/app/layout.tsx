import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlagUpJesus | Flag of Jesus Global Ministry",
  description: "Church management and member engagement platform for Flag of Jesus Global Ministry."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light"><body>{children}</body></html>;
}
