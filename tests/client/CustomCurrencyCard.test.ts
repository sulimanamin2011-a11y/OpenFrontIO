import { afterEach, describe, expect, it } from "vitest";
import "../../src/client/components/CustomCurrencyCard";
import type { CustomCurrencyCard } from "../../src/client/components/CustomCurrencyCard";

describe("CustomCurrencyCard", () => {
  let card: CustomCurrencyCard | undefined;

  afterEach(() => {
    card?.remove();
    card = undefined;
  });

  it("does not render a cash-only top-up card in DOMINION", async () => {
    card = document.createElement("custom-currency-card") as CustomCurrencyCard;
    document.body.appendChild(card);
    await card.updateComplete;

    expect(card.querySelector("[data-custom-currency-card]")).toBeNull();
    expect(card.querySelector("purchase-button")).toBeNull();
  });
});
