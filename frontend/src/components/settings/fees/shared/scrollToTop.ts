/** Scroll the nearest scrollable ancestor (or window) so `el` is visible at the top. */
export function scrollPageToElement(el: HTMLElement | null, behavior: ScrollBehavior = "smooth") {
  if (!el) return;
  el.scrollIntoView({ behavior, block: "start" });
}
