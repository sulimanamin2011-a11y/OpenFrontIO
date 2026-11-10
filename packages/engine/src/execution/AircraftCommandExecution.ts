import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zPlayerRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { AircraftExecution } from "./AircraftExecution";
import type { AircraftCommand } from "./AircraftExecution";

export class AircraftCommandExecution implements Execution {
  constructor(
    private player: Player,
    private action: AircraftCommand,
    private target?: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    const base = this.player
      .units()
      .find(
        (unit) =>
          unit.type() === UnitType.AircraftBase && unit.isActive(),
      );
    if (!base) return;
    const controller = mg.executions().find(
      (execution): execution is AircraftExecution =>
        execution instanceof AircraftExecution &&
        execution.owns(base) &&
        execution.isReady(),
    );
    controller?.command(this.action, this.target);
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AircraftCommandExecutionSnapshot.write({
      player: w.player(this.player),
      action: this.action,
      target: this.target ?? null,
    });
  }

  restoreSnapshot(s: AircraftCommandState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.action = s.action;
    this.target = s.target ?? undefined;
  }
}

const AircraftCommandStateSchema = z.object({
  player: zPlayerRef(),
  action: z.enum(["launch", "aim", "return", "drop"]),
  target: zTile().nullable(),
});
type AircraftCommandState = z.infer<typeof AircraftCommandStateSchema>;

export const AircraftCommandExecutionSnapshot = execSnapshotType({
  name: "AircraftCommand",
  version: 1,
  schema: AircraftCommandStateSchema,
  cls: () => AircraftCommandExecution,
});
