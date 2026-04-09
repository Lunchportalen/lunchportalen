import { Matrix } from "ml-matrix";

import type { MetricRow } from "./dataset";
import type { MetricNormStats } from "./normalize";
import { denormConversion, normalizeMetricRow } from "./normalize";
import type { SequenceSample } from "./sequenceBuilder";
import {
  SEQUENCE_EPOCHS,
  SEQUENCE_HIDDEN_DIM,
  SEQUENCE_INPUT_DIM,
  SEQUENCE_LEARNING_RATE,
  SEQUENCE_MIN_SEQUENCES,
  SEQUENCE_PIPELINE_VERSION,
  SEQUENCE_SEED_LABEL,
} from "./sequenceConstants";

export type SequencePseudoRnnArtifact = {
  kind: "sequence_pseudo_rnn";
  version: number;
  seedLabel: string;
  windowSize: number;
  hiddenDim: number;
  inputDim: number;
  W_x: number[][];
  W_h: number[][];
  b_h: number[][];
  v: number[][];
  b_y: number;
  norm: MetricNormStats;
  trainedAt: number;
  nSequences: number;
  nEpochs: number;
};

const INIT_SEED = 0x5eede1e7;

/** Deterministic PRNG (no Math.random). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function initMatrix(rows: number, cols: number, rng: () => number, scale: number): Matrix {
  const m = new Matrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      m.set(i, j, (rng() * 2 - 1) * scale);
    }
  }
  return m;
}

function colVecFromRow(r: MetricRow): Matrix {
  return new Matrix([[r.conversion], [r.traffic], [r.revenue], [r.churn]]);
}

function tanhMat(m: Matrix): Matrix {
  const out = new Matrix(m.rows, m.columns);
  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.columns; j++) {
      const x = m.get(i, j);
      out.set(i, j, Math.tanh(x));
    }
  }
  return out;
}

function ewMul(a: Matrix, b: Matrix): Matrix {
  const out = new Matrix(a.rows, a.columns);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.columns; j++) {
      out.set(i, j, a.get(i, j) * b.get(i, j));
    }
  }
  return out;
}

function ewScale(m: Matrix, s: number): Matrix {
  const out = new Matrix(m.rows, m.columns);
  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.columns; j++) {
      out.set(i, j, m.get(i, j) * s);
    }
  }
  return out;
}

function matAdd(a: Matrix, b: Matrix): Matrix {
  return a.clone().add(b);
}

function zeros(rows: number, cols: number): Matrix {
  return Matrix.zeros(rows, cols);
}

function forwardOneSequence(
  input: MetricRow[],
  W_x: Matrix,
  W_h: Matrix,
  b_h: Matrix,
  v: Matrix,
  b_y: number,
  norm: MetricNormStats
): { yHatNorm: number; xs: Matrix[]; hs: Matrix[] } {
  const L = input.length;
  const xs: Matrix[] = [];
  const hs: Matrix[] = [];
  let hPrev = zeros(W_h.rows, 1);
  for (let t = 0; t < L; t++) {
    const x = colVecFromRow(normalizeMetricRow(input[t], norm));
    xs.push(x);
    const a = matAdd(matAdd(W_x.mmul(x), W_h.mmul(hPrev)), b_h);
    const h = tanhMat(a);
    hs.push(h);
    hPrev = h;
  }
  const hLast = hs[L - 1];
  const yHatNorm = v.transpose().mmul(hLast).get(0, 0) + b_y;
  return { yHatNorm, xs, hs };
}

function backwardOneSequence(
  targetNorm: number,
  yHatNorm: number,
  xs: Matrix[],
  hs: Matrix[],
  W_h: Matrix,
  v: Matrix
): {
  dW_x: Matrix;
  dW_h: Matrix;
  db_h: Matrix;
  dv: Matrix;
  db_y: number;
} {
  const hidden = W_h.rows;
  const inputDim = SEQUENCE_INPUT_DIM;
  const L = xs.length;
  const dy = yHatNorm - targetNorm;

  const dW_x = zeros(hidden, inputDim);
  const dW_h = zeros(hidden, hidden);
  const db_h = zeros(hidden, 1);
  const dv = ewScale(hs[L - 1], dy);
  const db_y = dy;

  let dhIn = ewScale(v, dy);

  for (let t = L - 1; t >= 0; t--) {
    const hT = hs[t];
    const oneMinusH2 = new Matrix(hidden, 1);
    for (let i = 0; i < hidden; i++) {
      const h = hT.get(i, 0);
      oneMinusH2.set(i, 0, 1 - h * h);
    }
    const gradA = ewMul(oneMinusH2, dhIn);

    dW_x.add(gradA.mmul(xs[t].transpose()));
    const hPrev = t > 0 ? hs[t - 1] : zeros(hidden, 1);
    dW_h.add(gradA.mmul(hPrev.transpose()));
    db_h.add(gradA);

    if (t > 0) {
      dhIn = W_h.transpose().mmul(gradA);
    }
  }

  return { dW_x, dW_h, db_h, dv, db_y };
}

function clipMatrixNorm(m: Matrix, maxNorm: number): void {
  let sum = 0;
  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.columns; j++) {
      const v = m.get(i, j);
      sum += v * v;
    }
  }
  const n = Math.sqrt(sum) || 1;
  if (n > maxNorm) {
    const s = maxNorm / n;
    for (let i = 0; i < m.rows; i++) {
      for (let j = 0; j < m.columns; j++) {
        m.set(i, j, m.get(i, j) * s);
      }
    }
  }
}

/**
 * One-layer tanh RNN trained with full BPTT; deterministic init via mulberry32(SEED).
 */
export function trainSequenceModel(
  sequences: SequenceSample[],
  norm: MetricNormStats,
  windowSize: number
): SequencePseudoRnnArtifact | null {
  if (sequences.length < SEQUENCE_MIN_SEQUENCES) {
    return null;
  }

  const rng = mulberry32(INIT_SEED ^ SEQUENCE_PIPELINE_VERSION ^ windowSize ^ sequences.length);
  const hidden = SEQUENCE_HIDDEN_DIM;
  const inputDim = SEQUENCE_INPUT_DIM;
  const scale = 0.08;

  const W_x = initMatrix(hidden, inputDim, rng, scale);
  const W_h = initMatrix(hidden, hidden, rng, scale);
  const b_h = initMatrix(hidden, 1, rng, scale * 0.25);
  const v = initMatrix(hidden, 1, rng, scale);
  let b_y = (rng() * 2 - 1) * scale;

  const lr = SEQUENCE_LEARNING_RATE;
  const epochs = SEQUENCE_EPOCHS;

  for (let e = 0; e < epochs; e++) {
    const accDWx = zeros(hidden, inputDim);
    const accDWh = zeros(hidden, hidden);
    const accDbh = zeros(hidden, 1);
    const accDv = zeros(hidden, 1);
    let accDby = 0;

    for (const seq of sequences) {
      const targetNorm = normalizeMetricRow(seq.target, norm).conversion;
      const { yHatNorm, xs, hs } = forwardOneSequence(seq.input, W_x, W_h, b_h, v, b_y, norm);
      const { dW_x, dW_h, db_h, dv, db_y } = backwardOneSequence(targetNorm, yHatNorm, xs, hs, W_h, v);
    accDWx.add(dW_x);
    accDWh.add(dW_h);
    accDbh.add(db_h);
    accDv.add(dv);
    accDby += db_y;
    }

    const inv = 1 / sequences.length;
    const gWx = accDWx.clone().mul(inv);
    const gWh = accDWh.clone().mul(inv);
    const gBh = accDbh.clone().mul(inv);
    const gV = accDv.clone().mul(inv);
    let gBy = accDby * inv;
    gBy = Math.max(-2, Math.min(2, gBy));

    clipMatrixNorm(gWx, 2);
    clipMatrixNorm(gWh, 2);
    clipMatrixNorm(gBh, 2);
    clipMatrixNorm(gV, 2);

    W_x.sub(gWx.clone().mul(lr));
    W_h.sub(gWh.clone().mul(lr));
    b_h.sub(gBh.clone().mul(lr));
    v.sub(gV.clone().mul(lr));
    b_y -= gBy * lr;
  }

  return {
    kind: "sequence_pseudo_rnn",
    version: SEQUENCE_PIPELINE_VERSION,
    seedLabel: SEQUENCE_SEED_LABEL,
    windowSize,
    hiddenDim: hidden,
    inputDim,
    W_x: W_x.to2DArray(),
    W_h: W_h.to2DArray(),
    b_h: b_h.to2DArray(),
    v: v.to2DArray(),
    b_y,
    norm,
    trainedAt: Date.now(),
    nSequences: sequences.length,
    nEpochs: epochs,
  };
}

/**
 * Forward pass only; returns predicted **denormalized** conversion.
 */
export function predictNextStepConversion(input: MetricRow[], artifact: SequencePseudoRnnArtifact): number | null {
  if (!input.length || input.length !== artifact.windowSize) {
    return null;
  }
  const W_x = new Matrix(artifact.W_x);
  const W_h = new Matrix(artifact.W_h);
  const b_h = new Matrix(artifact.b_h);
  const v = new Matrix(artifact.v);
  const { yHatNorm } = forwardOneSequence(input, W_x, W_h, b_h, v, artifact.b_y, artifact.norm);
  return denormConversion(yHatNorm, artifact.norm);
}
