import type { Direction } from '@flipfeeds/shared';

interface PredictionInput {
  seq: number;
  x: number;
  y: number;
  dir: Direction;
  anim?: string;
  timestamp: number;
}

export class PredictionManager {
  private inputBuffer: PredictionInput[] = [];
  private seq = 0;
  private lastAckedSeq = -1;

  // Server-authoritative position (updated on each sync)
  private serverX = 0;
  private serverY = 0;

  // Predicted position (what the player sees)
  private predictedX = 0;
  private predictedY = 0;

  // Telemetry
  private lastPredictionError = 0;

  /** Initialize with starting position. */
  init(x: number, y: number): void {
    this.serverX = x;
    this.serverY = y;
    this.predictedX = x;
    this.predictedY = y;
    this.inputBuffer = [];
    this.seq = 0;
    this.lastAckedSeq = -1;
  }

  /** Record a local input and return the seq number for the server message. */
  recordInput(x: number, y: number, dir: Direction, anim?: string): number {
    this.seq++;
    this.inputBuffer.push({
      seq: this.seq,
      x,
      y,
      dir,
      anim,
      timestamp: performance.now(),
    });

    // Update predicted position
    this.predictedX = x;
    this.predictedY = y;

    // Keep buffer bounded (shouldn't grow beyond ~60 inputs = 1 second at 60fps)
    if (this.inputBuffer.length > 120) {
      this.inputBuffer = this.inputBuffer.slice(-60);
    }

    return this.seq;
  }

  /**
   * Reconcile with server state. Called when we receive a sync message with our ack.
   * Returns the corrected position.
   */
  reconcile(
    serverX: number,
    serverY: number,
    ack: number,
  ): { x: number; y: number; predictionError: number } {
    this.serverX = serverX;
    this.serverY = serverY;
    this.lastAckedSeq = ack;

    // Discard all inputs that the server has acknowledged
    this.inputBuffer = this.inputBuffer.filter((input) => input.seq > ack);

    // Replay unacknowledged inputs on top of server position
    if (this.inputBuffer.length > 0) {
      // Calculate prediction error: distance between where we predicted
      // and where the server says we are
      const dx = this.predictedX - serverX;
      const dy = this.predictedY - serverY;
      this.lastPredictionError = Math.sqrt(dx * dx + dy * dy);

      // Use the latest unacked input position as the predicted position
      // (In a more sophisticated system, we'd re-simulate physics)
      const latest = this.inputBuffer[this.inputBuffer.length - 1];
      this.predictedX = latest.x;
      this.predictedY = latest.y;
    } else {
      // No unacked inputs — server position is truth, zero prediction error
      this.lastPredictionError = 0;
      this.predictedX = serverX;
      this.predictedY = serverY;
    }

    return {
      x: this.predictedX,
      y: this.predictedY,
      predictionError: this.lastPredictionError,
    };
  }

  /** Get the current sequence number. */
  get currentSeq(): number {
    return this.seq;
  }

  /** Get the last prediction error (px). */
  get predictionError(): number {
    return this.lastPredictionError;
  }

  /** Get the number of unacknowledged inputs. */
  get pendingInputs(): number {
    return this.inputBuffer.length;
  }

  /** Clean up. */
  destroy(): void {
    this.inputBuffer = [];
  }
}
