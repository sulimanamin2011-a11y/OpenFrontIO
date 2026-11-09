import type { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  GameType,
  MAX_UPGRADE_AMOUNT,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { UpgradeStructureExecution } from "@openfront/engine/execution/UpgradeStructureExecution";
import { describe, expect, it } from "vitest";
import { setup } from "../../util/Setup";

describe("UpgradeStructureExecution", () => {
  it("upgrades a structure the specified amount of times", async () => {
    const game = await setup(
      "ocean_and_land",
      { gameType: GameType.Singleplayer, instantBuild: true },
      [],
      undefined,
      undefined,
      false,
    );
    const playerInfo = new PlayerInfo(
      "player1",
      PlayerType.Human,
      null,
      "player1_id",
    );
    game.addPlayer(playerInfo);
    const player = game.player("player1_id")!;

    let landTile: TileRef | undefined = undefined;
    for (let y = 0; y < game.map().height(); y++) {
      for (let x = 0; x < game.map().width(); x++) {
        const t = game.ref(x, y);
        if (game.isLand(t)) {
          landTile = t;
          break;
        }
      }
      if (landTile !== undefined) break;
    }

    player.conquer(landTile!);
    const city = player.buildUnit(UnitType.City, landTile!, {});

    game.endSpawnPhase();

    player.addGold(10_000_000n);

    expect(city.level()).toBe(1);

    const execution = new UpgradeStructureExecution(player, city.id(), 5);
    game.addExecution(execution);
    game.executeNextTick();

    expect(city.level()).toBe(6);
  });

  it("stops upgrading early if player cannot afford remaining amounts", async () => {
    const game = await setup(
      "ocean_and_land",
      { gameType: GameType.Singleplayer, instantBuild: true },
      [],
      undefined,
      undefined,
      false,
    );
    const playerInfo = new PlayerInfo(
      "player1",
      PlayerType.Human,
      null,
      "player1_id",
    );
    game.addPlayer(playerInfo);
    const player = game.player("player1_id")!;

    let landTile: TileRef | undefined = undefined;
    for (let y = 0; y < game.map().height(); y++) {
      for (let x = 0; x < game.map().width(); x++) {
        const t = game.ref(x, y);
        if (game.isLand(t)) {
          landTile = t;
          break;
        }
      }
      if (landTile !== undefined) break;
    }

    player.conquer(landTile!);
    const city = player.buildUnit(UnitType.City, landTile!, {});

    game.endSpawnPhase();

    player.addGold(250_000n);

    expect(city.level()).toBe(1);

    const execution = new UpgradeStructureExecution(player, city.id(), 5);
    game.addExecution(execution);
    game.executeNextTick();

    expect(city.level()).toBe(2);
  });

  it("uses DOMINION silver and gold city upgrade prices", async () => {
    const game = await setup("ocean_and_land", { gameType: GameType.Singleplayer, instantBuild: true }, [], undefined, undefined, false);
    const playerInfo = new PlayerInfo("player1", PlayerType.Human, null, "player1_id");
    game.addPlayer(playerInfo);
    const player = game.player("player1_id")!;
    let landTile: TileRef | undefined;
    for (let y = 0; y < game.map().height() && landTile === undefined; y++) {
      for (let x = 0; x < game.map().width(); x++) {
        const tile = game.ref(x, y);
        if (game.isLand(tile)) { landTile = tile; break; }
      }
    }
    player.conquer(landTile!);
    const city = player.buildUnit(UnitType.City, landTile!, {});
    game.endSpawnPhase();
    player.addGold(1_000_000n);
    const firstUpgrade = player.buildableUnits(landTile!).find((unit) => unit.type === UnitType.City)!;
    expect(firstUpgrade.upgradeCosts![0]).toBe(250_000n);
    expect(firstUpgrade.upgradeCosts![1]).toBe(1_000_000n);
    game.addExecution(new UpgradeStructureExecution(player, city.id(), 2));
    game.executeNextTick();
    expect(city.level()).toBe(3);
  });

  it("advertised bulk upgrade totals match what is actually charged", async () => {
    const game = await setup(
      "ocean_and_land",
      { gameType: GameType.Singleplayer, instantBuild: true },
      [],
      undefined,
      undefined,
      false,
    );
    const playerInfo = new PlayerInfo(
      "player1",
      PlayerType.Human,
      null,
      "player1_id",
    );
    game.addPlayer(playerInfo);
    const player = game.player("player1_id")!;

    let landTile: TileRef | undefined = undefined;
    for (let y = 0; y < game.map().height(); y++) {
      for (let x = 0; x < game.map().width(); x++) {
        const t = game.ref(x, y);
        if (game.isLand(t)) {
          landTile = t;
          break;
        }
      }
      if (landTile !== undefined) break;
    }

    player.conquer(landTile!);
    const city = player.buildUnit(UnitType.City, landTile!, {});

    game.endSpawnPhase();

    player.addGold(10_000_000n);

    const bu = player
      .buildableUnits(landTile!)
      .find((b) => b.type === UnitType.City)!;
    expect(bu.canUpgrade).toBe(city.id());
    expect(bu.upgradeCosts).toHaveLength(MAX_UPGRADE_AMOUNT);
    // First step is the currently-displayed single cost; city costs escalate
    // per level, so the x5 total must exceed a naive cost * 5.
    expect(bu.upgradeCosts![0]).toBe(bu.cost);
    expect(bu.upgradeCosts![4]).toBeGreaterThan(bu.cost * 5n);

    const goldBefore = player.gold();
    game.addExecution(new UpgradeStructureExecution(player, city.id(), 5));
    game.executeNextTick();

    expect(city.level()).toBe(6);
    expect(goldBefore - player.gold()).toBe(bu.upgradeCosts![4]);
  });

  it("uses DOMINION Silver and Gold SAM launcher prices", async () => {
    const game = await setup("ocean_and_land", { gameType: GameType.Singleplayer, instantBuild: true }, [], undefined, undefined, false);
    const playerInfo = new PlayerInfo("player1", PlayerType.Human, null, "player1_id");
    game.addPlayer(playerInfo);
    const player = game.player("player1_id")!;
    let landTile: TileRef | undefined;
    for (let y = 0; y < game.map().height() && landTile === undefined; y++) {
      for (let x = 0; x < game.map().width(); x++) {
        const tile = game.ref(x, y);
        if (game.isLand(tile)) { landTile = tile; break; }
      }
    }
    player.conquer(landTile!);
    game.endSpawnPhase();
    player.addGold(6_000_000n);

    const initial = player.buildableUnits(landTile!).find((unit) => unit.type === UnitType.SAMLauncher)!;
    expect(initial.cost).toBe(1_000_000n);
    const sam = player.buildUnit(UnitType.SAMLauncher, landTile!, {});
    const upgrade = player.buildableUnits(landTile!).find((unit) => unit.type === UnitType.SAMLauncher)!;
    expect(upgrade.upgradeCosts![0]).toBe(4_000_000n);

    game.addExecution(new UpgradeStructureExecution(player, sam.id(), 1));
    game.executeNextTick();
    expect(sam.level()).toBe(2);
  });

  it("applies DOMINION defense post tiers to range and defensive strength", async () => {
    const game = await setup("ocean_and_land", { gameType: GameType.Singleplayer, instantBuild: true }, [], undefined, undefined, false);
    const config = game.config();
    expect(config.defensePostRange(1)).toBe(30);
    expect(config.defensePostRange(2)).toBe(45);
    expect(config.defensePostRange(3)).toBe(60);
    expect(config.defensePostDefenseBonus(1)).toBe(5);
    expect(config.defensePostDefenseBonus(2)).toBe(5.5);
    expect(config.defensePostDefenseBonus(3)).toBe(6);
    expect(config.defensePostSpeedBonus(1)).toBe(3);
    expect(config.defensePostSpeedBonus(2)).toBe(3.25);
    expect(config.defensePostSpeedBonus(3)).toBe(3.5);
  });

  it("caps defense post tier effects at Gold", async () => {
    const game = await setup("ocean_and_land", { gameType: GameType.Singleplayer, instantBuild: true }, [], undefined, undefined, false);
    const config = game.config();
    expect(config.defensePostRange(4)).toBe(config.defensePostRange(3));
    expect(config.defensePostDefenseBonus(4)).toBe(config.defensePostDefenseBonus(3));
    expect(config.defensePostSpeedBonus(4)).toBe(config.defensePostSpeedBonus(3));
  });

});
