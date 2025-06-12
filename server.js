const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// Random 6-char code
function getRandomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function fetchValidScreenshot() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required by Render
  });

  const page = await browser.newPage();

  let attempts = 0;
  let code, imgUrl, prntUrl;

  while (attempts < 15) {
    code = getRandomCode();
    const url = `https://prnt.sc/${code}`;
    console.log(`Trying: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForSelector('img', { timeout: 5000 });

      const result = await page.evaluate(() => {
        const img = document.querySelector('img');
        return {
          src: img?.src || '',
          width: img?.naturalWidth || 0,
          height: img?.naturalHeight || 0,
          bodyText: document.body.innerText.toLowerCase(),
        };
      });

      const { src, width, height, bodyText } = result;
      const isInvalid =
        !src ||
        src.includes('st.prntscr.com') ||
        src.includes('data:image') ||
        (width <= 161 && height <= 81) ||
        bodyText.includes('screenshot has been removed');

      if (!isInvalid) {
        imgUrl = src;
        prntUrl = url;
        break;
      } else {
        console.log(`Rejected image: ${src}`);
      }
    } catch {
      console.log('Timeout or error');
    }

    attempts++;
  }

  await browser.close();

  return imgUrl ? { imgUrl, prntUrl } : null;
}

app.get('/api/random-image', async (req, res) => {
  const result = await fetchValidScreenshot();
  if (result) {
    res.json({ success: true, img: result.imgUrl, link: result.prntUrl });
  } else {
    res.json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
