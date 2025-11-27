import { DataPoint, OLSResult } from '../types';

/**
 * A distinct, deterministic random number generator based on a seed and an index.
 * Returns a number between 0 and 1.
 * Using a simple hash function (Mulberry32-style) to allow random access to the i-th random number
 * without needing to generate the previous i-1 numbers.
 */
export const seededRandom = (seed: number, index: number): number => {
  let t = (seed + index * 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Generates a random normal variable (Box-Muller transform) using a provided random function
 */
export const randomNormal = (mean: number, stdDev: number, seed: number, index: number): number => {
  // We need two independent random numbers for Box-Muller.
  // We use index * 2 and index * 2 + 1 to ensure uniqueness per point.
  let u = 0, v = 0;
  while (u === 0) u = seededRandom(seed, index * 2);
  while (v === 0) v = seededRandom(seed, index * 2 + 1);
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
};

/**
 * Calculates OLS coefficients from a set of points
 */
export const calculateOLS = (data: DataPoint[]): OLSResult => {
  const n = data.length;
  // We need at least 3 points to calculate variance (n-2 df) safely
  if (n < 3) {
    return { slope: 0, intercept: 0, rSquared: 0, slopeStdErr: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = data[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
     return { slope: 0, intercept: 0, rSquared: 0, slopeStdErr: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared and Standard Error
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = data[i];
    const predictedY = slope * x + intercept;
    ssTot += (y - meanY) ** 2;
    ssRes += (y - predictedY) ** 2;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  // Calculate Slope Standard Error
  // Sxx = sum((x - meanX)^2) = sumXX - (sumX^2)/n
  const sxx = sumXX - (sumX * sumX) / n;
  
  // Variance of the error term estimate (sigma^2)
  const varError = ssRes / (n - 2);
  
  // SE(beta1) = sqrt( sigma^2 / Sxx )
  const slopeStdErr = sxx > 0 ? Math.sqrt(varError / sxx) : 0;

  return {
    slope: Number.isNaN(slope) ? 0 : slope,
    intercept: Number.isNaN(intercept) ? 0 : intercept,
    rSquared: Number.isNaN(rSquared) ? 0 : rSquared,
    slopeStdErr: Number.isNaN(slopeStdErr) ? 0 : slopeStdErr
  };
};