import { planJoinVerify } from "../src/server/JoinVerify";

const base = {
  isReadmit: false,
  gameStarted: false,
  turnstileToken: null,
  identityUnchanged: false,
  steamAuthed: false,
};

test("guest can join without Turnstile", () => {
  expect(planJoinVerify(base)).toEqual({
    action: "verify",
    token: null,
  });
});

test("account can join without Turnstile", () => {
  expect(
    planJoinVerify({ ...base, steamAuthed: true }),
  ).toEqual({
    action: "verify",
    token: null,
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
