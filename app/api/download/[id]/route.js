import { NextResponse } from "next/server";

export const maxDuration = 60; // 60 seconds limit for Vercel

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Download ID required" }, { status: 400 });
  }

  // Redirect the user directly to the Pagalnew download link.
  // We cannot proxy it through Vercel because Cloudflare blocks Vercel IPs (403),
  // and ZenRows proxy has a 2MB size limit on free plans which fails for MP3s (413).
  // By redirecting, the user's browser (residential IP) downloads it directly.
  return NextResponse.redirect(`https://pagalnew.com/320-download/${id}`);
}
