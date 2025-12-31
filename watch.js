const puppeteer = require("puppeteer");
const fs = require("fs");
const fetch = require("node-fetch");

const TARGET_URL = https://www.2ndstreet.jp/search?category=930001;
const CACHE_FILE = "count.txt";

(async () => {
  console.log("ページへアクセス中...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(TARGET_URL, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  // 件数取得（2nd street の UI よく変わるので幅広く対応）
  const count = await page.evaluate(() => {
    const candidates = [
      document.querySelector("[class*=total]"),
      document.querySelector(".search-total-count"),
      document.querySelector("body")
    ];

    for (const el of candidates) {
      if (!el) continue;
      const match = el.innerText.match(/(\d+)\s*件/);
      if (match) return Number(match[1]);
    }

    return null;
  });

  await browser.close();

  if (!count) {
    console.log("❌ 件数が取得できませんでした");
    return;
  }

  console.log("現在の商品数:", count);

  // 以前の件数取得（Cache から復元されたファイル）
  let prev = 0;
  if (fs.existsSync(CACHE_FILE)) {
    prev = Number(fs.readFileSync(CACHE_FILE, "utf8"));
  }

  console.log("前回の商品数:", prev);

  // 初回 or 変化なし → 終了
  if (!prev) {
    console.log("初回記録として保存します");
  } else if (count === prev) {
    console.log("増減なし → 通知しません");
  } else if (count > prev) {
    const diff = count - prev;
    console.log(`🆕 ${diff}件 増えました！ Discordへ通知します`);

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🆕 **セカスト新着 ${diff} 件追加！**\n現在 ${count} 件\n${TARGET_URL}`
      })
    });
  } else {
    console.log("件数が減っています（在庫変動）→ 通知なし");
  }

  // 最新件数を保存（→ 次回 Cache に保存される）
  fs.writeFileSync(CACHE_FILE, String(count));
})();

