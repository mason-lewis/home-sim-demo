import sharp from "sharp";

// Bake the daylight colour separation once, so every lighting scene uses the
// same plant silhouettes. Geometry excludes terrace corners and foreground rocks.
const { data: regions, info } = await sharp("tools/nature-regions.svg")
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const reference = await sharp("public/images/residence-day.webp")
  .resize(info.width, info.height)
  .removeAlpha()
  .raw()
  .toBuffer();
const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
// Below this hand-traced line the foreground is a dense plant body. Moving
// the whole cluster also carries its grey leaves and lavender flowers. Sparse
// tips above the line still use colour separation against the pool wall.
const denseBed = [
  [0, 836],
  [170, 865],
  [270, 905],
  [430, 915],
  [560, 875],
  [660, 906],
  [760, 890],
  [900, 875],
  [1050, 902],
  [1180, 919],
  [1290, 933],
  [1410, 913],
  [1500, 893],
  [1672, 849],
];
const bedTop = (x) => {
  const end = denseBed.findIndex(([right]) => right >= x);
  if (end <= 0) return denseBed[0][1];
  const [left, a] = denseBed[end - 1],
    [right, b] = denseBed[end];
  return a + ((b - a) * (x - left)) / (right - left);
};
const matte = Buffer.alloc(info.width * info.height * 4);
for (let i = 0, pixel = 0; i < regions.length; i += 3, pixel += 4) {
  const [r, g, b] = reference.subarray(i, i + 3);
  // Excess green rejects warm/neutral stone, while retaining olive and grey leaves.
  const green =
    smoothstep(0.5, 9, g - r * 0.9 - b * 0.1) * smoothstep(1, 10, g - b);
  const flower = smoothstep(2, 14, b - g) * smoothstep(0, 9, r - g);
  const x = (i / 3) % info.width,
    y = Math.floor(i / 3 / info.width);
  const body = smoothstep(bedTop(x), bedTop(x) + 16, y);
  const foliage = Math.max(green, flower, body);
  matte[pixel] = regions[i];
  matte[pixel + 1] = Math.round(regions[i + 1] * foliage);
  matte[pixel + 2] = Math.round(regions[i + 2] * foliage);
  // Alpha stores the coarse movement permission separately from leaf detail.
  // Keep it >= 128 so image decoders preserve RGB even outside planting.
  matte[pixel + 3] =
    128 + Math.round((Math.max(regions[i + 1], regions[i + 2]) * 127) / 255);
}
await sharp(matte, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .webp({ lossless: true })
  .toFile("public/images/nature-mask.webp");
