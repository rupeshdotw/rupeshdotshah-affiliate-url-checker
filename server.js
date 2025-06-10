import fetch from "node-fetch";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- FAST METHOD: Simple Fetch Only (Target < 1 seconds) ---
async function trySimpleFetch(inputUrl, timeoutMs = 1000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      },
    });

    clearTimeout(timeout);

    if (response.ok) {
      const finalUrl = response.url;
      return {
        success: true,
        finalUrl,
        data: {
          originalUrl: inputUrl,
          finalUrl,
          method: "simple-fetch",
          hasClickId: finalUrl.includes("clickid="),
          hasUtmSource: finalUrl.includes("utm_source="),
          hasClickRef: finalUrl.includes("clickref="),
        },
      };
    }
  } catch {
    // Ignore errors silently for speed
  }
  return { success: false };
}

// --- FAST ENDPOINT ---
app.get("/resolve-fast", async (req, res) => {
  const { url: inputUrl } = req.query;

  if (!inputUrl)
    return res.status(400).json({ error: "Missing URL parameter" });

  try {
    new URL(inputUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  const timeout = (ms) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    );

  try {
    const result = await Promise.race([
      trySimpleFetch(inputUrl, 1000),
      timeout(2000),
    ]);

    if (result.success) {
      return res.json(result.data);
    } else {
      return res.status(404).json({ error: "No clickid found in 2 seconds" });
    }
  } catch (err) {
    return res
      .status(504)
      .json({ error: "Request timed out", details: err.message });
  }
});

// --- FALLBACK ENDPOINT (INCLUDES PUPPETEER METHODS) ---
// http://localhost:5100/resolve?url=your-url-here
// http://localhost:5100/resolve-fast?url=your-url-here
app.get("/resolve", async (req, res) => {
  const { url: inputUrl } = req.query;

  if (!inputUrl)
    return res.status(400).json({ error: "Missing URL parameter" });

  try {
    new URL(inputUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    let result = await trySimpleFetch(inputUrl);

    if (result.success && result.finalUrl.includes("clickid=")) {
      return res.json(result.data);
    }

    result = await tryPuppeteerResolve(inputUrl);

    if (
      (result.success && result.finalUrl.includes("clickid=")) ||
      result.finalUrl.includes("clickref=") ||
      result.finalUrl.includes("utm_source=")
    ) {
      return res.json(result.data);
    }

    result = await tryAdvancedPuppeteer(inputUrl);

    if (result.success) {
      return res.json(result.data);
    }

    const bestResult = result.data || {
      originalUrl: inputUrl,
      finalUrl: inputUrl,
    };

    return res.json({
      ...bestResult,
      warning: "clickid parameter not found - URL may need manual verification",
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to resolve URL with all methods",
      details: err.message,
      originalUrl: inputUrl,
    });
  }
});

// --- PUPPETEER METHOD 1: Standard ---
async function tryPuppeteerResolve(inputUrl) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Optimize page load
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      // Only allow document requests, block images, stylesheets, and scripts
      if (
        ["image", "stylesheet", "script", "font"].includes(
          request.resourceType()
        )
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)...");
    await page.goto(inputUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await sleep(2000);

    let finalUrl = page.url();
    let prevUrl = "";
    let stableCount = 0;

    for (let i = 0; i < 5; i++) {
      prevUrl = finalUrl;
      await sleep(500);
      finalUrl = page.url();
      if (finalUrl === prevUrl) stableCount++;
      else stableCount = 0;
      if (
        (stableCount >= 2 && finalUrl.includes("clickid=")) ||
        finalUrl.includes("clickref=") ||
        finalUrl.includes("utm_source=")
      )
        break;
    }

    return {
      success: true,
      finalUrl,
      data: {
        originalUrl: inputUrl,
        finalUrl,
        method: "puppeteer-standard",
        hasClickId: finalUrl.includes("clickid="),
        hasClickRef: finalUrl.includes("clickref="),
        hasUtmSource: finalUrl.includes("utm_source="),
      },
    };
  } catch {
    return { success: false };
  } finally {
    if (browser) await browser.close();
  }
}

// --- PUPPETEER METHOD 2: Advanced ---
async function tryAdvancedPuppeteer(inputUrl) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);

    let bestUrlWithClickId = null;
    let allRedirects = [];

    page.on("request", (req) => {
      const url = req.url();
      if (
        url.includes("clickid=") ||
        url.includes("clickref=") ||
        (url.includes("utm_source=") && !bestUrlWithClickId)
      )
        bestUrlWithClickId = url;
      req.continue();
    });

    page.on("response", async (res) => {
      const url = res.url();
      if (res.status() >= 300 && res.status() < 400) {
        const location = res.headers()["location"];
        if (location) {
          allRedirects.push(location);
          if (
            location.includes("clickid=") ||
            location.includes("clickref=") ||
            (location.includes("utm_source") && !bestUrlWithClickId)
          ) {
            bestUrlWithClickId = location;
          }
        }
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)...");
    await page.goto(inputUrl, { waitUntil: "networkidle0", timeout: 20000 });
    await sleep(4000);

    const finalUrl = bestUrlWithClickId || page.url();

    return {
      success: true,
      finalUrl,
      data: {
        originalUrl: inputUrl,
        finalUrl,
        method: "puppeteer-advanced",
        hasClickId: finalUrl.includes("clickid="),
        hasClickRef: finalUrl.includes("clickref="),
        hasUtmSource: finalUrl.includes("utm_source="),
        redirectChain: allRedirects,
      },
    };
  } catch {
    return { success: false };
  } finally {
    if (browser) await browser.close();
  }
}

// --- Health Check ---
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    methods: ["simple-fetch", "puppeteer-standard", "puppeteer-advanced"],
  });
});

// --- Static Index Route ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ URL Resolver running at http://localhost:${PORT}`);
});
