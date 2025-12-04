/**
 * Utility helper functions
 */

export function getColorForIndex(index, total) {
  return `hsl(${(index * 360) / total}, 70%, 60%)`;
}

export function formatNumber(num, decimals = 0) {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function roundToNearest(value, nearest = 1) {
  return Math.round(value / nearest) * nearest;
}