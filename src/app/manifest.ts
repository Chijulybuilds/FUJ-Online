import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

/** Name + icon used when someone adds the site to their phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    // Shown under the home-screen icon, where long names get cut off.
    short_name: "FlagUpJesus",
    description: "We Love, We Give, We Change The World.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#bd1722",
    icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }]
  };
}
