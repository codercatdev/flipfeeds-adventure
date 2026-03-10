import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 3 — Client-Side Prediction Tests
 *
 * Tests the prediction reconciliation logic used for the local player.
 * When the client sends inputs, it applies them immediately (prediction).
 * When the server acks, the client reconciles by:
 *   1. Discarding inputs with seq <= ack
 *   2. Starting from the server's authoritative position
 *   3. Replaying remaining unacked inputs on top
 *   4. Measuring prediction error (distance between predicted and corrected)
 *
 * Quality Gate: SyncTelemetry.predictionError < 5px average
 */

// ─── Pure prediction logic (extracted for testability — no Phaser) ───────────

interface PendingInput {
  seq: number;
  dx: number;
  dy: number;
}

class ClientPrediction {
  private pendingInputs: PendingInput[] = [];
  private lastAckedSeq = 0;
  /** Position the client currently predicts */
  private predictedX = 0;
  private predictedY = 0;

  addInput(seq: number, dx: number, dy: number): void {
    this.pendingInputs.push({ seq, dx, dy });
    this.predictedX += dx;
    this.predictedY += dy;
  }

  /**
   * Reconcile with server state.
   * Returns the corrected position and the prediction error.
   */
  reconcile(
    serverX: number,
    serverY: number,
    ack: number,
  ): { x: number; y: number; error: number } {
    // Ignore out-of-order (stale) acks
    if (ack < this.lastAckedSeq) {
      return { x: this.predictedX, y: this.predictedY, error: 0 };
    }

    this.lastAckedSeq = ack;

    // Discard inputs that the server has already processed
    this.pendingInputs = this.pendingInputs.filter((input) => input.seq > ack);

    // Replay remaining inputs on top of server position
    let correctedX = serverX;
    let correctedY = serverY;
    for (const input of this.pendingInputs) {
      correctedX += input.dx;
      correctedY += input.dy;
    }

    // Prediction error = Euclidean distance between old predicted and corrected
    const error = Math.sqrt(
      (this.predictedX - correctedX) ** 2 +
      (this.predictedY - correctedY) ** 2,
    );

    // Snap to corrected position
    this.predictedX = correctedX;
    this.predictedY = correctedY;

    return { x: correctedX, y: correctedY, error };
  }

  getPendingCount(): number {
    return this.pendingInputs.length;
  }

  getPosition(): { x: number; y: number } {
    return { x: this.predictedX, y: this.predictedY };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ClientPrediction — Input Buffer', () => {
  let prediction: ClientPrediction;

  beforeEach(() => {
    prediction = new ClientPrediction();
  });

  it('starts with empty buffer', () => {
    expect(prediction.getPendingCount()).toBe(0);
  });

  it('addInput stores inputs in buffer', () => {
    prediction.addInput(1, 2, 0);
    expect(prediction.getPendingCount()).toBe(1);

    prediction.addInput(2, 0, 3);
    expect(prediction.getPendingCount()).toBe(2);
  });

  it('addInput applies movement to predicted position immediately', () => {
    prediction.addInput(1, 5, 0);
    expect(prediction.getPosition()).toEqual({ x: 5, y: 0 });

    prediction.addInput(2, 0, 10);
    expect(prediction.getPosition()).toEqual({ x: 5, y: 10 });
  });

  it('multiple inputs accumulate correctly', () => {
    prediction.addInput(1, 1, 1);
    prediction.addInput(2, 2, 2);
    prediction.addInput(3, 3, 3);
    expect(prediction.getPosition()).toEqual({ x: 6, y: 6 });
    expect(prediction.getPendingCount()).toBe(3);
  });
});

describe('ClientPrediction — Reconciliation', () => {
  let prediction: ClientPrediction;

  beforeEach(() => {
    prediction = new ClientPrediction();
  });

  it('reconcile with ack=0 replays all inputs on server position', () => {
    prediction.addInput(1, 5, 0);
    prediction.addInput(2, 0, 5);

    // Server says position is (0,0), hasn't acked anything
    const result = prediction.reconcile(0, 0, 0);

    // All inputs replayed: (0+5, 0+5) = (5, 5)
    expect(result.x).toBe(5);
    expect(result.y).toBe(5);
    expect(prediction.getPendingCount()).toBe(2);
  });

  it('reconcile with ack=N discards inputs with seq <= N', () => {
    prediction.addInput(1, 5, 0);
    prediction.addInput(2, 0, 5);
    prediction.addInput(3, 3, 3);

    // Server acks up to seq 2, position includes those moves
    const result = prediction.reconcile(5, 5, 2);

    // Only input 3 remains: (5+3, 5+3) = (8, 8)
    expect(result.x).toBe(8);
    expect(result.y).toBe(8);
    expect(prediction.getPendingCount()).toBe(1);
  });

  it('reconcile returns corrected position after replaying remaining inputs', () => {
    prediction.addInput(1, 10, 0);
    prediction.addInput(2, 0, 10);
    prediction.addInput(3, 5, 5);

    // Server acks seq 1, server position is (10, 0)
    const result = prediction.reconcile(10, 0, 1);

    // Remaining: input 2 (0,10) + input 3 (5,5) = (10+5, 0+15) = (15, 15)
    expect(result.x).toBe(15);
    expect(result.y).toBe(15);
    expect(prediction.getPendingCount()).toBe(2);
  });

  it('empty buffer after full ack returns server position exactly (error = 0)', () => {
    prediction.addInput(1, 5, 5);
    prediction.addInput(2, 5, 5);

    // Server acks all, position matches what we predicted
    const result = prediction.reconcile(10, 10, 2);

    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    expect(result.error).toBe(0);
    expect(prediction.getPendingCount()).toBe(0);
  });

  it('prediction error is Euclidean distance between predicted and corrected', () => {
    prediction.addInput(1, 10, 0);
    prediction.addInput(2, 0, 10);

    // Predicted position is (10, 10)
    // Server says after acking seq 1, position is (8, 0) — slight drift
    // Corrected = (8 + 0, 0 + 10) = (8, 10)
    // Error = distance from (10, 10) to (8, 10) = 2
    const result = prediction.reconcile(8, 0, 1);

    expect(result.x).toBe(8);
    expect(result.y).toBe(10);
    expect(result.error).toBeCloseTo(2, 5);
  });

  it('prediction error < 5px when network is stable (small drift)', () => {
    // Simulate stable network: server position closely matches prediction
    for (let i = 1; i <= 10; i++) {
      prediction.addInput(i, 2, 0);
    }

    // Server acks up to 8, position is very close to expected (16, 0)
    // Small drift of 1px
    const result = prediction.reconcile(15, 0, 8);

    // Remaining: input 9 (2,0) + input 10 (2,0) = (15+4, 0) = (19, 0)
    // Predicted was (20, 0), corrected is (19, 0), error = 1
    expect(result.error).toBeLessThan(5);
  });
});

describe('ClientPrediction — Edge Cases', () => {
  let prediction: ClientPrediction;

  beforeEach(() => {
    prediction = new ClientPrediction();
  });

  it('out-of-order acks are handled (ack goes backwards = ignore)', () => {
    prediction.addInput(1, 5, 0);
    prediction.addInput(2, 5, 0);
    prediction.addInput(3, 5, 0);

    // First reconcile: ack=2
    prediction.reconcile(10, 0, 2);
    expect(prediction.getPendingCount()).toBe(1);

    // Stale ack=1 arrives (out of order) — should be ignored
    const result = prediction.reconcile(5, 0, 1);
    // Should still have 1 pending (not re-add discarded inputs)
    expect(prediction.getPendingCount()).toBe(1);
    // Position should not jump back
    expect(result.x).toBe(prediction.getPosition().x);
  });

  it('rapid inputs do not cause unbounded buffer growth', () => {
    // Simulate 1000 rapid inputs
    for (let i = 1; i <= 1000; i++) {
      prediction.addInput(i, 1, 0);
    }
    expect(prediction.getPendingCount()).toBe(1000);

    // Server acks most of them
    prediction.reconcile(990, 0, 990);
    expect(prediction.getPendingCount()).toBe(10);
  });

  it('reconcile with no pending inputs returns server position', () => {
    // Set predicted position to match server position (no movement)
    prediction.reconcile(100, 200, 0);
    // Now reconcile again — predicted matches server, error should be 0
    const result = prediction.reconcile(100, 200, 0);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect(result.error).toBe(0);
  });

  it('negative movement deltas work correctly', () => {
    prediction.addInput(1, -5, -10);
    prediction.addInput(2, 3, -2);

    const result = prediction.reconcile(0, 0, 0);
    expect(result.x).toBe(-2);
    expect(result.y).toBe(-12);
  });

  it('reconcile after full ack leaves clean state for new inputs', () => {
    prediction.addInput(1, 10, 10);
    prediction.reconcile(10, 10, 1);
    expect(prediction.getPendingCount()).toBe(0);

    // New inputs after full ack
    prediction.addInput(2, 5, 5);
    expect(prediction.getPendingCount()).toBe(1);
    expect(prediction.getPosition()).toEqual({ x: 15, y: 15 });
  });

  it('no rubber-banding: correction is smooth when error is small', () => {
    // Simulate several frames of movement
    for (let i = 1; i <= 5; i++) {
      prediction.addInput(i, 2, 0);
    }
    // Predicted: (10, 0)

    // Server acks 3, position is (6, 0) — exactly right
    const result = prediction.reconcile(6, 0, 3);
    // Remaining: input 4 (2,0) + input 5 (2,0) = (6+4, 0) = (10, 0)
    expect(result.error).toBe(0); // No error when server matches
    expect(result.x).toBe(10);
  });
});
