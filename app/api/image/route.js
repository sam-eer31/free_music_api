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
    
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://pagalnew.com/",
      },
      timeout: 15000,
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    
    return new NextResponse(response.data, {
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
