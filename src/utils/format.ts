/**
 * VOLTRO Tech Luxury - Formatting Utilities
 * Rule: Persian text and layout, but ALL numbers and digits MUST strictly use
 * English numerals (0-9) for prices, dates, ratings, and statistics.
 */

export function formatPrice(price: number): string {
  if (typeof price !== 'number' || isNaN(price)) return '0';
  return price.toLocaleString('en-US');
}

export function formatNumber(num: number): string {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toLocaleString('en-US');
}

export function formatDate(dateString: string | Date): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    // Format using English numerals (en-US)
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  } catch {
    return String(dateString);
  }
}
