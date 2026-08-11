import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Image path required" }, { status: 400 });
  }

  try {
    // Construct the URL internally so the domain is never exposed to the client
    const targetUrl = `https://pagalnew.com/${path}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://pagalnew.com/",
      },
    });

    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error.message);
    // Return a 1x1 transparent pixel or 404
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
