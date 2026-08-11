import "./globals.css";

export const metadata = {
  title: "TuneBox — Download Songs",
  description:
    "Search and download your favorite songs in high quality MP3 format.",
  keywords:
    "mp3 download, bollywood songs, punjabi songs, hindi songs, music download",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
