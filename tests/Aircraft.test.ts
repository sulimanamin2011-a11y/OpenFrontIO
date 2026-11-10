import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AircraftExecution } from "@openfront/engine/execution/AircraftExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;

describe("Aircraft", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("pilot", PlayerType.Human, null, "pilot_id"),
        new PlayerInfo("opponent", PlayerType.Human, null, "opponent_id"),
      ],
    );
    player = game.player("pilot_id");
  });

  test("launches a visible jet, accepts a bomb drop, and returns to its base", () => {
    const baseTile = game.ref(4, 10);
    const targetTile = game.ref(8, 10);
    player.conquer(baseTile);
    const base = player.buildUnit(UnitType.AircraftBase, baseTile, {});
    const aircraft = new AircraftExecution(base);
    game.addExecution(aircraft);
    executeTicks(game, 1);

    expect(aircraft.command("launch", targetTile)).toBe(true);
    const jet = player.units(UnitType.Jet)[0];
    expect(jet).toBeDefined();

    executeTicks(game, 2);
    expect(jet.tile()).not.toBe(baseTile);

    expect(aircraft.command("drop", targetTile)).toBe(true);
    expect(
      game
        .executions()
        .some((execution) => execution instanceof NukeExecution),
    ).toBe(true);
    expect(aircraft.command("return")).toBe(true);
  });

  test("enforces the two-minute launch cooldown after a sortie begins", () => {
    const baseTile = game.ref(4, 10);
    player.conquer(baseTile);
    const base = player.buildUnit(UnitType.AircraftBase, baseTile, {});
    const aircraft = new AircraftExecution(base);
    game.addExecution(aircraft);
    executeTicks(game, 1);

    expect(aircraft.command("launch", game.ref(5, 10))).toBe(true);
    expect(aircraft.command("return")).toBe(true);
    executeTicks(game, 5);
    expect(player.units(UnitType.Jet)).toHaveLength(0);
    expect(aircraft.command("launch", game.ref(6, 10))).toBe(false);
  });
});
