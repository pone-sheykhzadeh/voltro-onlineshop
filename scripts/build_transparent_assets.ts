import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve(process.cwd(), 'public/images/products');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. Process white-background studio renders into transparent PNGs
async function processWhiteBgImage(inputPath: string, outputFilename: string) {
  console.log(`Processing white-bg image: ${inputPath} -> ${outputFilename}...`);
  const buf = fs.readFileSync(inputPath);
  const image = sharp(buf);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const isWhiteBg = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
    // Soft shadow threshold: high brightness, low saturation
    const brightness = (r + g + b) / 3;
    return brightness >= 240 && maxDiff <= 25;
  };

  const isBg = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let qHead = 0;
  let qTail = 0;

  // Seed from 4 borders
  for (let x = 0; x < width; x++) {
    if (isWhiteBg(x, 0)) { isBg[x] = 1; queue[qTail++] = x; queue[qTail++] = 0; }
    const b = (height - 1) * width + x;
    if (isWhiteBg(x, height - 1)) { isBg[b] = 1; queue[qTail++] = x; queue[qTail++] = height - 1; }
  }
  for (let y = 0; y < height; y++) {
    const l = y * width;
    if (isWhiteBg(0, y) && !isBg[l]) { isBg[l] = 1; queue[qTail++] = 0; queue[qTail++] = y; }
    const r = y * width + (width - 1);
    if (isWhiteBg(width - 1, y) && !isBg[r]) { isBg[r] = 1; queue[qTail++] = width - 1; queue[qTail++] = y; }
  }

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  while (qHead < qTail) {
    const cx = queue[qHead++];
    const cy = queue[qHead++];
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!isBg[nIdx] && isWhiteBg(nx, ny)) {
          isBg[nIdx] = 1;
          queue[qTail++] = nx;
          queue[qTail++] = ny;
        }
      }
    }
  }

  // Alpha feathering on boundary
  const finalData = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const idx = pIdx * 4;
      if (isBg[pIdx]) {
        finalData[idx + 3] = 0;
      } else {
        // Feather edge if adjacent to bg
        let bgNeighbors = 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && isBg[ny * width + nx]) {
            bgNeighbors++;
          }
        }
        if (bgNeighbors > 0) {
          const brightness = (finalData[idx] + finalData[idx + 1] + finalData[idx + 2]) / 3;
          if (brightness > 220) {
            finalData[idx + 3] = Math.max(0, Math.min(255, Math.round((255 - brightness) * 4)));
          }
        }
      }
    }
  }

  const outPath = path.join(OUT_DIR, outputFilename);
  await sharp(finalData, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`Saved transparent ${outputFilename} successfully.`);
}

// 2. Process Stitch checkerboard images
async function processCheckerboardImage(
  url: string,
  outputFilename: string,
  options: {
    darkMin: number;
    darkMax: number;
    lightMin: number;
    lightMax: number;
    seedCenterTop?: boolean;
    maxDiff?: number;
    protectCenter?: { minX: number; maxX: number; minY: number; maxY: number };
  }
) {
  console.log(`Processing checkerboard: ${outputFilename}...`);
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const image = sharp(buf);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const isCheckerboard = (x: number, y: number) => {
    // If inside protected region, never consider background
    if (options.protectCenter) {
      if (
        x >= options.protectCenter.minX &&
        x <= options.protectCenter.maxX &&
        y >= options.protectCenter.minY &&
        y <= options.protectCenter.maxY
      ) {
        return false;
      }
    }

    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
    const allowedDiff = options.maxDiff ?? 18;
    if (maxDiff > allowedDiff) return false;

    const isDark = r >= options.darkMin && r <= options.darkMax;
    const isLight = r >= options.lightMin && r <= options.lightMax;
    const isTransition = r > options.darkMax && r < options.lightMin && maxDiff <= 12;
    return isDark || isLight || isTransition;
  };

  const isBg = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let qHead = 0;
  let qTail = 0;

  // Initialize BFS from all 4 borders
  for (let x = 0; x < width; x++) {
    if (isCheckerboard(x, 0)) {
      isBg[x] = 1; queue[qTail++] = x; queue[qTail++] = 0;
    }
    const bIdx = (height - 1) * width + x;
    if (isCheckerboard(x, height - 1)) {
      isBg[bIdx] = 1; queue[qTail++] = x; queue[qTail++] = height - 1;
    }
  }
  for (let y = 0; y < height; y++) {
    const lIdx = y * width;
    if (isCheckerboard(0, y) && !isBg[lIdx]) {
      isBg[lIdx] = 1; queue[qTail++] = 0; queue[qTail++] = y;
    }
    const rIdx = y * width + (width - 1);
    if (isCheckerboard(width - 1, y) && !isBg[rIdx]) {
      isBg[rIdx] = 1; queue[qTail++] = width - 1; queue[qTail++] = y;
    }
  }

  // Seed inner headphone loop if applicable
  if (options.seedCenterTop) {
    const cx = Math.floor(width / 2);
    for (let cy = 80; cy < 260; cy++) {
      const idx = cy * width + cx;
      if (isCheckerboard(cx, cy) && !isBg[idx]) {
        isBg[idx] = 1; queue[qTail++] = cx; queue[qTail++] = cy;
      }
    }
  }

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  while (qHead < qTail) {
    const cx = queue[qHead++];
    const cy = queue[qHead++];
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!isBg[nIdx] && isCheckerboard(nx, ny)) {
          isBg[nIdx] = 1;
          queue[qTail++] = nx;
          queue[qTail++] = ny;
        }
      }
    }
  }

  const finalData = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const idx = pIdx * 4;
      if (isBg[pIdx]) {
        finalData[idx + 3] = 0;
      } else {
        let hasBgNeighbor = false;
        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && isBg[ny * width + nx]) {
            hasBgNeighbor = true;
            break;
          }
        }
        if (hasBgNeighbor) {
          const maxDiff = Math.max(
            Math.abs(finalData[idx] - finalData[idx + 1]),
            Math.abs(finalData[idx] - finalData[idx + 2]),
            Math.abs(finalData[idx + 1] - finalData[idx + 2])
          );
          if (maxDiff <= 10) {
            finalData[idx + 3] = 160;
          }
        }
      }
    }
  }

  const outPath = path.join(OUT_DIR, outputFilename);
  await sharp(finalData, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`Saved ${outputFilename} successfully.`);
}

async function main() {
  // 1. Process the 2 new studio products
  await processWhiteBgImage(
    'src/assets/images/galaxy_s24_ultra_1791854085632.jpg',
    'samsung-s24-ultra.png'
  );
  await processWhiteBgImage(
    'src/assets/images/beosound_speaker_1791854085949.jpg',
    'bo-beosound-a1.png'
  );

  // 2. Process Stitch products with exact calibrated thresholds
  // MacBook Pro 16: protect center keyboard and display
  await processCheckerboardImage(
    'https://lh3.googleusercontent.com/aida/AEtjO1UDyDWxnZD14CH3ZUavDdD_63jw2x0qkBIBdyD4VpLtfpTwn4MMt5ApbmI7qkJpJWsUQ-OqhHm1kizJzI7Me9aSTA612YPytEiXScKM9I52W21olz6RRN-2jg4xCAHRjPTuMkds1oHZYwK2s6yz1sN_bIjXdjbqcCiZZIAeP2LBqikgd0NxvhzLqtuRKrrL-GGY661znUqq799TdIfsqblrhrEuM6JXv-5GPx4rdXDdJDzS7vpKNzKuHA',
    'macbook-pro-16.png',
    {
      darkMin: 25,
      darkMax: 65,
      lightMin: 155,
      lightMax: 225,
      protectCenter: { minX: 120, maxX: 390, minY: 110, maxY: 420 },
    }
  );

  // AirPods Max: calibrated with inner headband loop
  await processCheckerboardImage(
    'https://lh3.googleusercontent.com/aida/AEtjO1XaP4Q49gyEgZZdBpsUK1gdw8uJzjtvN6nIdr7gxgB3wkYJoNr3_IRTcjHxEEXw40WioPOOJ89s0gUiIX_AQ1zHz7zpyYovXz_JCqJM01814doc5Xndav5aPJv3yr9FnlSWjw06xfBut8KqHRRGTuL-nxKMHYr7ujQw_0cmRaL2Ib3pEaPrfafiwCTLjz5FsHMtOEtRJBDWLWhEXKp-DmIP8GoOyz0FRDnbvbBfz-iUjEKPgA6hYeKdVQ',
    'airpods-max.png',
    {
      darkMin: 35,
      darkMax: 80,
      lightMin: 160,
      lightMax: 230,
      seedCenterTop: true,
      maxDiff: 18,
    }
  );

  // Apple Watch Ultra 2: dark pixels are 0..15, light are 140..190
  await processCheckerboardImage(
    'https://lh3.googleusercontent.com/aida/AEtjO1VmP_Dj0MNmvtvbOLmlS4GLJp2WJiXI-yGTr8A_9CeX_Zo6_CwUZxq5VbbHK0O95h4vLjh9zxOKk8pTHog6dRoVK14MNHuQqOPOroM-5NlU3uSPbsvJyR-fEP1itGY6y5hQSMZl3Ksuf0RhuQEe1sOIOB-sP8jGCPI5pIjjg6Z6J62bAyCMXedKOGI1ApLJ8F7xCTtisjASD6ueH2iCJ19H4PHGveMRB3H9AHoPgJMxhoPGJrYuXNxd_A',
    'apple-watch-ultra-2.png',
    {
      darkMin: 0,
      darkMax: 25,
      lightMin: 130,
      lightMax: 210,
      protectCenter: { minX: 140, maxX: 370, minY: 120, maxY: 390 },
      maxDiff: 20,
    }
  );

  // iPhone 15 Pro Max: dark pixels are 0..20, light are 90..150
  await processCheckerboardImage(
    'https://lh3.googleusercontent.com/aida/AEtjO1WXhEyEepNG3nrTHQur-A6xPvft0SR21-Q3pdUwp4F5Wg-DqXv2lt_GU5RUKPgUIYJdUV8T7BFX1bU8OY6IMvOjj6wQuOhY-GjoY2CK1xB5wfvC9ElEKHxSuSlk1Ef4Z93M_a0cVR9KMtpMAVkG8OoLmjruFgE6DS4JZCGpEVBgGvSi_5IZKByEL1eZ8wGTuWfrHq5fzgqieZ7w-7j21tAKsdnt7exGAZjGUn_ogEfw2A8G504Hdh_Q',
    'iphone-15-pro-max.png',
    {
      darkMin: 0,
      darkMax: 25,
      lightMin: 85,
      lightMax: 160,
      protectCenter: { minX: 130, maxX: 380, minY: 70, maxY: 440 },
      maxDiff: 20,
    }
  );

  // AirPods Pro 2: dark pixels are 25..60, light are 155..220
  await processCheckerboardImage(
    'https://lh3.googleusercontent.com/aida/AEtjO1XAPotrrz77scEvolrCk30IcHBSqCXVeDjYinGTw5MdG_SnDL_gDobttVK0UCx2TqjtmWoVpQYPwNl5S9IuDmhlRIKKyuqQc4D1w8vpqbKjCABxqLNVb4qUlhPlYdzJ9lPwyCQQbBiBMb6whmZ1__5LZpavAEYIg7pAVBYpecmsl2cdV48QPaHIZjHzTWrhel-YaGvVRoRDQGnylwgJJJjtm0JRsQhPCv50MAh1VHmZVZJBD6yxtqOx',
    'airpods-pro-2.png',
    {
      darkMin: 0,
      darkMax: 65,
      lightMin: 150,
      lightMax: 220,
      protectCenter: { minX: 130, maxX: 380, minY: 110, maxY: 420 },
      maxDiff: 20,
    }
  );

  console.log('All 7 product transparent PNGs built successfully!');
}

main().catch(console.error);
