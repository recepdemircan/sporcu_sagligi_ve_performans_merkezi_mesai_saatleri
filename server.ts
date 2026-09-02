import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db";
import { shiftRequests, swapRequests, settings } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  
  app.get("/api/shift-requests", async (req, res) => {
    try {
      const { weekId } = req.query;
      if (!weekId) return res.status(400).json({ error: "weekId required" });
      const requests = await db.query.shiftRequests.findMany({
        where: eq(shiftRequests.weekId, String(weekId)),
      });
      res.json(requests);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/shift-requests", async (req, res) => {
    try {
      const request = req.body;
      await db.insert(shiftRequests).values(request)
        .onConflictDoUpdate({
          target: shiftRequests.id,
          set: {
            shifts: request.shifts,
            status: request.status,
            submittedAt: request.submittedAt,
          }
        });
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/shift-requests/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await db.update(shiftRequests).set({ status }).where(eq(shiftRequests.id, id));
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/shift-requests/week/:weekId", async (req, res) => {
    try {
      const { weekId } = req.params;
      await db.delete(shiftRequests).where(eq(shiftRequests.weekId, weekId));
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/swap-requests", async (req, res) => {
    try {
      const { weekId } = req.query;
      if (!weekId) return res.status(400).json({ error: "weekId required" });
      const requests = await db.query.swapRequests.findMany({
        where: eq(swapRequests.weekId, String(weekId)),
      });
      res.json(requests);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/swap-requests", async (req, res) => {
    try {
      const swap = req.body;
      await db.insert(swapRequests).values(swap);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/swap-requests/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await db.update(swapRequests).set({ status }).where(eq(swapRequests.id, id));
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/settings/logo", async (req, res) => {
    try {
      const result = await db.query.settings.findFirst({
        where: eq(settings.id, "logo"),
      });
      res.json({ logo: result?.value || null });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/settings/logo", async (req, res) => {
    try {
      const { logo } = req.body;
      await db.insert(settings).values({ id: "logo", value: logo })
        .onConflictDoUpdate({
          target: settings.id,
          set: { value: logo }
        });
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/backup", async (req, res) => {
    try {
      const allShiftRequests = await db.query.shiftRequests.findMany();
      const allSwapRequests = await db.query.swapRequests.findMany();
      res.json({
        exportedAt: new Date().toISOString(),
        shiftRequestsCount: allShiftRequests.length,
        swapRequestsCount: allSwapRequests.length,
        shiftRequests: allShiftRequests,
        swapRequests: allSwapRequests
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
