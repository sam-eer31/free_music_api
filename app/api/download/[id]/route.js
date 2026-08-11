import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: "Valid numeric download ID is required" },
      { status: 400 }
    );
  }

  try {
    const downloadUrl = `https://pagalnew.com/320-download/${id}`;

    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://pagalnew.com/",
      },
      timeout: 30000,
      maxRedirects: 5,
    });

    // Get the filename from content-disposition header if available
    let filename = `song-${id}.mp3`;
    const contentDisposition = response.headers["content-disposition"];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      );
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, "").trim();
      }
    }

    return new NextResponse(response.data, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": response.data.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Download error:", error.message);
    return NextResponse.json(
      { error: "Failed to download song. Please try again." },
      { status: 500 }
    );
  }
}
