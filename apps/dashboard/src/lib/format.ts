export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatCompactNumber(value: number) {
  return formatNumber(value, {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  });
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 2 : 4,
    minimumFractionDigits: value >= 1 ? 2 : 4,
    style: "currency",
  }).format(value);
}
