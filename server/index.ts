import express from "express";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { jobs } from "@shared/schema";
import { and, eq, lt } from "drizzle-orm";
import { storage } from "./storage";

dotenv.config();

async function main() {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  const port = parseInt(process.env.PORT || "5000", 10);
  const isProd = process.env.NODE_ENV === "production";

  // Register routes and websocket server
  const httpServer = await registerRoutes(app);

  // Frontend handling
  if (isProd) {
    serveStatic(app);
  } else {
    await setupVite(app, httpServer);
  }

  httpServer.listen(port, () => {
    log(`Server listening on http://localhost:${port}`);
  });

  // Auto-pause jobs with no updates for JOB_INACTIVITY_MINUTES (default 30)
  const inactivityMinutes = parseInt(process.env.JOB_INACTIVITY_MINUTES || "30", 10);
  const scanIntervalMs = 60 * 1000; // every minute
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - inactivityMinutes * 60 * 1000);
      const candidates = await db.select().from(jobs).where(
        and(
          eq(jobs.status, 'in_progress'),
          lt(jobs.updatedAt, cutoff)
        )
      );
      for (const j of candidates) {
        await storage.pauseJob(j.id);
      }
      if (candidates.length > 0) {
        log(`Auto-paused ${candidates.length} job(s) inactive > ${inactivityMinutes}m`);
      }
    } catch (err) {
      console.error('Auto-pause scan error:', err);
    }
  }, scanIntervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Removed duplicate/legacy entrypoint block
