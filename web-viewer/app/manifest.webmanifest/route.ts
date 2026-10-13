/**
 * Dynamic Web App Manifest
 *
 * Generates manifest.webmanifest for PWA support including:
 * - App metadata (name, theme colors)
 * - Icons from existing assets
 * - Web Share Target for mobile sharing
 */
import { NextResponse } from "next/server";

export async function GET() {
  const manifest = {
    name: "Magpie Archive",
    short_name: "Magpie",
    description: "Kişisel sosyal medya arşivin",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/logo-96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Web Share Target API
    // When user shares from Instagram/X app, the URL comes here
    share_target: {
      action: "/share-target",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        url: "url",
        text: "text",
        title: "title",
      },
    },
    categories: ["social", "utilities"],
    lang: "tr",
    dir: "ltr",
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400", // 1 day
    },
  });
}
