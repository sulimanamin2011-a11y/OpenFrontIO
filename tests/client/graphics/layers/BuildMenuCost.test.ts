import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@openfront/shared/EventBus";
import { CloseViewEvent } from "../../../../src/client/InputHandler";
import { AircraftCommandIntentEvent } from "../../../../src/client/Transport";

// Side-effect import: the @customElement decorator registers <build-menu>
// when the module is evaluated, and a type-only reference would not evaluate it.
import { BuildableUnit, UnitType } from "@openfront/engine-api/game/GameTypes";
import "../../../../src/client/hud/layers/BuildMenu";
import type { BuildMenu } from "../../../../src/client/hud/layers/BuildMenu";

function makeMenu(): BuildMenu {
  return document.createElement("build-menu") as BuildMenu;
}

const item = (unitType: UnitType) => ({ unitType, icon: "" }) as any;

describe("BuildMenu.cost", () => {
  it("returns the buildable's cost for a matching unit type", () => {
    const menu = makeMenu();
    menu.playerBuildables = [
      { type: UnitType.City, canBuild: true, canUpgrade: false, cost: 125n },
      { type: UnitType.Port, canBuild: false, canUpgrade: false, cost: 5n },
    ] as unknown as BuildableUnit[];

    // Skips non-matching entries before finding the match.
    expect(menu.cost(item(UnitType.Port))).toBe(5n);
    expect(menu.cost(item(UnitType.City))).toBe(125n);
  });

  it("falls back to 0 when the unit type is not buildable here", () => {
    const menu = makeMenu();
    menu.playerBuildables = [
      { type: UnitType.City, canBuild: true, canUpgrade: false, cost: 125n },
    ] as unknown as BuildableUnit[];

    expect(menu.cost(item(UnitType.Factory))).toBe(0n);
  });

  it("falls back to 0 before the buildables have arrived", () => {
    const menu = makeMenu();
    menu.playerBuildables = null;

    expect(menu.cost(item(UnitType.City))).toBe(0n);
  });
});

describe("BuildMenu hold-to-build availability", () => {
  it("uses the effective action for rendered buttons as the hold changes", async () => {
    const menu = makeMenu();
    menu.game = { myPlayer: () => ({}) } as any;
    menu.uiState = { preventStacking: true } as any;
    menu.playerBuildables = [
      { type: UnitType.City, canBuild: false, canUpgrade: 7, cost: 1n },
    ] as BuildableUnit[];
    (menu as any).filteredBuildTable = [[item(UnitType.City)]];
    document.body.appendChild(menu);
    await menu.updateComplete;
    const button = menu.renderRoot.querySelector("button")!;
    expect(button.disabled).toBe(true);

    menu.uiState.preventStacking = false;
    menu.requestUpdate();
    await menu.updateComplete;
    expect(button.disabled).toBe(false);

    menu.uiState.preventStacking = true;
    menu.playerBuildables[0].canBuild = 0;
    menu.requestUpdate();
    await menu.updateComplete;
    expect(button.disabled).toBe(false);
    menu.remove();
  });
});

it("recovers the open build menu after a buildables timeout", async () => {
  const menu = makeMenu();
  const units = [
    { type: UnitType.City, canBuild: 43, canUpgrade: false, cost: 1n },
  ] as BuildableUnit[];
  const buildables = vi
    .fn()
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValue(units);
  menu.game = {
    myPlayer: () => ({ buildables }),
    config: () => ({ isUnitDisabled: () => false }),
  } as any;
  menu.playerBuildables = units;
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await (menu as any).refresh();
    expect(menu.playerBuildables).toBe(units);
    expect(warning).toHaveBeenCalledTimes(1);
    await (menu as any).refresh();
    expect(menu.playerBuildables).toBe(units);
  } finally {
    warning.mockRestore();
  }
});

it("an older timeout cannot erase a newer successful menu refresh", async () => {
  const menu = makeMenu();
  let rejectOld: (error: Error) => void = () => {};
  const units = [
    { type: UnitType.City, canBuild: 43, canUpgrade: false, cost: 1n },
  ] as BuildableUnit[];
  const buildables = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOld = reject;
        }),
    )
    .mockResolvedValue(units);
  menu.game = {
    myPlayer: () => ({ buildables }),
    config: () => ({ isUnitDisabled: () => false }),
  } as any;
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const oldRefresh = (menu as any).refresh();
    await (menu as any).refresh();
    expect(menu.playerBuildables).toBe(units);
    rejectOld(new Error("timeout"));
    await oldRefresh;
    expect(menu.playerBuildables).toBe(units);
    expect(warning).toHaveBeenCalledTimes(1);
  } finally {
    warning.mockRestore();
  }
});


describe("BuildMenu structure management guidance", () => {
  it("explains Castle defensive tiers in the Castle menu", async () => {
    const menu = makeMenu();
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
    } as any;
    (menu as any).activeSection = "castle";
    document.body.appendChild(menu);
    await menu.updateComplete;

    expect(menu.textContent).toContain("35-tile range");
    expect(menu.textContent).toContain("45-tile range");
    expect(menu.textContent).toContain("55-tile range");
    menu.remove();
  });

  it("does not show aircraft command buttons until a base is complete", async () => {
    const menu = makeMenu();
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
      myPlayer: () => ({
        units: () => [
          { isActive: () => true, isUnderConstruction: () => true },
        ],
      }),
    } as any;
    (menu as any).activeSection = "aircraft";
    document.body.appendChild(menu);
    await menu.updateComplete;

    expect(menu.textContent).toContain("Build and complete an Aircraft Base");
    expect(menu.textContent).not.toContain("Launch Jet");
    menu.remove();
  });
});

describe("BuildMenu live structure management", () => {
  it("shows owned Castle tiers and the selected Castle upgrade price", async () => {
    const menu = makeMenu();
    const castles = [1, 2, 3].map((level) => ({
      level: () => level,
      isActive: () => true,
      isUnderConstruction: () => false,
    }));
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
      myPlayer: () => ({
        units: (type?: UnitType) =>
          type === UnitType.Castle ? castles : [],
      }),
    } as any;
    menu.playerBuildables = [
      {
        type: UnitType.Castle,
        canBuild: false,
        canUpgrade: 77,
        cost: 500_000n,
      },
    ] as BuildableUnit[];
    (menu as any).activeSection = "castle";
    document.body.appendChild(menu);
    await menu.updateComplete;

    expect(menu.textContent).toContain("Owned Castles: 3");
    expect(menu.textContent).toContain("Bronze 1");
    expect(menu.textContent).toContain("Silver 1");
    expect(menu.textContent).toContain("Gold 1");
    expect(menu.textContent).toContain("Selected Castle upgrade: 500K");
    menu.remove();
  });

  it("only enables flight controls while an aircraft is airborne", async () => {
    const menu = makeMenu();
    let airborne = false;
    const base = {
      type: () => UnitType.AircraftBase,
      level: () => 1,
      isActive: () => true,
      isUnderConstruction: () => false,
    };
    const jet = { type: () => UnitType.Jet, isActive: () => airborne };
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
      myPlayer: () => ({
        units: (type?: UnitType) => {
          if (type === UnitType.AircraftBase) return [base];
          if (type === undefined) return airborne ? [base, jet] : [base];
          return [];
        },
      }),
    } as any;
    (menu as any).activeSection = "aircraft";
    document.body.appendChild(menu);
    await menu.updateComplete;

    const button = (label: string) =>
      [...menu.renderRoot.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent?.includes(label),
      )!;
    expect(button("Launch Jet").disabled).toBe(false);
    expect(button("Guide & Click to Drop").disabled).toBe(true);
    expect(button("Return Jet").disabled).toBe(true);
    expect(menu.textContent).toContain("Bronze Aircraft Base");
    expect(menu.textContent).toContain("Silver upgrade: 500K gold");

    airborne = true;
    await menu.updateComplete;
    menu.requestUpdate();
    await menu.updateComplete;
    expect(button("Launch Jet").disabled).toBe(true);
    expect(button("Guide & Click to Drop").disabled).toBe(false);
    expect(button("Return Jet").disabled).toBe(false);
    menu.remove();
  });
});

describe("BuildMenu dedicated structure sections", () => {
  it("keeps Castle and Aircraft Base in their own menus", () => {
    const menu = makeMenu();
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
    } as any;

    expect((menu as any).getBuildableUnits().flat().map((item: any) => item.unitType))
      .not.toContain(UnitType.Castle);
    expect((menu as any).getBuildableUnits().flat().map((item: any) => item.unitType))
      .not.toContain(UnitType.AircraftBase);

    (menu as any).activeSection = "castle";
    expect((menu as any).getBuildableUnits().flat().map((item: any) => item.unitType))
      .toEqual([UnitType.Castle]);

    (menu as any).activeSection = "aircraft";
    expect((menu as any).getBuildableUnits().flat().map((item: any) => item.unitType))
      .toEqual([UnitType.AircraftBase]);
  });

  it("selecting an Aircraft Base starts map ghost placement instead of instant-building", () => {
    const menu = makeMenu();
    const eventBus = new EventBus();
    const emitted: unknown[] = [];
    vi.spyOn(eventBus, "emit").mockImplementation((event) => {
      emitted.push(event);
    });
    menu.eventBus = eventBus;
    menu.uiState = {
      ghostStructure: null,
      upgradeMultiplier: 0,
      preventStacking: false,
    } as any;
    menu.playerBuildables = [
      {
        type: UnitType.AircraftBase,
        canBuild: 10,
        canUpgrade: false,
        cost: 2_500_000n,
      },
    ] as BuildableUnit[];

    menu.sendBuildOrUpgrade(menu.playerBuildables[0], 10);

    expect(menu.uiState.ghostStructure).toBe(UnitType.AircraftBase);
    expect(menu.uiState.upgradeMultiplier).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toBeInstanceOf(CloseViewEvent);
  });
});


describe("BuildMenu accessible category tabs", () => {
  it("supports arrow-key navigation between main, castle, and aircraft tabs", async () => {
    const menu = makeMenu();
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
    } as any;
    document.body.appendChild(menu);
    await menu.updateComplete;

    const mainTab = menu.renderRoot.querySelector<HTMLButtonElement>(
      "#build-tab-main",
    )!;
    mainTab.focus();
    mainTab.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
      }),
    );
    await menu.updateComplete;

    const castleTab = menu.renderRoot.querySelector<HTMLButtonElement>(
      "#build-tab-castle",
    )!;
    expect(castleTab.getAttribute("aria-selected")).toBe("true");
    expect(castleTab.tabIndex).toBe(0);
    expect(
      menu.renderRoot
        .querySelector('[role="tabpanel"]')
        ?.getAttribute("aria-labelledby"),
    ).toBe("build-tab-castle");
    expect(document.activeElement).toBe(castleTab);

    castleTab.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
      }),
    );
    await menu.updateComplete;
    expect(
      menu.renderRoot
        .querySelector<HTMLButtonElement>("#build-tab-aircraft")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    menu.remove();
  });
});




describe("BuildMenu aircraft click-to-drop", () => {
  it("drops the atomic bomb when the player clicks while guiding the jet", () => {
    const menu = makeMenu();
    const eventBus = new EventBus();
    const emitted: unknown[] = [];
    vi.spyOn(eventBus, "emit").mockImplementation((event) => {
      emitted.push(event);
    });
    menu.eventBus = eventBus;
    menu.game = {
      isValidCoord: () => true,
      ref: () => 42,
    } as any;
    menu.transformHandler = {
      screenToWorldCoordinates: () => ({ x: 1, y: 1 }),
    } as any;
    (menu as any).aircraftCommandMode = "aim";

    (menu as any).handleAircraftMapClick(100, 100);

    expect(emitted[0]).toBeInstanceOf(AircraftCommandIntentEvent);
    expect(emitted[0]).toMatchObject({ action: "drop", target: 42 });
    expect((menu as any).aircraftCommandMode).toBeNull();
  });
});

describe("BuildMenu aircraft controls", () => {
  it("shows launch, cursor guidance, bomb-drop and return controls in the aircraft tab", async () => {
    const menu = makeMenu();
    menu.game = {
      config: () => ({ isUnitDisabled: () => false }),
      myPlayer: () => ({
        units: () => [
          { isActive: () => true, isUnderConstruction: () => false },
        ],
      }),
    } as any;
    (menu as any).activeSection = "aircraft";
    document.body.appendChild(menu);
    await menu.updateComplete;

    expect(menu.textContent).toContain("Launch Jet");
    expect(menu.textContent).toContain("Guide & Click to Drop");
    expect(menu.textContent).toContain("Drop Atomic Bomb");
    expect(menu.textContent).toContain("Return Jet");
    menu.remove();
  });
});
