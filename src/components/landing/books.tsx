const BOOKS = [
  { title: "The 5 Dimensions of Grace", blurb: "Unpacking the systematic framework of spiritual grace.", tone: "book-red", n: "5" },
  { title: "The 7 Stages of Progress", blurb: "A handbook for structural personal growth, spiritual discipline and avoiding stagnation.", tone: "book-gold", n: "7" }
];

/** CSS 3D book covers for Pastor Caleb's core titles. */
export function Books() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {BOOKS.map((b) => (
        <div key={b.title} className="book-wrap">
          <div className={`book ${b.tone}`}>
            <div className="cover">
              <span className="b-num">{b.n}</span>
              <span className="b-title">{b.title.replace(/^The \d /, "")}</span>
              <span className="b-author">UMANUWA D. CALEB</span>
            </div>
          </div>
          <div><h3 className="text-lg font-bold">{b.title}</h3><p className="mt-1 text-sm muted">{b.blurb}</p></div>
        </div>
      ))}
    </div>
  );
}
