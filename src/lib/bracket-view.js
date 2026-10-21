// Coordinates are CSS pixels in the viewport; bracket dimensions are unscaled.
export function fitBracket(width, height, viewportWidth, viewportHeight, padding = 20) {
  const scale = Math.min(
    Math.max(1, viewportWidth - padding * 2) / width,
    Math.max(1, viewportHeight - padding * 2) / height,
    1,
  );
  return { x: (viewportWidth - width * scale) / 2, y: (viewportHeight - height * scale) / 2, scale };
}

export function zoomBracket(view, scale, point) {
  const ratio = scale / view.scale;
  return { x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio, scale };
}
