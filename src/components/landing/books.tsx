import Image from "next/image";

/** Pastor Caleb's books — covers and subtitles as published. */
const BOOKS = [
  { title: "The 5 Dimensions of Grace", blurb: "Unveiling the mysteries that unlock greater dimensions of grace in your spiritual journey.", cover: "/images/fuj/book-5-dimensions-of-grace.webp" },
  { title: "The 7 Stages of Progress", blurb: "Progress is not an event, it is a journey.", cover: "/images/fuj/book-7-stages-of-progress.webp" }
];

export function Books() {
  return (
    <div className="grid gap-8 sm:grid-cols-2" data-testid="books">
      {BOOKS.map((b) => (
        <div key={b.title} className="book-wrap">
          <div className="book-photo">
            <div className="book-3d">
              <Image src={b.cover} alt={`${b.title} by Pst. Umanuwa D. Caleb — book cover`} width={725} height={1024} sizes="160px" className="h-auto w-[120px] sm:w-[140px]" />
            </div>
          </div>
          <div><h3 className="text-lg font-bold">{b.title}</h3><p className="mt-1 text-sm muted">{b.blurb}</p><p className="mt-2 text-xs font-semibold tracking-wide text-[#ffc7cb]">PST. UMANUWA D. CALEB</p></div>
        </div>
      ))}
    </div>
  );
}
