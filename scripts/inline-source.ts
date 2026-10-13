/** Replacement callbacks preserve literal $&, $` and $' tokens inside bundled code. */
export function inlineScript(html: string, tag: string, source: string): string {
  const safe = source.replace(/<\/script/gi, match => '<\\/' + match.slice(2));
  return html.replace(tag, () => `<script type="module">${safe}</script>`);
}
export function inlineStyle(html: string, tag: string, source: string): string {
  return html.replace(tag, () => `<style>${source}</style>`);
}
