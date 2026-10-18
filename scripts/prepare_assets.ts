import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_IMG_DIR = path.resolve(process.cwd(), 'public/images/products');

if (!fs.existsSync(PUBLIC_IMG_DIR)) {
  fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });
}

interface ProductAsset {
  filename: string;
  url: string;
}

const assets: ProductAsset[] = [
  {
    filename: 'macbook-pro-16.png',
    url: 'https://lh3.googleusercontent.com/aida/AEtjO1UDyDWxnZD14CH3ZUavDdD_63jw2x0qkBIBdyD4VpLtfpTwn4MMt5ApbmI7qkJpJWsUQ-OqhHm1kizJzI7Me9aSTA612YPytEiXScKM9I52W21olz6RRN-2jg4xCAHRjPTuMkds1oHZYwK2s6yz1sN_bIjXdjbqcCiZZIAeP2LBqikgd0NxvhzLqtuRKrrL-GGY661znUqq799TdIfsqblrhrEuM6JXv-5GPx4rdXDdJDzS7vpKNzKuHA',
  },
  {
    filename: 'airpods-max.png',
    url: 'https://lh3.googleusercontent.com/aida/AEtjO1XaP4Q49gyEgZZdBpsUK1gdw8uJzjtvN6nIdr7gxgB3wkYJoNr3_IRTcjHxEEXw40WioPOOJ89s0gUiIX_AQ1zHz7zpyYovXz_JCqJM01814doc5Xndav5aPJv3yr9FnlSWjw06xfBut8KqHRRGTuL-nxKMHYr7ujQw_0cmRaL2Ib3pEaPrfafiwCTLjz5FsHMtOEtRJBDWLWhEXKp-DmIP8GoOyz0FRDnbvbBfz-iUjEKPgA6hYeKdVQ',
  },
  {
    filename: 'apple-watch-ultra-2.png',
    url: 'https://lh3.googleusercontent.com/aida/AEtjO1VmP_Dj0MNmvtvbOLmlS4GLJp2WJiXI-yGTr8A_9CeX_Zo6_CwUZxq5VbbHK0O95h4vLjh9zxOKk8pTHog6dRoVK14MNHuQqOPOroM-5NlU3uSPbsvJyR-fEP1itGY6y5hQSMZl3Ksuf0RhuQEe1sOIOB-sP8jGCPI5pIjjg6Z6J62bAyCMXedKOGI1ApLJ8F7xCTtisjASD6ueH2iCJ19H4PHGveMRB3H9AHoPgJMxhoPGJrYuXNxd_A',
  },
  {
    filename: 'iphone-15-pro-max.png',
    url: 'https://lh3.googleusercontent.com/aida/AEtjO1WXhEyEepNG3nrTHQur-A6xPvft0SR21-Q3pdUwp4F5Wg-DqXv2lt_GU5RUKPgUIYJdUV8T7BFX1bU8OY6IMvOjj6wQuOhY-GjoY2CK1xB5wfvC9ElEKHxSuSlk1Ef4Z93M_a0cVR9KMtpMAVkG8OoLmjruFgE6DS4JZCGpEVBgGvSi_5IZKByEL1eZ8wGTuWfrHq5fzgqieZ7w-7j21tAKsdnt7exGAZjGUn_ogEfw2A8G504Hdh_Q',
  },
  {
    filename: 'airpods-pro-2.png',
    url: 'https://lh3.googleusercontent.com/aida/AEtjO1XAPotrrz77scEvolrCk30IcHBSqCXVeDjYinGTw5MdG_SnDL_gDobttVK0UCx2TqjtmWoVpQYPwNl5S9IuDmhlRIKKyuqQc4D1w8vpqbKjCABxqLNVb4qUlhPlYdzJ9lPwyCQQbBiBMb6whmZ1__5LZpavAEYIg7pAVBYpecmsl2cdV48QPaHIZjHzTWrhel-YaGvVRoRDQGnylwgJJJjtm0JRsQhPCv50MAh1VHmZVZJBD6yxtqOx',
  },
];

async function processImage(asset: ProductAsset) {
  console.log(`Processing ${asset.filename}...`);
  const res = await fetch(asset.url);
  const buf = Buffer.from(await res.arrayBuffer());

  const image = sharp(buf);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Function to test if pixel is part of neutral checkerboard
  const isCheckerboardPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
    if (maxDiff > 18) return false;

    // Dark check: ~30-65, Light check: ~160-220, or boundary transition with low chroma
    const isDark = r >= 28 && r <= 65;
    const isLight = r >= 155 && r <= 225;
    const isTransition = r > 65 && r < 155 && maxDiff <= 12;
    return isDark || isLight || isTransition;
  };

  const isBackground = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let qHead = 0;
  let qTail = 0;

  // Initialize BFS from all 4 borders
  for (let x = 0; x < width; x++) {
    if (isCheckerboardPixel(x, 0)) {
      isBackground[x] = 1;
      queue[qTail++] = x;
      queue[qTail++] = 0;
    }
    const bIdx = (height - 1) * width + x;
    if (isCheckerboardPixel(x, height - 1)) {
      isBackground[bIdx] = 1;
      queue[qTail++] = x;
      queue[qTail++] = height - 1;
    }
  }
  for (let y = 0; y < height; y++) {
    const lIdx = y * width;
    if (isCheckerboardPixel(0, y) && !isBackground[lIdx]) {
      isBackground[lIdx] = 1;
      queue[qTail++] = 0;
      queue[qTail++] = y;
    }
    const rIdx = y * width + (width - 1);
    if (isCheckerboardPixel(width - 1, y) && !isBackground[rIdx]) {
      isBackground[rIdx] = 1;
      queue[qTail++] = width - 1;
      queue[qTail++] = y;
    }
  }

  // Also seed from center top / headband hole if AirPods Max
  if (asset.filename === 'airpods-max.png') {
    // Check center region for inner loop
    const cx = Math.floor(width / 2);
    for (let cy = 80; cy < 280; cy++) {
      const idx = cy * width + cx;
      if (isCheckerboardPixel(cx, cy) && !isBackground[idx]) {
        isBackground[idx] = 1;
        queue[qTail++] = cx;
        queue[qTail++] = cy;
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
        if (!isBackground[nIdx] && isCheckerboardPixel(nx, ny)) {
          isBackground[nIdx] = 1;
          queue[qTail++] = nx;
          queue[qTail++] = ny;
        }
      }
    }
  }

  // Alpha assignment and soft edge feathering
  const finalData = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const idx = pIdx * 4;
      if (isBackground[pIdx]) {
        finalData[idx + 3] = 0;
      } else {
        // Check if on border of background for slight antialiasing
        let hasBgNeighbor = false;
        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d];
          const ny = y + dy[d];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (isBackground[ny * width + nx]) {
              hasBgNeighbor = true;
              break;
            }
          }
        }
        if (hasBgNeighbor) {
          const r = finalData[idx];
          const g = finalData[idx + 1];
          const b = finalData[idx + 2];
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
          if (maxDiff <= 14) {
            finalData[idx + 3] = 160; // Soft edge
          }
        }
      }
    }
  }

  const outputPath = path.join(PUBLIC_IMG_DIR, asset.filename);
  await sharp(finalData, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  console.log(`Saved ${asset.filename} (${Math.round(stats.size / 1024)} KB)`);
}

async function run() {
  for (const asset of assets) {
    try {
      await processImage(asset);
    } catch (e) {
      console.error(`Failed ${asset.filename}:`, e);
    }
  }
  console.log('All product transparent PNGs generated successfully!');
}

run();
