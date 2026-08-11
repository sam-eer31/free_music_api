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
    const response = await axios.get("https://pagalnew.com/search.php", {
      params: { find: query.trim() },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
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
