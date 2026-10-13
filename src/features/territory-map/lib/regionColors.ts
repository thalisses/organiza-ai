const compactPalette = ['#c6533d', '#287a8c', '#ad7d1b', '#557b42', '#745a91', '#bc5f83'];

export function getRegionColor(regionIndex: number, targetRegionCount: number): string {
  if (
    !Number.isInteger(regionIndex)
    || !Number.isInteger(targetRegionCount)
    || regionIndex < 0
    || targetRegionCount < 1
    || regionIndex >= targetRegionCount
    || targetRegionCount > 50
  ) {
    throw new RangeError('O índice da região está fora do conjunto configurado.');
  }

  if (targetRegionCount <= compactPalette.length) {
    return compactPalette[regionIndex];
  }

  const hue = Number(((regionIndex * 137.508) % 360).toFixed(1));
  const saturation = 56 + (regionIndex % 3) * 7;
  const lightness = 36 + (Math.floor(regionIndex / 3) % 3) * 7;
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSegment = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment < 1) {
    [red, green] = [chroma, secondary];
  } else if (hueSegment < 2) {
    [red, green] = [secondary, chroma];
  } else if (hueSegment < 3) {
    [green, blue] = [chroma, secondary];
  } else if (hueSegment < 4) {
    [green, blue] = [secondary, chroma];
  } else if (hueSegment < 5) {
    [red, blue] = [secondary, chroma];
  } else {
    [red, blue] = [chroma, secondary];
  }

  const match = normalizedLightness - chroma / 2;
  const toHex = (channel: number) => Math.round((channel + match) * 255).toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}