import { afterEach, describe, expect, it, vi } from "vitest";
import type { PurchaseButton } from "../../src/client/components/PurchaseButton";
import { alignPurchaseRows } from "../../src/client/components/PurchaseButton";

vi.mock("../../src/client/InGameModal", () => ({
  showInGameAlert: vi.fn().mockResolvedValue(true),
  showInGameConfirm: vi.fn().mockResolvedValue(true),
}));

const { showInGameAlert } = await import("../../src/client/InGameModal");

describe("PurchaseButton", () => {
  let button: PurchaseButton | undefined;

  afterEach(() => {
    button?.remove();
    button = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not render or invoke real-money checkout in DOMINION", async () => {
    const purchase = vi.fn(async () => undefined);
    button = document.createElement("purchase-button") as PurchaseButton;
    button.dollarPrice = "$5";
    button.onPurchaseDollar = purchase;
    document.body.appendChild(button);
    await button.updateComplete;

    expect(button.offersDollar).toBe(false);
    expect(button.querySelector(".purchase-sparkle-btn")).toBeNull();
    expect(purchase).not.toHaveBeenCalled();
  });
  it("uses blue purchase controls instead of equipped-state green", async () => {
    button = document.createElement("purchase-button") as PurchaseButton;
    button.dollarPrice = "$5";
    button.priceHard = 100;
    button.onPurchaseDollar = vi.fn(async () => undefined);
    button.onPurchaseHard = vi.fn(async () => undefined);
    document.body.appendChild(button);
    await button.updateComplete;

    expect(button.querySelector(".purchase-sparkle-btn")).toBeNull();
    for (const selector of [".purchase-sparkle-btn-hard"]) {
      const purchase = button.querySelector<HTMLButtonElement>(selector)!;
      expect(purchase.className).toMatch(/blue/);
      expect(purchase.className).not.toMatch(/green|emerald/);
    }
  });

  it("strikes through the list price during a sale", async () => {
    button = document.createElement("purchase-button") as PurchaseButton;
    button.priceHard = 75;
    button.listPriceHard = 100;
    button.priceSoft = 500;
    button.listPriceSoft = 500;
    button.onPurchaseHard = vi.fn(async () => undefined);
    button.onPurchaseSoft = vi.fn(async () => undefined);
    document.body.appendChild(button);
    await button.updateComplete;

    const hard = button.querySelector(".purchase-sparkle-btn-hard")!;
    // The struck price, after its screen-reader "was" label.
    const struck = hard.querySelector("s[data-sale-tag]")!;
    expect(struck.querySelector(".sr-only")?.textContent).toContain(
      "store.sale_was",
    );
    expect(struck.lastChild?.textContent?.trim()).toBe("100");
    // A list price not above the price is no sale.
    const soft = button.querySelector(".purchase-sparkle-btn-soft")!;
    expect(soft.querySelector("[data-sale-tag]")).toBeNull();
  });

  it("clears busy state and reports a synchronous purchase throw", async () => {
    vi.mocked(showInGameAlert).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    button = document.createElement("purchase-button") as PurchaseButton;
    button.priceHard = 100;
    button.onPurchaseHard = () => {
      throw new Error("sync purchase failure");
    };
    document.body.appendChild(button);
    await button.updateComplete;

    button.querySelector<HTMLButtonElement>(".purchase-sparkle-btn-hard")!.click();

    await vi.waitFor(() =>
      expect(showInGameAlert).toHaveBeenCalledWith("store.purchase_failed"),
    );
    expect(
      button.querySelector(".purchase-btn-wrap")?.getAttribute("aria-busy"),
    ).toBeNull();
  });

  it("clears busy state and handles a rejected purchase callback", async () => {
    vi.mocked(showInGameAlert).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    button = document.createElement("purchase-button") as PurchaseButton;
    button.priceHard = 100;
    button.onPurchaseHard = async () => {
      throw new Error("rejected purchase failure");
    };
    document.body.appendChild(button);
    await button.updateComplete;

    button.querySelector<HTMLButtonElement>(".purchase-sparkle-btn-hard")!.click();

    await vi.waitFor(() =>
      expect(showInGameAlert).toHaveBeenCalledWith("store.purchase_failed"),
    );
    expect(
      button.querySelector(".purchase-btn-wrap")?.getAttribute("aria-busy"),
    ).toBeNull();
  });

  it("triggers card-level hover styling from any cosmetic shell", async () => {
    button = document.createElement("purchase-button") as PurchaseButton;
    button.dollarPrice = "$5";
    button.onPurchaseDollar = async () => undefined;
    document.body.appendChild(button);
    await button.updateComplete;

    const css =
      document.getElementById("purchase-button-styles")?.textContent ?? "";

    // Hover styling must key off the shared shell attribute so cards that are
    // not <cosmetic-card> (e.g. the custom plutonium card) behave identically.
    expect(css).not.toMatch(/cosmetic-card:hover \.purchase-btn-wrap/);
    for (const target of [
      ".purchase-sparkle-streak",
      ".purchase-sparkle-btn",
      ".purchase-sparkle-btn-hard",
      ".purchase-sparkle-btn-soft",
      ".purchase-ember",
      ".purchase-burst",
    ]) {
      expect(css).toContain(
        `[data-cosmetic-shell]:hover .purchase-btn-wrap ${target}`,
      );
    }
  });

  it("starts the rising particles at the first real button, not a held line", async () => {
    button = document.createElement("purchase-button") as PurchaseButton;
    button.rarity = "epic";
    button.priceSoft = 50;
    button.onPurchaseSoft = async () => undefined;
    button.reserveHard = true;
    document.body.appendChild(button);
    await button.updateComplete;

    const wrap = () =>
      button!.querySelector<HTMLElement>(".purchase-btn-wrap")!;
    // One held hard-currency line above (min-h-11 plus gap-1) = 3rem.
    expect(wrap().style.getPropertyValue("--purchase-particle-top")).toBe(
      "3rem",
    );
    expect(
      document.getElementById("purchase-button-styles")?.textContent,
    ).toContain("top: var(--purchase-particle-top, 0px)");

    button.reserveHard = false;
    await button.updateComplete;
    expect(wrap().style.getPropertyValue("--purchase-particle-top")).toBe(
      "0rem",
    );
  });

  describe("alignPurchaseRows", () => {
    const make = (offsetTop: number, kind: "dollar" | "hard" | "soft") => {
      const el = document.createElement("purchase-button") as PurchaseButton;
      if (kind === "dollar") {
        el.dollarPrice = "$5";
        el.onPurchaseDollar = async () => undefined;
      } else if (kind === "hard") {
        el.priceHard = 99;
        el.onPurchaseHard = async () => undefined;
      } else {
        el.priceSoft = 50;
        el.onPurchaseSoft = async () => undefined;
      }
      Object.defineProperty(el, "offsetTop", { value: offsetTop });
      return el;
    };

    it("reserves only the currencies present in each row", async () => {
      const root = document.createElement("div");
      const [rowOneSoft, rowOneHard, rowTwoHard] = [
        make(0, "soft"),
        make(0, "hard"),
        make(200, "hard"),
      ];
      root.append(rowOneSoft, rowOneHard, rowTwoHard);
      document.body.appendChild(root);
      await Promise.all(
        [rowOneSoft, rowOneHard, rowTwoHard].map((el) => el.updateComplete),
      );

      alignPurchaseRows(root);
      await Promise.all(
        [rowOneDollar, rowOneHard, rowTwoHard].map((el) => el.updateComplete),
      );

      // Row one mixes hard and soft currency, so both cards reserve both lines.
      expect(rowOneSoft.reserveHard).toBe(true);
      expect(rowOneHard.reserveSoft).toBe(true);
      // Row two has only hard currency: no soft or cash line.
      expect(rowTwoHard.reserveDollar).toBe(false);
      expect(rowTwoHard.reserveHard).toBe(false);
      expect(rowOneSoft.reserveDollar).toBe(false);
      expect(rowOneSoft.reserveSoft).toBe(true);
      expect(rowTwoHard.reserveSoft).toBe(false);
      expect(rowTwoHard.querySelectorAll(".flex.flex-col > *")).toHaveLength(1);

      root.remove();
    });
  });
});
