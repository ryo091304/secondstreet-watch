const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const TARGET_URL = "https://www.2ndstreet.jp/search?category=930001";

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 60000 });

  // ページ内の「件数」を取得（2ndstreet形式対応）
  const count = await page.evaluate(() => {
    const el = document.querySelector("[class*=total], .search-total-count");
    if (el) return Number(el.innerText.replace(/\D/g, ""));
    const text = document.body.innerText.match(/(\d+)\s*件/);
    return text ? Number(text[1]) : null;
  });

  await browser.close();

  if (!count) {
    console.log("件数取得失敗");
    return;
  }

  console.log("現在の商品数:", count);

  // GitHub キャッシュ読み書き
  const fs = require("fs");
  const file = "count.txt";
  let old = 0;
  if (fs.existsSync(file)) {
    old = Number(fs.readFileSync(file, "utf8"));
  }

  if (count > old) {
    const diff = count - old;

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🆕 セカストに **${diff} 件の新商品** が追加されました！\n現在の件数: ${count}\n${TARGET_URL}`
      })
    });

    console.log("通知送信しました");
  }

  fs.writeFileSync(file, String(count));
})();
