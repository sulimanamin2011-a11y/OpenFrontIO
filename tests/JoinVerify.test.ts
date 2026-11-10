import { planJoinVerify } from "../src/server/JoinVerify";

const base = {
  isReadmit: false,
  gameStarted: false,
  turnstileToken: null,
  identityUnchanged: false,
  steamAuthed: false,
};

test("a guest can join without an account after completing Turnstile", () => {
  expect(
    planJoinVerify({ ...base, turnstileToken: "challenge-token" }),
  ).toEqual({
    action: "verify",
    token: "challenge-token",
  });
});

test("a first join without Turnstile is rejected for guests", () => {
  expect(planJoinVerify(base)).toEqual({ action: "reject" });
});

test("a Steam-authenticated first join can skip Turnstile", () => {
  expect(planJoinVerify({ ...base, steamAuthed: true })).toEqual({
    action: "verify",
    token: null,
  });
});

test("an account player without Steam must complete Turnstile", () => {
  expect(
    planJoinVerify({ ...base, turnstileToken: "challenge-token" }),
  ).toEqual({
    action: "verify",
    token: "challenge-token",
  });
});

test("readmission skips verification when identity is unchanged", () => {
  expect(
    planJoinVerify({
      ...base,
      isReadmit: true,
      identityUnchanged: true,
    }),
  ).toEqual({ action: "skip" });
});

test("readmission skips verification when game has started", () => {
  expect(
    planJoinVerify({
      ...base,
      isReadmit: true,
      gameStarted: true,
    }),
  ).toEqual({ action: "skip" });
});

test("readmission checks changed identity without reusing a spent token", () => {
  expect(
    planJoinVerify({
      ...base,
      isReadmit: true,
      turnstileToken: "old-token",
    }),
  ).toEqual({ action: "verify", token: null });
});
