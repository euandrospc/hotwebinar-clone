/** Fixed-horizon binary-outcome statistics. All rates and intervals are fractions. */
const Z_95 = 1.959963984540054;
const Z_POWER_80 = 0.8416212335729143;

function validCount(successes: number, total: number) {
  return Number.isSafeInteger(successes) && Number.isSafeInteger(total) && successes >= 0 && total >= successes;
}

/** Standard equal-allocation, two-sided 5% alpha / 80% power approximation. */
export function calculateSampleSize(baselineRate: number, relativeLift: number): number {
  const target = baselineRate * (1 + relativeLift);
  if (!Number.isFinite(baselineRate) || !Number.isFinite(relativeLift) || baselineRate <= 0 || baselineRate >= 1 || relativeLift <= 0 || target >= 1) {
    throw new RangeError("Baseline and lift must define two rates strictly between zero and one");
  }
  const mean = (baselineRate + target) / 2;
  const numerator = Z_95 * Math.sqrt(2 * mean * (1 - mean))
    + Z_POWER_80 * Math.sqrt(baselineRate * (1 - baselineRate) + target * (1 - target));
  const size = Math.ceil((numerator / (target - baselineRate)) ** 2);
  if (!Number.isSafeInteger(size) || size <= 0) throw new RangeError("Sample size is not representable");
  return size;
}

/** erfc approximation avoids subtracting nearly equal numbers in the normal tail. */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const tail = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
    + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return Math.max(0, Math.min(2, x >= 0 ? tail : 2 - tail));
}

export function wilsonInterval(successes: number, total: number): [number, number] | null {
  if (!validCount(successes, total)) throw new RangeError("Invalid binary counts");
  if (!total) return null;
  const p = successes / total;
  const z2 = Z_95 ** 2;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const halfWidth = Z_95 * Math.sqrt(p * (1 - p) / total + z2 / (4 * total ** 2)) / denominator;
  return [Math.max(0, center - halfWidth), Math.min(1, center + halfWidth)];
}

export function compareProportions(successesA: number, totalA: number, successesB: number, totalB: number) {
  if (!validCount(successesA, totalA) || !validCount(successesB, totalB)) throw new RangeError("Invalid binary counts");
  if (!totalA || !totalB) return { delta: null, relativeLift: null, interval: null, pValue: null };
  const a = successesA / totalA;
  const b = successesB / totalB;
  const delta = b - a;
  const relativeLift = a > 0 ? delta / a : null;
  // The normal approximation is withheld for sparse or all-success samples.
  if (Math.min(successesA, totalA - successesA, successesB, totalB - successesB) < 10) {
    return { delta, relativeLift, interval: null, pValue: null };
  }
  const pooled = (successesA + successesB) / (totalA + totalB);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
  const pValue = Math.min(1, erfc(Math.abs(delta / standardError) / Math.SQRT2));
  const halfWidth = Z_95 * Math.sqrt(a * (1 - a) / totalA + b * (1 - b) / totalB);
  return { delta, relativeLift, interval: [Math.max(-1, delta - halfWidth), Math.min(1, delta + halfWidth)] as [number, number], pValue };
}

/** SRM is evaluated on all allocated browsers, before filtering or maturity. */
export function sampleRatioMismatchPValue(countA: number, countB: number): number | null {
  if (!validCount(0, countA) || !validCount(0, countB)) throw new RangeError("Invalid allocation counts");
  const total = countA + countB;
  if (total < 20) return null;
  const chiSquare = (countA - countB) ** 2 / total;
  return Math.min(1, erfc(Math.sqrt(chiSquare / 2)));
}
