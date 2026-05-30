import type { FeeLineItemPreview } from "../api/studentFees";

export function sumLineItems(lineItems: FeeLineItemPreview[]): number {
  return lineItems.reduce((sum, li) => sum + (Number(li.amountUgx) || 0), 0);
}

export function formatLineItemSummary(lineItems: FeeLineItemPreview[]): string {
  if (lineItems.length === 0) return "No fee line items";
  return lineItems.map((li) => `${li.feeCategoryCode}: ${li.amountUgx.toLocaleString()} UGX`).join(" · ");
}
