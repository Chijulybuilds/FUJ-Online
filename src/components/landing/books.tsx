import Image from "next/image";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Pastor Caleb's books. Subtitles are taken from the published covers. */
const BOOKS = [
  { title: "The 5 Dimensions of Grace", blurb: "Unveiling the mysteries that unlock greater dimensions of grace in your spiritual journey.", tone: "book-red", n: "5", cover: "/images/fuj/book-5-dimensions-of-grace.webp" },
  { title: "The 7 Stages of Progress", blurb: "Progress is not an event, it is a journey.", tone: "book-ink", n: "7", cover: "/images/fuj/book-7-stages-of-progress.webp" }
];

const hasCover = (src: string) => existsSync(join(process.cwd(), "public", src));

/** Real cover photos when present in public/images/fuj/, otherwise CSS 3D covers. */
export function Books() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {BOOKS.map((b) => (
        <div key={b.title} className="book-wrap">
          {hasCover(b.cover) ? (
            <div className="book-photo"><Image src={b.cover} alt={`${b.title} by Pst. Umanuwa D. Caleb — book cover`} width={240} height={340} className="h-auto w-[130px] sm:w-[150px]" /></div>
          ) : (
            <div className={`book ${b.tone}`}>
              <div className="cover">
                <span className="b-num">{b.n}</span>
                <span className="b-title">{b.title.replace(/^The \d /, "")}</span>
                <span className="b-author">PST. UMANUWA D. CALEB</span>
              </div>
            </div>
          )}
          <div><h3 className="text-lg font-bold">{b.title}</h3><p className="mt-1 text-sm muted">{b.blurb}</p></div>
        </div>
      ))}
    </div>
  );
}
