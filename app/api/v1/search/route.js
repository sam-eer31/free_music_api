import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim() === "") {
    return NextResponse.json(
      { success: false, error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  try {
    const targetUrl = `https://pagalnew.com/search.php?find=${encodeURIComponent(query.trim())}`;
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Pagalnew responded with status ${response.status} ${response.statusText}`);
    }

    const htmlData = await response.text();
    const $ = cheerio.load(htmlData);
    const results = [];

    let foundSongsHeader = false;
    $(".main_page_category_div").each((_, el) => {
      if ($(el).text().trim() === "Songs Result") {
        foundSongsHeader = true;
      }
    });

    if (foundSongsHeader) {
      $('a[href*="/songs/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const titleEl = $(el).find("b");
        const categoryEl = $(el).find("i");
        const spanEl = $(el).find("span");

        if (!href.includes("/songs/")) return;

        const slugMatch = href.match(/\/songs\/(.+?)\.html/);
        if (!slugMatch) return;

        const slug = slugMatch[1];
        const fullTitle = titleEl.text().trim();
        const category = categoryEl.text().trim();
        const album = spanEl.text().trim();

        let songName = fullTitle;
        let artist = "";
        if (fullTitle.includes(" - ")) {
          const parts = fullTitle.split(" - ");
          songName = parts[0].trim();
          artist = parts.slice(1).join(" - ").trim();
        }

        // Generate absolute URL for download
        const url = new URL(request.url);
        const downloadUrl = `${url.origin}/api/v1/download?slug=${slug}`;

        results.push({
          title: songName,
          artist,
          album,
          category,
          slug,
          downloadUrl,
        });
      });
    }

    return NextResponse.json({
      success: true,
      query: query.trim(),
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("V1 Search error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to fetch search results. Please try again." },
      { status: 500 }
    );
  }
}
