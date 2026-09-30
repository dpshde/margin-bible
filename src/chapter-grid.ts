/** Chapter/book picker markup + browser behavior. Rails chapter-grid parity. */
import { bookCodes, bookName, chapterCount, testamentCodes } from "./books";
import { escapeHtml } from "./html";

export function chapterPath(book: string, n: number): string {
  return `/${String(book).toLowerCase()}.${n}`;
}

export function chapterGridHtml(book: string, chapter: number): string {
  const name = bookName(book) || book;
  const { ot, nt } = testamentCodes();
  const bookCell = (code: string) => {
    const cur = code.toUpperCase() === book.toUpperCase();
    return `<button type="button" class="chapter-grid-cell${cur ? " is-current" : ""}" data-book="${escapeHtml(code)}"${cur ? ' aria-current="true"' : ""}>${escapeHtml(code)}</button>`;
  };
  const chapCells = chapterCellsHtml(book, chapterCount(book), book, chapter);
  return `<div id="chapter-grid" class="chapter-grid" hidden role="dialog" aria-modal="true" aria-labelledby="chapter-grid-heading">
  <div class="chapter-grid-sheet">
    <button type="button" class="chapter-grid-book" id="chapter-grid-heading" aria-expanded="false" aria-controls="chapter-grid-books">${escapeHtml(name)}</button>
    <div id="chapter-grid-books" class="chapter-grid-books" hidden>
      <p class="chapter-grid-group">Old Testament</p>
      <div class="chapter-grid-cells">${ot.map(bookCell).join("")}</div>
      <p class="chapter-grid-group">New Testament</p>
      <div class="chapter-grid-cells">${nt.map(bookCell).join("")}</div>
    </div>
    <div class="chapter-grid-cells" id="chapter-grid-chapters" data-book="${escapeHtml(book.toUpperCase())}">${chapCells}</div>
  </div>
</div>
<script type="application/json" id="books-meta">${JSON.stringify({
    codes: bookCodes(),
    names: Object.fromEntries(bookCodes().map((c) => [c, bookName(c)])),
    chapterCounts: Object.fromEntries(bookCodes().map((c) => [c, chapterCount(c)])),
  }).replace(/</g, "\\u003c")}</script>`;
}

export function chapterCellsHtml(book: string, count: number, currentBook: string, currentChapter: number): string {
  const total = Number(count) || 0;
  let html = "";
  for (let n = 1; n <= total; n += 1) {
    const current = book.toUpperCase() === currentBook.toUpperCase() && n === Number(currentChapter);
    html += `<a href="${chapterPath(book, n)}" class="chapter-grid-cell${current ? " is-current" : ""}"${current ? ' aria-current="page"' : ""} data-chapter-nav>${n}</a>`;
  }
  return html;
}
