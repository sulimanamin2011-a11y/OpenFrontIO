import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { CastleExecution } from "@openfront/engine/execution/CastleExecution";
import { ShellExecution } from "@openfront/engine/execution/ShellExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { vi } from "vitest";
import { executeTicks } from "./util/utils";

let game: Game;
let owner: Player;
let opponent: Player;

describe("Castle", () => {
  beforeEach(async () => {
    game = await setup(
      "plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("owner", PlayerType.Human, null, "castle_owner"),
        new PlayerInfo("opponent", PlayerType.Human, null, "castle_opponent"),
      ],
    );
    owner = game.player("castle_owner");
    opponent = game.player("castle_opponent");
    executeTicks(game, 50);
  });

  test("fires on nearby hostile warships", () => {
    const castleTile = game.ref(4, 10);
    const shipTile = game.ref(7, 10);
    owner.conquer(castleTile);
    opponent.conquer(shipTile);
    const castle = owner.buildUnit(UnitType.Castle, castleTile, {});
    opponent.buildUnit(UnitType.Warship, shipTile, {});
    game.addExecution(new CastleExecution(castle));

    executeTicks(game, 2);

    expect(
      game
        .executions()
        .some((execution) => execution instanceof ShellExecution),
    ).toBe(true);
  });

  test("does not fire on allied warships", () => {
    const castleTile = game.ref(4, 10);
    const shipTile = game.ref(7, 10);
    owner.conquer(castleTile);
    opponent.conquer(shipTile);
    const castle = owner.buildUnit(UnitType.Castle, castleTile, {});
    opponent.buildUnit(UnitType.Warship, shipTile, {});
    vi.spyOn(owner, "isFriendly").mockReturnValue(true);
    game.addExecution(new CastleExecution(castle));

    executeTicks(game, 2);

    expect(
      game
        .executions()
        .some((execution) => execution instanceof ShellExecution),
    ).toBe(false);
  });

  test("does not fire on hostile land units", () => {
    const castleTile = game.ref(4, 10);
    const targetTile = game.ref(7, 10);
    owner.conquer(castleTile);
    opponent.conquer(targetTile);
    const castle = owner.buildUnit(UnitType.Castle, castleTile, {});
    opponent.buildUnit(UnitType.City, targetTile, {});
    game.addExecution(new CastleExecution(castle));

    executeTicks(game, 2);

    expect(
      game.executions().some((execution) => execution instanceof ShellExecution),
    ).toBe(false);
  });

  test("stops defending after the castle is destroyed", () => {
    const castleTile = game.ref(4, 10);
    const shipTile = game.ref(7, 10);
    owner.conquer(castleTile);
    opponent.conquer(shipTile);
    const castle = owner.buildUnit(UnitType.Castle, castleTile, {});
    opponent.buildUnit(UnitType.Warship, shipTile, {});
    const defense = new CastleExecution(castle);
    game.addExecution(defense);
    executeTicks(game, 2);

    castle.delete(false);
    executeTicks(game, 1);

    expect(defense.isActive()).toBe(false);
  });
});
