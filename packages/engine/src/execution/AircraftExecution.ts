import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef, zTile } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { PathFinding } from "../pathfinding/PathFinder";
import { PathStatus, SteppingPathFinder } from "../pathfinding/types";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import {
  airPathFinderState,
  AirPathFinderSchema,
  restoreAirPathFinder,
} from "../snapshot/PathfinderSnapshots";
import type { ExecRecord, SnapshotReader, SnapshotWriter } from "../snapshot/SnapshotContext";
import { NukeExecution } from "./NukeExecution";

export type AircraftCommand = "launch" | "aim" | "return" | "drop";

/**
 * Server-authoritative aircraft controller attached to each completed base.
 * A sortie is limited to ten seconds of cursor-following, then the jet returns.
 */
export class AircraftExecution implements Execution {
  private mg!: Game;
  private active = true;
  private jet: Unit | null = null;
  private target: TileRef | null = null;
  private mode: "idle" | "outbound" | "following" | "returning" = "idle";
  private lastLaunchTick = -3600;
  private followUntil = 0;
  private pathFinder: SteppingPathFinder<TileRef> | null = null;

  constructor(private base: Unit) {}

  owns(base: Unit): boolean { return this.base === base; }

  command(action: AircraftCommand, target?: TileRef): boolean {
    if (!this.base.isActive() || this.base.isUnderConstruction()) return false;
    if (action === "launch") {
      if (this.mode !== "idle" || this.mg.ticks() - this.lastLaunchTick < 3600) return false;
      if (target === undefined || !this.mg.isValidRef(target)) return false;
      this.jet = this.base.owner().buildUnit(UnitType.Jet, this.base.tile(), {});
      this.lastLaunchTick = this.mg.ticks();
      this.target = target;
      this.mode = "outbound";
      this.pathFinder = PathFinding.Air(this.mg);
      this.jet.touch();
      return true;
    }
    if (!this.jet || !this.jet.isActive()) return false;
    if (action === "aim") {
      if (target === undefined || !this.mg.isValidRef(target) || this.mode !== "following") return false;
      this.target = target;
      this.pathFinder?.invalidate();
      return true;
    }
    if (action === "return") {
      this.target = this.base.tile();
      this.mode = "returning";
      this.pathFinder?.invalidate();
      return true;
    }
    if (action === "drop") {
      if (target === undefined || !this.mg.isValidRef(target) || this.mode === "returning") return false;
      this.mg.addExecution(new NukeExecution(UnitType.AtomBomb, this.base.owner(), target, this.jet.tile()));
      this.target = this.base.tile();
      this.mode = "returning";
      this.pathFinder?.invalidate();
      return true;
    }
    return false;
  }

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.base.isActive()) {
      if (this.jet?.isActive()) this.jet.delete(false);
      this.active = false;
      return;
    }
    if (!this.jet) return;
    if (!this.jet.isActive()) {
      this.jet = null;
      this.mode = "idle";
      this.target = null;
      this.pathFinder = null;
      return;
    }
    if (this.mode === "following" && this.mg.ticks() >= this.followUntil) {
      this.target = this.base.tile();
      this.mode = "returning";
      this.pathFinder?.invalidate();
    }
    if (this.target === null || !this.pathFinder) return;
    if (this.mode === "outbound") {
      this.mode = "following";
      this.followUntil = this.mg.ticks() + 300;
    }
    const result = this.pathFinder.next(this.jet.tile(), this.target, 1);
    if (result.status === PathStatus.NEXT) {
      this.jet.move(result.node);
    } else if (result.status === PathStatus.COMPLETE) {
      if (this.mode === "returning") {
        this.jet.delete(false);
        this.jet = null;
        this.target = null;
        this.mode = "idle";
        this.pathFinder = null;
      }
    }
  }

  isActive(): boolean { return this.active; }
  activeDuringSpawnPhase(): boolean { return false; }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AircraftExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      base: w.unit(this.base),
      jet: w.unitOrNull(this.jet),
      target: this.target,
      mode: this.mode,
      lastLaunchTick: this.lastLaunchTick,
      followUntil: this.followUntil,
      pathFinder: this.pathFinder ? airPathFinderState(this.pathFinder) : null,
    });
  }

  restoreSnapshot(s: AircraftState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.base = r.unit(s.base);
    this.jet = r.unitOrNull(s.jet);
    this.target = s.target;
    this.mode = s.mode;
    this.lastLaunchTick = s.lastLaunchTick;
    this.followUntil = s.followUntil;
    this.pathFinder = s.pathFinder ? restoreAirPathFinder(r.game, s.pathFinder) : null;
  }
}

const AircraftStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  base: zRef(),
  jet: zRef().nullable(),
  target: zTile().nullable(),
  mode: z.enum(["idle", "outbound", "following", "returning"]),
  lastLaunchTick: zInt(),
  followUntil: zInt(),
  pathFinder: AirPathFinderSchema.nullable(),
});
type AircraftState = z.infer<typeof AircraftStateSchema>;

export const AircraftExecutionSnapshot = execSnapshotType({
  name: "Aircraft",
  version: 1,
  schema: AircraftStateSchema,
  cls: () => AircraftExecution,
});
