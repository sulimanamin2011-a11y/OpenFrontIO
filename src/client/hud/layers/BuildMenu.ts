import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { EventBus } from "@openfront/shared/EventBus";
import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "../../../client/Utils";
import { Controller } from "../../Controller";
import {
  CloseViewEvent,
  MouseDownEvent,
  MouseMoveEvent,
  ShowBuildMenuEvent,
  ShowEmojiMenuEvent,
} from "../../InputHandler";
import { TransformHandler } from "../../TransformHandler";
import {
  AircraftCommandIntentEvent,
  BuildUnitIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../../Transport";
import { UIState } from "../../UIState";
import { GameView } from "../../view";
const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const castleIcon = assetUrl("images/CastleIconWhite.svg");
const aircraftBaseIcon = assetUrl("images/AircraftBaseIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const mirvIcon = assetUrl("images/MIRVIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const hydrogenBombIcon = assetUrl("images/MushroomCloudIconWhite.svg");
const atomBombIcon = assetUrl("images/NukeIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samlauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const shieldIcon = assetUrl("images/ShieldIconWhite.svg");

export interface BuildItemDisplay {
  unitType: PlayerBuildableUnitType;
  icon: string;
  description?: string;
  key?: string;
  countable?: boolean;
  section?: "main" | "castle" | "aircraft";
}

const buildTable: BuildItemDisplay[][] = [
  [
    {
      unitType: UnitType.AtomBomb,
      icon: atomBombIcon,
      description: "build_menu.desc.atom_bomb",
      key: "unit_type.atom_bomb",
      countable: false,
    },
    {
      unitType: UnitType.MIRV,
      icon: mirvIcon,
      description: "build_menu.desc.mirv",
      key: "unit_type.mirv",
      countable: false,
    },
    {
      unitType: UnitType.HydrogenBomb,
      icon: hydrogenBombIcon,
      description: "build_menu.desc.hydrogen_bomb",
      key: "unit_type.hydrogen_bomb",
      countable: false,
    },
    {
      unitType: UnitType.Warship,
      icon: warshipIcon,
      description: "build_menu.desc.warship",
      key: "unit_type.warship",
      countable: true,
    },
    {
      unitType: UnitType.Port,
      icon: portIcon,
      description: "build_menu.desc.port",
      key: "unit_type.port",
      countable: true,
    },
    {
      unitType: UnitType.MissileSilo,
      icon: missileSiloIcon,
      description: "build_menu.desc.missile_silo",
      key: "unit_type.missile_silo",
      countable: true,
    },
    {
      unitType: UnitType.SAMLauncher,
      icon: samlauncherIcon,
      description: "build_menu.desc.sam_launcher",
      key: "unit_type.sam_launcher",
      countable: true,
    },
    {
      unitType: UnitType.DefensePost,
      icon: shieldIcon,
      description: "build_menu.desc.defense_post",
      key: "unit_type.defense_post",
      countable: true,
    },
    {
      unitType: UnitType.City,
      icon: cityIcon,
      description: "build_menu.desc.city",
      key: "unit_type.city",
      countable: true,
    },
    {
      unitType: UnitType.Factory,
      icon: factoryIcon,
      description: "build_menu.desc.factory",
      key: "unit_type.factory",
      countable: true,
    },
    {
      unitType: UnitType.Castle,
      icon: castleIcon,
      description: "Build a fortified stronghold on your territory.",
      key: "Castle",
      countable: true,
      section: "castle",
    },
    {
      unitType: UnitType.AircraftBase,
      icon: aircraftBaseIcon,
      description: "Build a base for aircraft operations.",
      key: "Aircraft Base",
      countable: true,
      section: "aircraft",
    },
  ],
];

export const flattenedBuildTable = buildTable.flat();

@customElement("build-menu")
export class BuildMenu extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private clickedTile: TileRef;
  public playerBuildables: BuildableUnit[] | null = null;
  private filteredBuildTable: BuildItemDisplay[][] = buildTable;
  @state()
  private activeSection: "main" | "castle" | "aircraft" = "main";
  @state()
  private aircraftCommandMode: "launch" | "aim" | "drop" | null = null;
  @state()
  private aircraftCommandHint = "";
  private lastAircraftAimTile: TileRef | null = null;
  private lastAircraftAimAt = 0;
  public transformHandler: TransformHandler;

  init() {
    this.eventBus.on(ShowBuildMenuEvent, (e) => {
      if (!this.game.myPlayer()?.isAlive()) {
        return;
      }
      if (!this._hidden) {
        // Players sometimes hold control while building a unit,
        // so if the menu is already open, ignore the event.
        return;
      }
      const clickedCell = this.transformHandler.screenToWorldCoordinates(
        e.x,
        e.y,
      );
      if (!this.game.isValidCoord(clickedCell.x, clickedCell.y)) {
        return;
      }
      const tile = this.game.ref(clickedCell.x, clickedCell.y);
      this.showMenu(tile);
    });
    this.eventBus.on(CloseViewEvent, () => this.hideMenu());
    this.eventBus.on(ShowEmojiMenuEvent, () => this.hideMenu());
    this.eventBus.on(MouseDownEvent, (event) => {
      if (this.aircraftCommandMode !== null) {
        this.handleAircraftMapClick(event.x, event.y);
        return;
      }
      this.hideMenu();
    });
    this.eventBus.on(MouseMoveEvent, (event) => {
      if (this.aircraftCommandMode !== "aim") return;
      const tile = this.tileAtScreenPoint(event.x, event.y);
      if (tile === null || tile === this.lastAircraftAimTile) return;
      const now = Date.now();
      if (now - this.lastAircraftAimAt < 150) return;
      this.lastAircraftAimTile = tile;
      this.lastAircraftAimAt = now;
      this.eventBus.emit(new AircraftCommandIntentEvent("aim", tile));
    });
  }

  tick() {
    if (!this._hidden) {
      void this.refresh();
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    .build-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      background-color: #1e1e1e;
      padding: 15px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 95vw;
      max-height: 95vh;
      overflow-y: auto;
    }
    .build-description {
      font-size: 0.6rem;
    }
    .build-row {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      width: 100%;
    }
    .build-button {
      position: relative;
      width: 120px;
      height: 140px;
      border: 2px solid #444;
      background-color: #2c2c2c;
      color: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 8px;
      padding: 10px;
      gap: 5px;
    }
    .build-button:not(:disabled):hover {
      background-color: #3a3a3a;
      transform: scale(1.05);
      border-color: #666;
    }
    .build-button:not(:disabled):active {
      background-color: #4a4a4a;
      transform: scale(0.95);
    }
    .build-button:disabled {
      background-color: #1a1a1a;
      border-color: #333;
      cursor: not-allowed;
      opacity: 0.7;
    }
    .build-button:disabled img {
      opacity: 0.5;
    }
    .build-button:disabled .build-cost {
      color: #ff4444;
    }
    .build-icon {
      font-size: 40px;
      margin-bottom: 5px;
    }
    .build-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
      text-align: center;
    }
    .build-cost {
      font-size: 14px;
    }
    .hidden {
      display: none !important;
    }
    .build-count-chip {
      position: absolute;
      top: -10px;
      right: -10px;
      background-color: #2c2c2c;
      color: white;
      padding: 2px 10px;
      border-radius: 10000px;
      transition: all 0.3s ease;
      font-size: 12px;
      display: flex;
      justify-content: center;
      align-content: center;
      border: 1px solid #444;
    }
    .build-button:not(:disabled):hover > .build-count-chip {
      background-color: #3a3a3a;
      border-color: #666;
    }
    .build-button:not(:disabled):active > .build-count-chip {
      background-color: #4a4a4a;
    }
    .build-button:disabled > .build-count-chip {
      background-color: #1a1a1a;
      border-color: #333;
      cursor: not-allowed;
    }
    .build-count {
      font-weight: bold;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .build-menu {
        padding: 10px;
        max-height: 80vh;
        width: 80vw;
      }
      .build-button {
        width: 140px;
        height: 120px;
        margin: 4px;
        padding: 6px;
        gap: 5px;
      }
      .build-icon {
        font-size: 28px;
      }
      .build-name {
        font-size: 12px;
        margin-bottom: 3px;
      }
      .build-cost {
        font-size: 11px;
      }
      .build-count {
        font-weight: bold;
        font-size: 10px;
      }
      .build-count-chip {
        padding: 1px 5px;
      }
    }

    @media (max-width: 480px) {
      .build-menu {
        padding: 8px;
        max-height: 70vh;
      }
      .build-button {
        width: calc(50% - 6px);
        height: 100px;
        margin: 3px;
        padding: 4px;
        border-width: 1px;
      }
      .build-icon {
        font-size: 24px;
      }
      .build-name {
        font-size: 10px;
        margin-bottom: 2px;
      }
      .build-cost {
        font-size: 9px;
      }
      .build-count {
        font-weight: bold;
        font-size: 8px;
      }
      .build-count-chip {
        padding: 0 3px;
      }
      .build-button img {
        width: 24px;
        height: 24px;
      }
      .build-cost img {
        width: 10px;
        height: 10px;
      }
    }
  `;

  @state()
  private _hidden = true;

  public canBuildOrUpgrade(item: BuildItemDisplay): boolean {
    if (this.game?.myPlayer() === null || this.playerBuildables === null) {
      return false;
    }
    const unit = this.playerBuildables.find((u) => u.type === item.unitType);
    if (this.uiState.preventStacking) return !!unit && unit.canBuild !== false;
    return unit ? unit.canBuild !== false || unit.canUpgrade !== false : false;
  }

  public cost(item: BuildItemDisplay): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item.unitType) {
        return bu.cost;
      }
    }
    return 0n;
  }

  public count(item: BuildItemDisplay): string {
    const player = this.game?.myPlayer();
    if (!player) {
      return "?";
    }

    return player.totalUnitLevels(item.unitType).toString();
  }

  public sendBuildOrUpgrade(buildableUnit: BuildableUnit, tile: TileRef): void {
    // Castle and aircraft base are placed through the same live map ghost
    // preview used by keyboard placement. This lets players inspect the
    // footprint and choose a location before spending gold.
    if (
      buildableUnit.canBuild !== false &&
      (buildableUnit.type === UnitType.Castle ||
        buildableUnit.type === UnitType.AircraftBase) &&
      (buildableUnit.canUpgrade === false || this.uiState.preventStacking)
    ) {
      this.uiState.ghostStructure = buildableUnit.type;
      this.uiState.upgradeMultiplier = 1;
      this.eventBus.emit(new CloseViewEvent());
      this.hideMenu();
      return;
    }

    if (buildableUnit.canUpgrade !== false && !this.uiState.preventStacking) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          buildableUnit.canUpgrade,
          buildableUnit.type,
        ),
      );
    } else if (buildableUnit.canBuild !== false) {
      const rocketDirectionUp =
        buildableUnit.type === UnitType.AtomBomb ||
        buildableUnit.type === UnitType.HydrogenBomb
          ? this.uiState.rocketDirectionUp
          : undefined;
      this.eventBus.emit(
        new BuildUnitIntentEvent(buildableUnit.type, tile, rocketDirectionUp),
      );
    }
    this.hideMenu();
  }

  render() {
    return html`
      <div
        class="build-menu ${this._hidden ? "hidden" : ""}"
        @contextmenu=${(e: MouseEvent) => e.preventDefault()}
      >
        <div class="build-row" role="tablist" aria-label="Build categories">
          ${(["main", "castle", "aircraft"] as const).map((section) => html`
            <button
              class="build-button"
              id="build-tab-${section}"
              role="tab"
              aria-controls="build-menu-panel"
              aria-selected=${this.activeSection === section}
              tabindex=${this.activeSection === section ? 0 : -1}
              style="width:auto;height:auto;min-height:36px;padding:8px 14px"
              @click=${() => {
                this.activeSection = section;
                this.filteredBuildTable = this.getBuildableUnits();
              }}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                  return;
                }
                event.preventDefault();
                const sections = ["main", "castle", "aircraft"] as const;
                const current = sections.indexOf(this.activeSection);
                const next =
                  (current + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                this.activeSection = sections[next];
                this.filteredBuildTable = this.getBuildableUnits();
                this.renderRoot.querySelector<HTMLButtonElement>(
                  `#build-tab-${this.activeSection}`,
                )?.focus();
              }}
            >
              ${
                section === "main"
                  ? "Structures & Weapons"
                  : section === "castle"
                    ? "Castle Menu"
                    : "Aircraft Menu"
              }
            </button>
          `)}
        </div>
        <div
          id="build-menu-panel"
          role="tabpanel"
          aria-labelledby="build-tab-${this.activeSection}"
        >
        ${this.filteredBuildTable.map(
          (row) => html`
            <div class="build-row">
              ${row.map((item) => {
                const buildableUnit = this.playerBuildables?.find(
                  (bu) => bu.type === item.unitType,
                );
                if (buildableUnit === undefined) {
                  return html``;
                }
                const enabled = this.canBuildOrUpgrade(item);
                return html`
                  <button
                    class="build-button"
                    @click=${() =>
                      this.sendBuildOrUpgrade(buildableUnit, this.clickedTile)}
                    ?disabled=${!enabled}
                    title=${
                      !enabled
                        ? translateText("build_menu.not_enough_money")
                        : ""
                    }
                  >
                    <img
                      src=${item.icon}
                      alt="${item.unitType}"
                      width="40"
                      height="40"
                    />
                    <span class="build-name">
                      ${item.key && translateText(item.key)}
                    </span>
                    <span class="build-description"
                      >${
                        item.description && translateText(item.description)
                      }</span
                    >
                    <span class="build-cost" translate="no">
                      ${renderNumber(
                        this.game && this.game.myPlayer() ? this.cost(item) : 0,
                      )}
                      <img
                        src=${goldCoinIcon}
                        alt="gold"
                        width="12"
                        height="12"
                        class="align-middle"
                      />
                    </span>
                    ${
                      item.countable
                        ? html`<div class="build-count-chip">
                            <span class="build-count">${this.count(item)}</span>
                          </div>`
                        : ""
                    }
                  </button>
                `;
              })}
            </div>
          `,
        )}
        </div>
        ${this.activeSection === "aircraft" ? html`
          <div class="aircraft-controls" aria-label="Aircraft controls">
            <p class="build-description">Aircraft operations — base upgrades unlock F-20 and F-22 jets</p>
            <div class="build-row">
              <button
                class="build-button"
                style="width:auto;height:auto;min-height:42px"
                @click=${() => this.armAircraftCommand("launch")}
              >Launch Jet</button>
              <button
                class="build-button"
                style="width:auto;height:auto;min-height:42px"
                @click=${() => this.armAircraftCommand("aim")}
              >Follow Cursor</button>
              <button
                class="build-button"
                style="width:auto;height:auto;min-height:42px"
                @click=${() => this.armAircraftCommand("drop")}
              >Drop Atomic Bomb</button>
              <button
                class="build-button"
                style="width:auto;height:auto;min-height:42px"
                @click=${() => this.returnAircraft()}
              >Return Jet</button>
            </div>
            <p class="build-description">${this.aircraftCommandHint || "Launch, then guide the jet with your cursor for up to 10 seconds. Launch cooldown: 2 minutes."}</p>
          </div>
        ` : ""}
      </div>
    `;
  }

  private armAircraftCommand(mode: "launch" | "aim" | "drop") {
    this.aircraftCommandMode = mode;
    this.aircraftCommandHint =
      mode === "launch"
        ? "Click a destination on the map to launch."
        : mode === "aim"
          ? "Move your cursor over the map to guide the jet."
          : "Click a target on the map to drop the atomic bomb.";
    this.hideMenu();
  }

  private returnAircraft() {
    this.eventBus.emit(new AircraftCommandIntentEvent("return"));
    this.aircraftCommandMode = null;
    this.aircraftCommandHint = "Return command sent.";
    this.hideMenu();
  }

  private tileAtScreenPoint(x: number, y: number): TileRef | null {
    const cell = this.transformHandler.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(cell.x, cell.y)) return null;
    return this.game.ref(cell.x, cell.y);
  }

  private handleAircraftMapClick(x: number, y: number) {
    const tile = this.tileAtScreenPoint(x, y);
    if (tile === null) return;
    const action = this.aircraftCommandMode;
    if (action === null) return;
    this.eventBus.emit(new AircraftCommandIntentEvent(action, tile));
    if (action === "launch") {
      this.aircraftCommandMode = "aim";
      this.aircraftCommandHint = "Jet launched. Move your cursor to guide it; choose Drop Atomic Bomb or Return from the Aircraft Menu.";
      this.lastAircraftAimTile = tile;
      this.lastAircraftAimAt = Date.now();
    } else if (action === "drop") {
      this.aircraftCommandMode = null;
      this.aircraftCommandHint = "Bomb drop command sent; jet is returning.";
    } else {
      this.aircraftCommandMode = "aim";
      this.aircraftCommandHint = "Aircraft target updated. Cursor guidance remains active.";
    }
    this.hideMenu();
  }

  hideMenu() {
    this._hidden = true;
    this.requestUpdate();
  }

  showMenu(clickedTile: TileRef) {
    this.clickedTile = clickedTile;
    this._hidden = false;
    void this.refresh();
  }

  private refresh() {
    const refresh = this.game
      .myPlayer()
      ?.buildables(this.clickedTile, BuildMenus.types)
      .then((buildables) => {
        this.playerBuildables = buildables;
        this.requestUpdate();
      })
      .catch((error) => {
        // Retain the last successful snapshot, including newer overlapping replies.
        console.warn("Failed to refresh build menu", error);
      });

    // remove disabled buildings from the buildtable
    this.filteredBuildTable = this.getBuildableUnits();
    return refresh;
  }

  private getBuildableUnits(): BuildItemDisplay[][] {
    return buildTable.map((row) =>
      row.filter((item) =>
        (item.section ?? "main") === this.activeSection &&
        !this.game?.config()?.isUnitDisabled(item.unitType),
      ),
    ).filter((row) => row.length > 0);
  }

  get isVisible() {
    return !this._hidden;
  }
}
