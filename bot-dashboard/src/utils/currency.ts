// src/utils/currency.ts

export const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR';

/**
 * Format a number as currency using Intl.NumberFormat
 * Defaults to SAR (Saudi Riyals) for the iConnect WooCommerce store.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  options?: Intl.NumberFormatOptions
): string {
  const numericAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const targetCurrency = currency || DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetCurrency,
      maximumFractionDigits: 2,
      ...options,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${targetCurrency}`;
  }
}
