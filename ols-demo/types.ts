export interface DataPoint {
  id: number;
  x: number;
  y: number;
}

export interface SimulationParams {
  trueSlope: number;
  trueIntercept: number;
  noiseLevel: number;
  batchSize: number; // Points added per tick
  speed: number; // ms per tick
  minSampleSize: number;
  maxSampleSize: number;
  samplingMode: 'cumulative' | 'independent';
  seed: number;
}

export interface OLSResult {
  slope: number;
  intercept: number;
  rSquared: number;
  slopeStdErr: number;
}

export interface HistoryPoint {
  n: number;
  estimatedSlope: number;
  estimatedIntercept: number;
  slopeStdErr: number;
}