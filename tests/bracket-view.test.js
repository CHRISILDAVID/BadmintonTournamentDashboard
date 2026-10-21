import test from "node:test";
import assert from "node:assert/strict";
import { fitBracket, zoomBracket } from "../src/lib/bracket-view.js";

test("large draws fit both dimensions with a margin and remain centred", () => {
  for (const [width, height, vw, vh] of [[2326, 15142, 1800, 700], [2326, 15142, 350, 450], [310, 156, 1000, 600]]) {
    const view = fitBracket(width, height, vw, vh);
    assert.ok(width * view.scale <= vw - 40);
    assert.ok(height * view.scale <= vh - 40);
    assert.equal(view.x, (vw - width * view.scale) / 2);
    assert.equal(view.y, (vh - height * view.scale) / 2);
    assert.ok(view.scale <= 1);
  }
});

test("zoom preserves the bracket point under the cursor, including after panning", () => {
  const original = { x: -420, y: -800, scale: 0.125 };
  const point = { x: 250, y: 150 };
  const next = zoomBracket(original, 2, point);
  assert.equal((point.x - original.x) / original.scale, (point.x - next.x) / next.scale);
  assert.equal((point.y - original.y) / original.scale, (point.y - next.y) / next.scale);
  assert.deepEqual(zoomBracket(next, original.scale, point), original);
});
