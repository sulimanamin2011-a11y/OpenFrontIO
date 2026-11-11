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
import { TrainStationExecution } from "./TrainStationExecution";

export class CityExecution implements Execution {
  private mg: Game;
  private active: boolean = true;
  private stationCreated = false;
  private lastPassiveIncomeTick: number | undefined;
  private passiveIncomeLevel: number | undefined;

  constructor(private city: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.lastPassiveIncomeTick ??= ticks;
    this.passiveIncomeLevel ??= this.city.level();
  }

  tick(ticks: number): void {
    if (!this.stationCreated) {
      this.createStation();
      this.stationCreated = true;
    }
    if (!this.city.isActive()) {
      this.active = false;
      return;
    }
    if (this.city.isUnderConstruction()) {
      this.lastPassiveIncomeTick = ticks;
      this.passiveIncomeLevel = this.city.level();
      return;
    }

    // Restart the income timer when the city changes rank so each tier's
    // payout interval begins cleanly after the upgrade completes.
    if (this.city.level() !== this.passiveIncomeLevel) {
      this.passiveIncomeLevel = this.city.level();
      this.lastPassiveIncomeTick = ticks;
    }
    if (ticks - (this.lastPassiveIncomeTick ?? ticks) >= 300) {
      this.city.owner().addGold(
        this.mg.config().cityPassiveGold(this.city.level(), this.city.owner()),
        this.city.tile(),
      );
      this.lastPassiveIncomeTick = ticks;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private createStation(): void {
    const nearbyFactory = this.mg.hasUnitNearby(
      this.city.tile()!,
      this.mg.config().trainStationMaxRange(),
      UnitType.Factory,
    );
    if (nearbyFactory) {
      this.mg.addExecution(new TrainStationExecution(this.city));
    }
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CityExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      stationCreated: this.stationCreated,
      city: w.unit(this.city),
      lastPassiveIncomeTick: this.lastPassiveIncomeTick ?? null,
      passiveIncomeLevel: this.passiveIncomeLevel ?? null,
    });
  }

  restoreSnapshot(s: CityState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.stationCreated = s.stationCreated;
    this.city = r.unit(s.city);
    this.lastPassiveIncomeTick = s.lastPassiveIncomeTick ?? r.game.ticks();
    this.passiveIncomeLevel = s.passiveIncomeLevel ?? this.city.level();
  }
}

const CityStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  stationCreated: z.boolean(),
  city: zRef(),
  lastPassiveIncomeTick: zInt().nullable().optional(),
  passiveIncomeLevel: zInt().nullable().optional(),
});
type CityState = z.infer<typeof CityStateSchema>;

export const CityExecutionSnapshot = execSnapshotType({
  name: "City",
  version: 1,
  schema: CityStateSchema,
  cls: () => CityExecution,
});
