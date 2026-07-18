import type { MetadataRoute } from "next";

// Web app manifest — drives "Add to Home Screen" / installed-PWA appearance.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BT OS",
    short_name: "BT OS",
    description: "Personal operating system",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // maskable copies so Android can safe-zone crop without clipping the mark
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
