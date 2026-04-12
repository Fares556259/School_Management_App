import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Use OS temp directory for serverless-safe ephemeral caching
const CACHE_DIR = '/tmp/edufinance_cache';
const CACHE_FILE = path.join(CACHE_DIR, 'smart_insights.json');

export type InsightPayload = {
  totalBalance: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  unpaidAmount: number;
  unpaidCount: number;
};

export type CachedInsight = {
  hash: string;
  insights: any[];
  timestamp: number;
};

// Ensure cache directory exists
const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

// Generate a deterministic hash based on financial data
export const generateHash = (payload: InsightPayload): string => {
  const dataString = `${payload.totalBalance}_${payload.thisMonthIncome}_${payload.thisMonthExpense}_${payload.unpaidAmount}_${payload.unpaidCount}`;
  return crypto.createHash('sha256').update(dataString).digest('hex');
};

export const getCachedInsights = (hash: string): any[] | null => {
  try {
    ensureCacheDir();
    if (!fs.existsSync(CACHE_FILE)) return null;

    const fileContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: CachedInsight = JSON.parse(fileContent);

    // If hashes match and cache is less than 24 hours old, considered valid
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (cache.hash === hash && Date.now() - cache.timestamp < ONE_DAY) {
      return cache.insights;
    }

    return null;
  } catch (error) {
    console.error("Cache read error:", error);
    return null; // Fail gracefully
  }
};

export const setCachedInsights = (hash: string, insights: any[]) => {
  try {
    ensureCacheDir();
    const cacheData: CachedInsight = {
      hash,
      insights,
      timestamp: Date.now()
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.error("Cache write error:", error);
    // Non-fatal, just means next time it fetches via API
  }
};
