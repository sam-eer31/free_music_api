import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(request, { params }) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json(
      { error: "Song slug is required" },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get(
      `https://pagalnew.com/songs/${slug}.html`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(response.data);

    // Extract download ID from the download button href
    // Pattern: href="https://pagalnew.com/320-download/6024"
    let downloadId = null;

    $('a[href*="320-download/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/320-download\/(\d+)/);
      if (match) {
        downloadId = match[1];
      }
    });

    // Fallback: try 128-downloads pattern
    if (!downloadId) {
      $('a[href*="128-downloads/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/128-downloads\/(\d+)/);
        if (match) {
          downloadId = match[1];
        }
      });
    }

    // Also try audio src
    if (!downloadId) {
      $("audio[src]").each((_, el) => {
        const src = $(el).attr("src") || "";
        const match = src.match(/(?:128-downloads|320-download)\/(\d+)/);
        if (match) {
          downloadId = match[1];
        }
      });
    }

    if (!downloadId) {
      return NextResponse.json(
        { error: "Could not find download ID for this song" },
        { status: 404 }
      );
    }

    // Extract song metadata
    const songName = extractField($, "Song Name:");
    const album = extractField($, "Album:");
    const singer = extractField($, "Singer(s):");
    const starcast = extractField($, "Starcast:");
    const composer = extractField($, "Composer:");

    // Extract cover image via proxy to hide source
    let coverImage = "";
    const ogImage = $('meta[property="og:image"]').attr("content") || "";
    if (ogImage) {
      let path = "";
      if (ogImage.includes("pagalnew.com")) {
        const urlObj = new URL(ogImage);
        path = urlObj.pathname.replace(/^\//, "");
      } else {
        path = ogImage.replace("./", "").replace(/^\//, "");
      }
      if (path) {
        coverImage = `/api/image?path=${encodeURIComponent(path)}`;
      }
    }

    return NextResponse.json({
      slug,
      downloadId,
      songName,
      album,
      singer,
      starcast,
      composer,
      coverImage,
      downloadUrl: `/api/download/${downloadId}`,
    });
  } catch (error) {
    console.error("Song fetch error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch song details. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Extracts text content following a bold label like "Song Name:", "Album:", etc.
 */
function extractField($, label) {
  let value = "";
  $("b").each((_, el) => {
    const text = $(el).text().trim();
    if (text === label) {
      // The value is the text node immediately after the <b> tag's parent context
      const parent = $(el).parent();
      const fullText = parent.text();
      const idx = fullText.indexOf(label);
      if (idx !== -1) {
        value = fullText.substring(idx + label.length).trim();
        // Clean up — stop at the next label if present
        const nextLabelIdx = value.search(
          /\b(Song Name:|Album:|Singer\(s\):|Starcast:|Composer:)/
        );
        if (nextLabelIdx !== -1) {
          value = value.substring(0, nextLabelIdx).trim();
        }
      }
    }
  });
  return value;
}
