export const playerLabel = (players = []) =>
  players.map((name) => String(name).trim()).filter(Boolean).join(" - ");
