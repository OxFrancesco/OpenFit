import {
  lighten,
  makeHeartGeometry,
  SIZE,
  STROKE,
} from "@/components/rings-geometry";

const hearts = [0, 1, 2].map((index) => makeHeartGeometry(index));

export function ringSvg(
  progress: number,
  color: string,
  size = 64,
  stroke = 8,
) {
  const radius = (size - stroke - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, progress)) * circumference;
  const center = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${center}" cy="${center}" r="${radius}" stroke="${color}" stroke-opacity=".18" stroke-width="${stroke}" fill="none"/><circle cx="${center}" cy="${center}" r="${radius}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${filled} ${circumference}" transform="rotate(-90 ${center} ${center})"/></svg>`;
}

export function heartRingsSvg(
  slots: { progress: number; color: string }[],
  size = 176,
) {
  const layers = hearts
    .map(({ points, perimeter }, index) => {
      const slot = slots[index] ?? { progress: 0, color: "#ABB9AF" };
      const progress = Number.isFinite(slot.progress)
        ? Math.max(0, Math.min(1, slot.progress))
        : 0;
      const d = `${points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")} Z`;
      const arc = `stroke-dasharray="${progress * perimeter} ${perimeter}"`;
      return `<path d="${d}" fill="none" stroke="#080D0A" stroke-width="${STROKE + 4}" transform="translate(0 2)"/><path d="${d}" fill="none" stroke="${slot.color}" stroke-opacity=".2" stroke-width="${STROKE}"/>${progress ? `<path d="${d}" fill="none" stroke="url(#ring${index})" stroke-width="${STROKE}" stroke-linecap="round" ${arc}/><path d="${d}" fill="none" stroke="#FFFFFF" stroke-opacity=".16" stroke-width="2" stroke-linecap="round" transform="translate(0 -2)" ${arc}/>` : ""}`;
    })
    .join("");
  const gradients = slots
    .map(
      (slot, index) =>
        `<linearGradient id="ring${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(slot.color, 0.38)}"/><stop offset="1" stop-color="${slot.color}"/></linearGradient>`,
    )
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg"><defs>${gradients}</defs>${layers}</svg>`;
}
