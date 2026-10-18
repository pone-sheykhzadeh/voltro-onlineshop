import sharp from 'sharp';

const urls: Record<string, string> = {
  macbook: 'https://lh3.googleusercontent.com/aida/AEtjO1UDyDWxnZD14CH3ZUavDdD_63jw2x0qkBIBdyD4VpLtfpTwn4MMt5ApbmI7qkJpJWsUQ-OqhHm1kizJzI7Me9aSTA612YPytEiXScKM9I52W21olz6RRN-2jg4xCAHRjPTuMkds1oHZYwK2s6yz1sN_bIjXdjbqcCiZZIAeP2LBqikgd0NxvhzLqtuRKrrL-GGY661znUqq799TdIfsqblrhrEuM6JXv-5GPx4rdXDdJDzS7vpKNzKuHA',
  airpodsMax: 'https://lh3.googleusercontent.com/aida/AEtjO1XaP4Q49gyEgZZdBpsUK1gdw8uJzjtvN6nIdr7gxgB3wkYJoNr3_IRTcjHxEEXw40WioPOOJ89s0gUiIX_AQ1zHz7zpyYovXz_JCqJM01814doc5Xndav5aPJv3yr9FnlSWjw06xfBut8KqHRRGTuL-nxKMHYr7ujQw_0cmRaL2Ib3pEaPrfafiwCTLjz5FsHMtOEtRJBDWLWhEXKp-DmIP8GoOyz0FRDnbvbBfz-iUjEKPgA6hYeKdVQ',
  appleWatch: 'https://lh3.googleusercontent.com/aida/AEtjO1VmP_Dj0MNmvtvbOLmlS4GLJp2WJiXI-yGTr8A_9CeX_Zo6_CwUZxq5VbbHK0O95h4vLjh9zxOKk8pTHog6dRoVK14MNHuQqOPOroM-5NlU3uSPbsvJyR-fEP1itGY6y5hQSMZl3Ksuf0RhuQEe1sOIOB-sP8jGCPI5pIjjg6Z6J62bAyCMXedKOGI1ApLJ8F7xCTtisjASD6ueH2iCJ19H4PHGveMRB3H9AHoPgJMxhoPGJrYuXNxd_A',
  iphone: 'https://lh3.googleusercontent.com/aida/AEtjO1WXhEyEepNG3nrTHQur-A6xPvft0SR21-Q3pdUwp4F5Wg-DqXv2lt_GU5RUKPgUIYJdUV8T7BFX1bU8OY6IMvOjj6wQuOhY-GjoY2CK1xB5wfvC9ElEKHxSuSlk1Ef4Z93M_a0cVR9KMtpMAVkG8OoLmjruFgE6DS4JZCGpEVBgGvSi_5IZKByEL1eZ8wGTuWfrHq5fzgqieZ7w-7j21tAKsdnt7exGAZjGUn_ogEfw2A8G504Hdh_Q',
  airpodsPro: 'https://lh3.googleusercontent.com/aida/AEtjO1XAPotrrz77scEvolrCk30IcHBSqCXVeDjYinGTw5MdG_SnDL_gDobttVK0UCx2TqjtmWoVpQYPwNl5S9IuDmhlRIKKyuqQc4D1w8vpqbKjCABxqLNVb4qUlhPlYdzJ9lPwyCQQbBiBMb6whmZ1__5LZpavAEYIg7pAVBYpecmsl2cdV48QPaHIZjHzTWrhel-YaGvVRoRDQGnylwgJJJjtm0JRsQhPCv50MAh1VHmZVZJBD6yxtqOx',
};

async function check() {
  for (const [name, url] of Object.entries(urls)) {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const colors = new Set<string>();
    for (let x = 0; x < info.width; x += 15) {
      const idxTop = x * 3;
      colors.add(`${data[idxTop]},${data[idxTop + 1]},${data[idxTop + 2]}`);
    }
    console.log(name, `(channels=${info.channels}) border colors:`, Array.from(colors).slice(0, 6));
  }
}

check();
