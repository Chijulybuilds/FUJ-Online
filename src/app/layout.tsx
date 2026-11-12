import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/playfair-display/600-italic.css";
import "@fontsource/playfair-display/700.css";
import "./globals.css";
import { HydrationMark } from "@/components/shared/hydration-mark";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} | FlagUpJesus Global Ministry`,
  applicationName: APP_NAME,
  description: "We Love, We Give, We Change The World. Worship with FlagUpJesus Global Ministry online and in person — check in, share prayer requests and testimonies, and stay connected."
};
export const viewport: Viewport = { themeColor: "#bd1722", width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem("flagupjesus-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<HydrationMark /></body>
    </html>
  );
}
