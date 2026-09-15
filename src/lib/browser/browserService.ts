/**
 * Browser Service — Playwright Automation Engine for Hnia
 *
 * Core Guarantees:
 * 1. Strict Tenant Isolation: Browser contexts are strictly segregated per schoolId.
 * 2. Domain Allowlist: Prevents SSRF / navigation to arbitrary external sites.
 * 3. Robust Error Handling: Automatic screenshot capture on failure, sanitized diagnostics.
 * 4. Safe Downloads: File size limits, MIME type verification, and automated cleanup.
 */

import { chromium, Browser, BrowserContext, Page, Download } from "playwright";
import fs from "fs";
import path from "path";
import { DownloadedDocument } from "../externalPortals/types";

// Security: Domain allowlist per portal configuration
const DEFAULT_ALLOWED_DOMAINS = ["localhost:3001", "127.0.0.1:3001"];

// Paths
const BASE_TMP_DIR = path.join(process.cwd(), "tmp");
const SESSIONS_DIR = path.join(BASE_TMP_DIR, "browser-sessions");
const SCREENSHOTS_DIR = path.join(BASE_TMP_DIR, "browser-artifacts", "screenshots");
const DOWNLOADS_DIR = path.join(BASE_TMP_DIR, "browser-downloads");

// Ensure directories exist
for (const dir of [SESSIONS_DIR, SCREENSHOTS_DIR, DOWNLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface BrowserExecutionOptions {
  schoolId: string;
  allowedDomains?: string[];
  timeoutMs?: number;
}

export class BrowserService {
  private static instance: BrowserService;
  private browser: Browser | null = null;
  private activeContexts: Map<string, BrowserContext> = new Map();

  private constructor() {}

  public static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  /**
   * Lazily launch or retrieve the shared Chromium browser instance.
   */
  public async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  /**
   * Retrieve or create a strictly isolated BrowserContext for a specific school.
   */
  public async getOrCreateContext(
    schoolId: string,
    options?: { forceNew?: boolean }
  ): Promise<BrowserContext> {
    if (!schoolId) {
      throw new Error("[BrowserService] schoolId is required for tenant isolation.");
    }

    // Check existing in-memory context
    let context = this.activeContexts.get(schoolId);
    if (context && !options?.forceNew) {
      return context;
    }

    if (context) {
      try {
        await context.close();
      } catch {
        // ignore already closed
      }
      this.activeContexts.delete(schoolId);
    }

    const browser = await this.getBrowser();
    const sessionFile = path.join(SESSIONS_DIR, `${schoolId}.json`);

    const contextOptions: any = {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SnapSchool-Agent/1.0",
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    };

    // Restore persistent session storage if exists
    if (!options?.forceNew && fs.existsSync(sessionFile)) {
      try {
        contextOptions.storageState = sessionFile;
      } catch (err) {
        console.warn(`[BrowserService] Failed to load session state for ${schoolId}:`, err);
      }
    }

    context = await browser.newContext(contextOptions);
    this.activeContexts.set(schoolId, context);

    // Auto-save storageState on context events
    context.on("close", () => {
      this.activeContexts.delete(schoolId);
    });

    return context;
  }

  /**
   * Save session cookies and storage for tenant to disk.
   */
  public async saveSession(schoolId: string): Promise<void> {
    const context = this.activeContexts.get(schoolId);
    if (!context) return;

    try {
      const sessionFile = path.join(SESSIONS_DIR, `${schoolId}.json`);
      await context.storageState({ path: sessionFile });
    } catch (err) {
      console.warn(`[BrowserService] Failed to persist storageState for ${schoolId}:`, err);
    }
  }

  /**
   * Clear session state and cookies for a school (e.g. after logout or session expired).
   */
  public async clearSession(schoolId: string): Promise<void> {
    const context = this.activeContexts.get(schoolId);
    if (context) {
      try {
        await context.close();
      } catch {}
      this.activeContexts.delete(schoolId);
    }

    const sessionFile = path.join(SESSIONS_DIR, `${schoolId}.json`);
    if (fs.existsSync(sessionFile)) {
      try {
        fs.unlinkSync(sessionFile);
      } catch {}
    }
  }

  /**
   * Create a managed page with domain allowlist enforcement.
   */
  public async createSafePage(
    schoolId: string,
    allowedDomains: string[] = DEFAULT_ALLOWED_DOMAINS
  ): Promise<Page> {
    const context = await this.getOrCreateContext(schoolId);
    const page = await context.newPage();

    // Security: Intercept requests to enforce domain allowlist
    await page.route("**/*", (route) => {
      try {
        const reqUrl = new URL(route.request().url());
        const isAllowed = allowedDomains.some(
          (d) => reqUrl.host === d || reqUrl.host.endsWith(`.${d}`)
        );

        if (!isAllowed && reqUrl.protocol.startsWith("http")) {
          console.error(
            `[BrowserService Security] Blocked unauthorized request to ${reqUrl.host} for school ${schoolId}`
          );
          return route.abort("accessdenied");
        }
      } catch {
        // pass through non-standard URLs (data:, about:blank)
      }
      return route.continue();
    });

    return page;
  }

  /**
   * Captures a failure screenshot with sanitized metadata for debugging.
   */
  public async captureFailure(
    page: Page | null,
    schoolId: string,
    operationName: string
  ): Promise<{ screenshotPath?: string; url?: string; title?: string }> {
    if (!page || page.isClosed()) {
      return {};
    }

    try {
      const timestamp = Date.now();
      const filename = `${timestamp}_${schoolId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${operationName}.png`;
      const targetPath = path.join(SCREENSHOTS_DIR, filename);

      await page.screenshot({ path: targetPath, fullPage: false });
      const currentUrl = page.url();
      const currentTitle = await page.title().catch(() => "");

      return {
        screenshotPath: targetPath,
        url: currentUrl,
        title: currentTitle,
      };
    } catch (err) {
      console.warn("[BrowserService] Failed to capture failure screenshot:", err);
      return {};
    }
  }

  /**
   * Safely handle a file download triggered from a page action.
   */
  public async handleDownload(
    page: Page,
    schoolId: string,
    triggerAction: () => Promise<void>,
    options?: { expectedMime?: string; maxSizeBytes?: number }
  ): Promise<DownloadedDocument> {
    const maxSizeBytes = options?.maxSizeBytes || 15 * 1024 * 1024; // 15MB default

    // Wait for the download event
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      triggerAction(),
    ]);

    const rawFilename = download.suggestedFilename();
    // Sanitize filename to prevent path traversal
    const safeFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, "_");

    const schoolDownloadDir = path.join(DOWNLOADS_DIR, schoolId);
    if (!fs.existsSync(schoolDownloadDir)) {
      fs.mkdirSync(schoolDownloadDir, { recursive: true });
    }

    const localFilePath = path.join(schoolDownloadDir, safeFilename);
    await download.saveAs(localFilePath);

    // Validate downloaded file
    const stats = fs.statSync(localFilePath);
    if (stats.size === 0) {
      fs.unlinkSync(localFilePath);
      throw new Error("Downloaded file is empty (0 bytes).");
    }
    if (stats.size > maxSizeBytes) {
      fs.unlinkSync(localFilePath);
      throw new Error(
        `Downloaded file exceeds maximum size limit of ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`
      );
    }

    const fileBuffer = fs.readFileSync(localFilePath);

    // Determine MIME type
    let mimeType = "application/octet-stream";
    if (safeFilename.toLowerCase().endsWith(".pdf")) {
      mimeType = "application/pdf";
      // Verify PDF magic header %PDF
      if (fileBuffer.subarray(0, 4).toString() !== "%PDF") {
        fs.unlinkSync(localFilePath);
        throw new Error("Downloaded file is not a valid PDF document.");
      }
    }

    return {
      filename: safeFilename,
      mimeType,
      buffer: fileBuffer,
      size: stats.size,
      localPath: localFilePath,
    };
  }

  /**
   * Cleans up temporary downloaded file once delivered to Telegram.
   */
  public cleanupTempFile(filePath?: string): void {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn(`[BrowserService] Failed to clean temp file ${filePath}:`, err);
    }
  }

  /**
   * Graceful shutdown of all contexts and Chromium browser.
   */
  public async closeAll(): Promise<void> {
    const contexts = Array.from(this.activeContexts.values());
    for (const context of contexts) {
      try {
        await context.close();
      } catch {}
    }
    this.activeContexts.clear();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
    }
  }
}

export const browserService = BrowserService.getInstance();
