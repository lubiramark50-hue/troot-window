// Renders assets/*.svg to the PNGs that @capacitor/assets expects.
import sharp from "sharp";
import { readFileSync } from "node:fs";
const jobs = [["icon-only", 1024], ["icon-foreground", 1024], ["icon-background", 1024], ["splash", 2732], ["splash-dark", 2732]];
for (const [name, size] of jobs) {
  await sharp(readFileSync(new URL(`../assets/${name}.svg`, import.meta.url)), { density: 144 })
    .resize(size, size).png().toFile(new URL(`../assets/${name}.png`, import.meta.url).pathname);
  console.log("wrote", name + ".png");
}
