import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AircraftExecution } from "@openfront/engine/execution/AircraftExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let opponent: Player;

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
    opponent = game.player("opponent_id");
    executeTicks(game, 50);
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
    executeTicks(game, 1_195);
    expect(aircraft.command("launch", game.ref(6, 10))).toBe(true);
  });


  test("upgraded bases launch F-20 and F-22 aircraft", () => {
    const firstTile = game.ref(4, 10);
    const secondTile = game.ref(6, 10);
    player.conquer(firstTile);
    opponent.conquer(secondTile);
    const f20Base = player.buildUnit(UnitType.AircraftBase, firstTile, {});
    const f22Base = opponent.buildUnit(UnitType.AircraftBase, secondTile, {});
    player.upgradeUnit(f20Base);
    opponent.upgradeUnit(f22Base);
    opponent.upgradeUnit(f22Base);
    const f20Controller = new AircraftExecution(f20Base);
    const f22Controller = new AircraftExecution(f22Base);
    game.addExecution(f20Controller, f22Controller);
    executeTicks(game, 1);

    expect(f20Controller.command("launch", game.ref(5, 10))).toBe(true);
    expect(f22Controller.command("launch", game.ref(7, 10))).toBe(true);
    expect(player.units(UnitType.F20)).toHaveLength(1);
    expect(opponent.units(UnitType.F22)).toHaveLength(1);
  });

  test("Gold SAM launchers destroy enemy jets within range", () => {
    const samTile = game.ref(4, 10);
    const jetTile = game.ref(7, 10);
    player.conquer(samTile);
    opponent.conquer(jetTile);
    const sam = player.buildUnit(UnitType.SAMLauncher, samTile, {});
    player.upgradeUnit(sam);
    const jet = opponent.buildUnit(UnitType.Jet, jetTile, {});
    game.addExecution(new SAMLauncherExecution(player, null, sam));

    executeTicks(game, 1);

    expect(sam.level()).toBe(2);
    expect(jet.isActive()).toBe(false);
  });
});
