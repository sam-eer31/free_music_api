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
    const songRes = await axios.get(`https://pagalnew.com/songs/${slug}.html`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(songRes.data);
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

    // 2. Download the MP3 file into memory
    const downloadUrl = `https://pagalnew.com/320-download/${downloadId}`;
    const fileRes = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://pagalnew.com/",
      },
      timeout: 30000,
      maxRedirects: 5,
    });

    // 3. Upload to tmpfiles.org
    const formData = new FormData();
    const blob = new Blob([fileRes.data], { type: "audio/mpeg" });
    formData.append("file", blob, `${slug}.mp3`);
    formData.append("expire", "172800"); // 48 hours

    const tmRes = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
    });

    if (!tmRes.ok) {
      throw new Error("Failed to upload to tmpfiles.org");
    }

    const tmData = await tmRes.json();
    
    // tmData.data.url looks like "https://tmpfiles.org/12345/song.mp3"
    // The actual direct download page/link is "https://tmpfiles.org/dl/12345/song.mp3"
    let finalUrl = tmData?.data?.url;
    if (finalUrl) {
      finalUrl = finalUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    } else {
      throw new Error("Invalid response from tmpfiles.org");
    }

    return NextResponse.json({
      success: true,
      message: "Song downloaded and uploaded to tmpfiles.org successfully",
      expires_in: "48 hours",
      downloadUrl: finalUrl,
    });
  } catch (error) {
    console.error("V1 Download error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to process download. Please try again." },
      { status: 500 }
    );
  }
}
