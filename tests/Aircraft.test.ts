import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AircraftExecution } from "@openfront/engine/execution/AircraftExecution";
import { AircraftCommandExecution } from "@openfront/engine/execution/AircraftCommandExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player: Player;
let opponent: Player;

describe("Aircraft", () => {
  beforeEach(async () => {
    game = await setup(
      "plains",
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

  test("launches a jet, accepts a bomb drop, and returns to its base", () => {
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

  test("accepts cursor guidance immediately after launch", () => {
    const baseTile = game.ref(4, 10);
    const firstTarget = game.ref(10, 10);
    const updatedTarget = game.ref(12, 10);
    player.conquer(baseTile);
    const base = player.buildUnit(UnitType.AircraftBase, baseTile, {});
    const aircraft = new AircraftExecution(base);
    game.addExecution(aircraft);
    executeTicks(game, 1);

    expect(aircraft.command("launch", firstTarget)).toBe(true);
    executeTicks(game, 1);
    const guidanceDeadline = (aircraft as any).followUntil;

    expect(aircraft.command("aim", updatedTarget)).toBe(true);
    expect((aircraft as any).target).toBe(updatedTarget);
    // Cursor updates must not extend the original ten-second guidance window.
    expect((aircraft as any).followUntil).toBe(guidanceDeadline);
  });

  test("allows only one aircraft base while keeping its upgrades available", () => {
    const baseTile = game.ref(4, 10);
    const secondTile = game.ref(8, 10);
    player.conquer(baseTile);
    player.conquer(secondTile);
    const base = player.buildUnit(UnitType.AircraftBase, baseTile, {});

    const secondPlacement = player.buildableUnits(secondTile, [
      UnitType.AircraftBase,
    ])[0];
    expect(secondPlacement.canBuild).toBe(false);

    const baseUpgrade = player.buildableUnits(baseTile, [
      UnitType.AircraftBase,
    ])[0];
    expect(baseUpgrade.canUpgrade).toBe(base.id());
    expect(baseUpgrade.cost).toBe(500_000n);
  });

  test("routes multiplayer launch commands to the player's aircraft controller", () => {
    const baseTile = game.ref(4, 10);
    player.conquer(baseTile);
    const base = player.buildUnit(UnitType.AircraftBase, baseTile, {});
    game.addExecution(new AircraftExecution(base));
    executeTicks(game, 1);

    game.addExecution(
      new AircraftCommandExecution(player, "launch", game.ref(12, 10)),
    );
    executeTicks(game, 1);

    expect(player.units(UnitType.Jet)).toHaveLength(1);
  });

  test("an aircraft command cannot control another player's base", () => {
    const baseTile = game.ref(40, 40);
    opponent.conquer(baseTile);
    const base = opponent.buildUnit(UnitType.AircraftBase, baseTile, {});
    game.addExecution(new AircraftExecution(base));
    executeTicks(game, 1);

    game.addExecution(
      new AircraftCommandExecution(player, "launch", game.ref(45, 40)),
    );
    executeTicks(game, 1);

    expect(opponent.units(UnitType.Jet)).toHaveLength(0);
    expect(player.units(UnitType.Jet)).toHaveLength(0);
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

  test("automatically returns after the ten-second cursor-guidance window", () => {
    const baseTile = game.ref(4, 10);
    player.conquer(baseTile);
    const base = player.buildUnit(UnitType.AircraftBase, baseTile, {});
    const aircraft = new AircraftExecution(base);
    game.addExecution(aircraft);
    executeTicks(game, 1);

    expect(aircraft.command("launch", game.ref(20, 10))).toBe(true);
    executeTicks(game, 125);

    expect(player.units(UnitType.Jet)).toHaveLength(0);
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

    expect(f20Controller.command("launch", game.ref(20, 10))).toBe(true);
    expect(f22Controller.command("launch", game.ref(25, 10))).toBe(true);
    expect(player.units(UnitType.F20)).toHaveLength(1);
    expect(opponent.units(UnitType.F22)).toHaveLength(1);
    executeTicks(game, 1);
    expect(
      game.manhattanDist(firstTile, player.units(UnitType.F20)[0].tile()),
    ).toBe(2);
    expect(
      game.manhattanDist(secondTile, opponent.units(UnitType.F22)[0].tile()),
    ).toBe(3);
  });

  test("Silver SAM launchers cannot intercept aircraft", () => {
    const samTile = game.ref(4, 10);
    const jetTile = game.ref(7, 10);
    player.conquer(samTile);
    opponent.conquer(jetTile);
    const sam = player.buildUnit(UnitType.SAMLauncher, samTile, {});
    const jet = opponent.buildUnit(UnitType.Jet, jetTile, {});
    game.addExecution(new SAMLauncherExecution(player, null, sam));

    executeTicks(game, 2);

    expect(sam.level()).toBe(1);
    expect(jet.isActive()).toBe(true);
  });

  test("Gold SAM launchers ignore allied aircraft", () => {
    const samTile = game.ref(4, 10);
    const jetTile = game.ref(7, 10);
    player.conquer(samTile);
    opponent.conquer(jetTile);
    const sam = player.buildUnit(UnitType.SAMLauncher, samTile, {});
    player.upgradeUnit(sam);
    const jet = opponent.buildUnit(UnitType.Jet, jetTile, {});
    vi.spyOn(player, "isFriendly").mockReturnValue(true);
    game.addExecution(new SAMLauncherExecution(player, null, sam));

    executeTicks(game, 2);

    expect(jet.isActive()).toBe(true);
    expect(sam.missileTimerQueue()).toHaveLength(0);
  });
  test.each([UnitType.Jet, UnitType.F20, UnitType.F22])(
    "Gold SAM launchers intercept %s aircraft",
    (aircraftType) => {
      const samTile = game.ref(4, 10);
      const aircraftTile = game.ref(7, 10);
      player.conquer(samTile);
      opponent.conquer(aircraftTile);
      const sam = player.buildUnit(UnitType.SAMLauncher, samTile, {});
      player.upgradeUnit(sam);
      const aircraft = opponent.buildUnit(aircraftType, aircraftTile, {});
      game.addExecution(new SAMLauncherExecution(player, null, sam));

      executeTicks(game, 2);

      expect(aircraft.isActive()).toBe(false);
    },
  );
  test("Gold SAM launchers destroy enemy jets within range", () => {
    const samTile = game.ref(4, 10);
    const jetTile = game.ref(7, 10);
    player.conquer(samTile);
    opponent.conquer(jetTile);
    const sam = player.buildUnit(UnitType.SAMLauncher, samTile, {});
    player.upgradeUnit(sam);
    const jet = opponent.buildUnit(UnitType.Jet, jetTile, {});
    game.addExecution(new SAMLauncherExecution(player, null, sam));

    // First tick initializes the launcher; the next tick performs interception.
    executeTicks(game, 2);

    expect(sam.level()).toBe(2);
    expect(jet.isActive()).toBe(false);
  });
});
