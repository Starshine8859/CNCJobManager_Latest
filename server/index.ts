import express from "express";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Removed duplicate/legacy entrypoint block
