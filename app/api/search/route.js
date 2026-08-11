import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const maxDuration = 60; // 60 seconds limit for Vercel

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim() === "") {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
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

    // Find the "Songs Result" section and extract only songs (skip albums)
    let inSongsSection = false;

    $(".main_page_category_div").each((_, divEl) => {
      const text = $(divEl).text().trim();
      if (text === "Songs Result") {
        inSongsSection = true;
      } else if (inSongsSection) {
        // We've hit the next section divider, stop
        inSongsSection = false;
      }
    });

    // Find all song links that come after "Songs Result" div
    // The structure is: <div>Songs Result</div> followed by <a> tags
    let foundSongsHeader = false;

    $(".main_page_category_div").each((_, el) => {
      if ($(el).text().trim() === "Songs Result") {
        foundSongsHeader = true;
      }
    });

    if (foundSongsHeader) {
      // Get all <a> tags that link to /songs/ pages
      $('a[href*="/songs/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const img = $(el).find("img");
        const titleEl = $(el).find("b");
        const categoryEl = $(el).find("i");
        const spanEl = $(el).find("span");

        if (!href.includes("/songs/")) return;

        // Extract slug from href (e.g., "/songs/tum-hi-ho.html" -> "tum-hi-ho")
        const slugMatch = href.match(/\/songs\/(.+?)\.html/);
        if (!slugMatch) return;

        const slug = slugMatch[1];
        const fullTitle = titleEl.text().trim();
        const category = categoryEl.text().trim();
        const album = spanEl.text().trim();

        // Split title into song name and artist
        let songName = fullTitle;
        let artist = "";
        if (fullTitle.includes(" - ")) {
          const parts = fullTitle.split(" - ");
          songName = parts[0].trim();
          artist = parts.slice(1).join(" - ").trim();
        }

        // Build full image URL via our proxy to hide the source domain
        let image = "";
        const imgSrc = img.attr("src") || "";
        if (imgSrc) {
          let path = "";
          if (imgSrc.startsWith("http")) {
            if (imgSrc.includes("pagalnew.com")) {
               const urlObj = new URL(imgSrc);
               path = urlObj.pathname.replace(/^\//, "");
            }
          } else if (imgSrc.startsWith("../")) {
            path = imgSrc.replace("../", "");
          } else if (imgSrc.startsWith("/")) {
            path = imgSrc.replace(/^\//, "");
          }
          
          if (path) {
             image = `/api/image?path=${encodeURIComponent(path)}`;
          } else if (imgSrc.startsWith("http")) {
             image = imgSrc; // Fallback for unrelated external images
          }
        }

        results.push({
          songName,
          artist,
          album,
          category,
          image,
          slug,
        });
      });
    }

    return NextResponse.json({
      query: query.trim(),
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Search error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch search results. Please try again." },
      { status: 500 }
    );
  }
}
