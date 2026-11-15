// Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2013): one
// rating-period update for one player. The only implementation of the math
// in the repo (agent/skills/ratings-engine). Pure: no rounding, no I/O.
// Values in and out are on the Glicko scale (rating ~1500, RD in rating
// points); the Glicko-2 scale conversion happens inside.

/** Glicko-2 scale factor: 400 / ln(10). */
export const GLICKO2_SCALE = 173.7178;
/** System constant τ: how much volatility may move per period. */
export const TAU = 0.5;
/** Convergence tolerance of the volatility iteration. */
export const EPSILON = 0.000001;

export type Glicko2Rating = {
  rating: number;
  /** Rating deviation (RD). */
  deviation: number;
  /** σ. */
  volatility: number;
};

export type Glicko2Game = {
  /** Opponent's rating and RD before this period. */
  opponentRating: number;
  opponentDeviation: number;
  /** 1 win, 0 loss (0.5 draw, unused by pickleball). */
  score: number;
};

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/**
 * The player's rating after one rating period with these games. With no
 * games only the RD grows (step 6 of the paper).
 */
export function glicko2Update(player: Glicko2Rating, games: readonly Glicko2Game[], tau = TAU): Glicko2Rating {
  // Step 2: to the Glicko-2 scale.
  const mu = (player.rating - 1500) / GLICKO2_SCALE;
  const phi = player.deviation / GLICKO2_SCALE;
  const sigma = player.volatility;

  if (games.length === 0) {
    return { ...player, deviation: Math.sqrt(phi * phi + sigma * sigma) * GLICKO2_SCALE };
  }

  // Steps 3–4: estimated variance v and improvement Δ.
  let vInverse = 0;
  let improvementSum = 0;
  for (const game of games) {
    const muJ = (game.opponentRating - 1500) / GLICKO2_SCALE;
    const gJ = g(game.opponentDeviation / GLICKO2_SCALE);
    const expected = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
    vInverse += gJ * gJ * expected * (1 - expected);
    improvementSum += gJ * (game.score - expected);
  }
  const v = 1 / vInverse;
  const delta = v * improvementSum;

  // Step 5: new volatility σ' (Illinois algorithm).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  // Steps 6–7: new RD and rating.
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * improvementSum;

  // Step 8: back to the Glicko scale.
  return {
    rating: GLICKO2_SCALE * newMu + 1500,
    deviation: GLICKO2_SCALE * newPhi,
    volatility: newSigma,
  };
}
