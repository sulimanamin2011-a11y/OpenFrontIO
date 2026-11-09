import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { ShellExecution } from "./ShellExecution";

/**
 * DOMINION Castle stronghold: a completed castle automatically protects
 * nearby territory by firing on hostile transport ships and warships.
 * Combat state is snapshot-backed so the defense survives reconnects.
 */
export class CastleExecution implements Execution {
  private mg!: Game;
  private active = true;
  private target: Unit | null = null;
  private lastShellAttack = 0;

  constructor(private castle: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  private shoot(): void {
    if (this.target === null) return;
    if (this.mg.ticks() - this.lastShellAttack <= 80) return;

    this.lastShellAttack = this.mg.ticks();
    this.mg.addExecution(
      new ShellExecution(
        this.castle.tile(),
        this.castle.owner(),
        this.castle,
        this.target,
      ),
    );
  }

  tick(_ticks: number): void {
    if (!this.castle.isActive()) {
      this.active = false;
      return;
    }
    if (this.castle.isUnderConstruction()) return;
    if (this.target !== null && !this.target.isActive()) this.target = null;

    const hostiles = this.mg
      .nearbyUnits(this.castle.tile(), 35, [
        UnitType.TransportShip,
        UnitType.Warship,
      ])
      .filter(
        ({ unit }) =>
          unit.owner() !== this.castle.owner() &&
          !unit.owner().isFriendly(this.castle.owner()),
      );

    this.target =
      hostiles.sort((a, b) => a.distSquared - b.distSquared)[0]?.unit ?? null;
    if (this.target === null || !this.target.isActive()) {
      this.target = null;
      return;
    }
    this.shoot();
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CastleExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      castle: w.unit(this.castle),
      target: w.unitOrNull(this.target),
      lastShellAttack: this.lastShellAttack,
    });
  }

  restoreSnapshot(state: CastleState, r: SnapshotReader): void {
    this.active = state.active;
    if (state.initialized) this.mg = r.game;
    this.castle = r.unit(state.castle);
    this.target = r.unitOrNull(state.target);
    this.lastShellAttack = state.lastShellAttack;
  }
}

const CastleStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  castle: zRef(),
  target: zRef().nullable(),
  lastShellAttack: zInt(),
});
type CastleState = z.infer<typeof CastleStateSchema>;

export const CastleExecutionSnapshot = execSnapshotType({
  name: "Castle",
  version: 1,
  schema: CastleStateSchema,
  cls: () => CastleExecution,
});
