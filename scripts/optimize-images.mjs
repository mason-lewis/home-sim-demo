import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const input = process.argv[2];
if (!input)
  throw new Error(
    "Usage: node scripts/optimize-images.mjs <directory with morning.png, day.png, dusk.png, night.png>",
  );
await mkdir("public/images", { recursive: true });
for (const scene of ["morning", "day", "dusk", "night"]) {
  const source = resolve(input, `${scene}.png`);
  await sharp(source)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(`public/images/residence-${scene}.webp`);
  await sharp(source)
    .resize({ width: 1080, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(`public/images/residence-${scene}-mobile.webp`);
}
