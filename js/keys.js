/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "Tank TT",
  cols: ["Teddy (1P)", "Tommy (2P)"],
  keys: [
    ["drive", "W A S D", "↑ ← ↓ →"],
    ["fire (hold to keep firing)", "F or Space", "L"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
    ["title: Teddy · Tommy · both · build", "1 2 3 B", ""],
  ],
  note: "Playing alone, both sets of keys drive your tank.",
  touch: "The pad (bottom left), the big 🏀 / ✌️ fire button (bottom right) and your brother's face above it.",
});
