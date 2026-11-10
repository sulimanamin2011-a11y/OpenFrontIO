import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { describe, expect, it } from "vitest";

describe("EngineConfig.unitInfo", () => {
  for (const instantBuild of [false, true]) {
    const gameConfig = { instantBuild } as unknown as GameConfig;
    const shared = new Config(gameConfig, false);
    const engine = new EngineConfig(gameConfig, false);

    it(`adds a cost to the shared unit stats (instantBuild=${instantBuild})`, () => {
      for (const type of Object.values(UnitType)) {
        const { cost, ...stats } = engine.unitInfo(type);
        expect(stats).toEqual(shared.unitInfo(type));
        expect(typeof cost).toBe("function");
      }
    });
  }

  it("gives DOMINION strongholds durable health", () => {
    const shared = new Config({} as unknown as GameConfig, false);
    expect(shared.unitInfo(UnitType.Castle).maxHealth).toBe(5_000);
    expect(shared.unitInfo(UnitType.AircraftBase).maxHealth).toBe(3_000);
  });

  it("caches per unit type", () => {
    const engine = new EngineConfig({} as unknown as GameConfig, false);
    expect(engine.unitInfo(UnitType.City)).toBe(engine.unitInfo(UnitType.City));
  });
});

describe("EngineConfig DOMINION economy", () => {
  it("scales passive port income with the game gold multiplier", () => {
    const player = { isLobbyCreator: () => false } as any;
    const engine = new EngineConfig(
      { goldMultiplier: 2 } as unknown as GameConfig,
      false,
    );

    expect(engine.portPassiveGold(1, player)).toBe(200_000n);
    expect(engine.portPassiveGold(2, player)).toBe(600_000n);
  });
});
