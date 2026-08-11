import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const maxDuration = 60; // 60 seconds limit for Vercel

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { success: false, error: "Song slug parameter is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch song page to get downloadId
    let songUrl = `https://pagalnew.com/songs/${slug}.html`;
    
    if (process.env.ZENROWS_API_KEY) {
      songUrl = `https://api.zenrows.com/v1/?apikey=${process.env.ZENROWS_API_KEY}&url=${encodeURIComponent(songUrl)}&premium_proxy=true`;
    }

    const songRes = await fetch(songUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (!songRes.ok) {
      throw new Error(`Pagalnew responded with status ${songRes.status} ${songRes.statusText}`);
    }

    const htmlData = await songRes.text();
    const $ = cheerio.load(htmlData);
    let downloadId = null;

    $('a[href*="320-download/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/320-download\/(\d+)/);
      if (match) {
        downloadId = match[1];
      }
    });

    if (!downloadId) {
      $('a[href*="128-downloads/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/128-downloads\/(\d+)/);
        if (match) {
          downloadId = match[1];
        }
      });
    }

    if (!downloadId) {
      return NextResponse.json(
        { success: false, error: "Could not find download ID for this song." },
        { status: 404 }
      );
    }

    const downloadUrl = `https://pagalnew.com/320-download/${downloadId}`;

    // Note: Due to Cloudflare blocks and ZenRows 2MB file size limits on free plans,
    // Vercel serverless functions cannot successfully download 5-10MB MP3 files from Pagalnew
    // to upload them to tmpfiles.org. 
    // Therefore, this API now returns the direct Pagalnew download link instead.
    
    return NextResponse.json({
      success: true,
      message: "Direct download link retrieved successfully.",
      data: {
        songName,
        artist,
        downloadUrl: downloadUrl,
        expiresIn: "Unlimited (Direct Link)",
      },
    });
  } catch (error) {
    console.error("V1 Download Error:", error.message);
    return NextResponse.json(
      { error: `Failed to process download: ${error.message}` },
      { status: 500 }
    );
  }
}
