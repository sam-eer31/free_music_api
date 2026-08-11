import "./globals.css";

export const metadata = {
  title: "TuneBox Search — Download Songs in 320kbps",
  description:
    "Search and download your favorite songs in high quality 320kbps MP3 format.",
  keywords:
    "mp3 download, bollywood songs, punjabi songs, hindi songs, 320kbps, music download",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
