import { RankedType } from "@openfront/engine-api/game/GameTypes";
import { html } from "lit";
import { customElement, query } from "lit/decorators.js";
import { BaseModal } from "./components/BaseModal";
import "./components/leaderboard/LeaderboardPlayerList";
import type {
  LeaderboardPlayerList,
  PlayerLadder,
} from "./components/leaderboard/LeaderboardPlayerList";
import "./components/leaderboard/LeaderboardTribeTable";
import type { LeaderboardTribeTable } from "./components/leaderboard/LeaderboardTribeTable";
import { modalHeader } from "./components/ui/ModalHeader";
import { translateText } from "./Utils";

const TAB_KEYS = [
  "players",
  "players2v2",
  "playersFfa",
  "tribes",
] as const;

// Tab key -> ladder. "players" predates the 2v2 ladder and stays the 1v1 tab
// so existing `#modal=leaderboard&tab=players` links keep working. The ladder
// tabs share one <leaderboard-player-list>: a page fetch returns every ladder.
const PLAYER_TABS: Record<string, PlayerLadder> = {
  players: RankedType.OneVOne,
  players2v2: RankedType.TwoVTwo,
  playersFfa: RankedType.FreeForAll,
};

@customElement("leaderboard-modal")
export class LeaderboardModal extends BaseModal {
  protected routerName = "leaderboard";

  @query("leaderboard-player-list")
  private playerList?: LeaderboardPlayerList;
  @query("leaderboard-tribe-table")
  private tribeTable?: LeaderboardTribeTable;

  private loadToken = 0;
  private lastRankedType: PlayerLadder = RankedType.OneVOne;

  protected modalConfig() {
    return {
      tabs: [
        {
          key: "players",
          label: translateText("leaderboard_modal.ranked_tab"),
        },
        {
          key: "players2v2",
          label: translateText("leaderboard_modal.ranked_2v2_tab"),
        },
        {
          key: "playersFfa",
          label: translateText("leaderboard_modal.ranked_ffa_tab"),
        },
        { key: "tribes", label: translateText("leaderboard_modal.tribes_tab") },
      ],
    };
  }

  private rankedTypeFor(tab: string): PlayerLadder | null {
    return PLAYER_TABS[tab] ?? null;
  }

  private tabComponent(tab: string) {
    if (this.rankedTypeFor(tab) !== null) return this.playerList;
    return this.tribeTable;
  }

  protected onOpen(): void {
    this.loadActiveTabData();
  }

  protected onTabEnter(): void {
    // The player list is one element shared by the ladder tabs, so it needs a
    // ranked type even while another tab is up: keep showing the last one.
    this.lastRankedType =
      this.rankedTypeFor(this.activeTab) ?? this.lastRankedType;
    this.loadActiveTabData();
  }

  private loadActiveTabData() {
    const token = ++this.loadToken;

    const active = this.activeTab;

    const run = async () => {
      if (token !== this.loadToken) return;

      if (this.rankedTypeFor(active) !== null) {
        await this.playerList?.ensureLoaded();
        if (token !== this.loadToken) return;
        this.playerList?.handleTabActivated();
      } else {
        await this.tabComponent(active)?.ensureLoaded();
      }

      queueMicrotask(() => {
        if (token !== this.loadToken) return;
        for (const key of TAB_KEYS) {
          if (key !== active) void this.tabComponent(key)?.ensureLoaded();
        }
      });
    };

    void (async () => {
      if (!this.tabComponent(active)) {
        await this.updateComplete;
      }
      await run();
    })();
  }

  protected renderHeaderSlot() {
    const refreshTime = html`<span
      class="text-sm font-normal text-white/40 ml-2 wrap-break-words italic"
      >(${translateText("leaderboard_modal.refresh_time")})</span
    >`;

    return modalHeader({
      titleContent: html`
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="text-white text-xl sm:text-2xl font-bold uppercase tracking-widest"
          >
            ${translateText("leaderboard_modal.title")}
          </span>
          ${
            this.rankedTypeFor(this.activeTab) !== null ||
            this.activeTab === "tribes"
              ? refreshTime
              : ""
          }
        </div>
      `,
      onBack: () => this.close(),
      ariaLabel: translateText("common.close"),
    });
  }

  protected renderBody() {
    return html`
      <div class="flex-1 min-h-0 h-full">
        <leaderboard-player-list
          class=${
            this.rankedTypeFor(this.activeTab) !== null ? "h-full" : "hidden"
          }
          .rankedType=${
            this.rankedTypeFor(this.activeTab) ?? this.lastRankedType
          }
        ></leaderboard-player-list>
        <leaderboard-tribe-table
          class=${this.activeTab === "tribes" ? "h-full" : "hidden"}
        ></leaderboard-tribe-table>
      </div>
    `;
  }
}
