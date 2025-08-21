import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";

import { storage } from "./storage";
import sgMail from "@sendgrid/mail";
import { createJobSchema, loginSchema, insertUserSchema, insertColorSchema, insertColorGroupSchema, insertSupplySchema, insertSupplyWithRelationsSchema, insertLocationSchema, insertVendorSchema, insertPurchaseOrderSchema, insertPurchaseOrderItemSchema, inventoryMovements, supplyLocations, supplies, locations, inventoryAlerts, locationCategories, purchaseOrders, purchaseOrderItems, vendors, emails } from "@shared/schema";
import { pool } from "./db";
import { db } from "./db";
import { eq, and, or, lte, gte, gt, desc, sql, inArray } from "drizzle-orm";
import "./types";

// File upload configuration
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `texture-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  const PgSession = ConnectPgSimple(session);
  
  app.use(session({
    store: new PgSession({
      pool: pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'cnc-job-manager-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // Set to false for deployment compatibility
      httpOnly: true,
      sameSite: 'lax'
    },
    name: 'cnc-session' // Explicit session name
  }));

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    // Set cache headers for images
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    next();
  }, (req, res, next) => {
    // Simple static file serving
    const filePath = path.join(uploadDir, req.path || '');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.user || req.session.user.role === 'user') {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.user || req.session.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    next();
  };

  // File upload route for texture images
  app.post("/api/upload-texture", requireAdmin, upload.single('texture'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate the URL for the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;
      
      res.json({ 
        success: true, 
        fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Delete uploaded file
  app.delete("/api/upload-texture/:filename", requireAdmin, async (req, res) => {
    try {
      const filename = req.params.filename;
      if (!filename) {
        return res.status(400).json({ message: "Filename is required" });
      }
      const filePath = path.join(uploadDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: "File deleted" });
      } else {
        res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Auth routes
  app.post("/api/login", async (req, res) => {
    try {
      console.log('Login attempt:', req.body?.username);
      const { username, password } = loginSchema.parse(req.body);
      
      // Make username lookup case-insensitive
      const user = await storage.getUserByUsername(username.toLowerCase() || '');
      console.log('User found:', user ? 'yes' : 'no');
      
      if (!user || !await bcrypt.compare(password, user.password)) {
        console.log('Login failed: invalid credentials');
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = user;
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });
      console.log('Login successful for user:', user.username);
      res.json({ user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/me", async (req, res) => {
    if (req.session?.user) {
      // Fetch fresh user data from database to get updated role
      const freshUser = await storage.getUser(req.session.user.id);
      if (freshUser) {
        // Update session with fresh data
        req.session.user = freshUser;
        res.json({ user: { 
          id: freshUser.id, 
          username: freshUser.username, 
          role: freshUser.role 
        }});
      } else {
        res.status(401).json({ message: "User not found" });
      }
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Job routes
  app.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      const { search, status } = req.query;
      console.log('Fetching jobs with search:', search, 'status:', status);
      const jobs = await storage.getAllJobs(
        search as string, 
        status as string
      );
      console.log('Found jobs:', jobs.length);
      res.json(jobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Start job timer when opening job details
  app.post("/api/jobs/:id/start-timer", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const userId = req.session.user?.id;
      
      await storage.startJobTimer(jobId, userId);
      
      const job = await storage.getJob(jobId);
      broadcastToClients({ type: 'job_timer_started', data: { jobId, job } });
      
      res.json({ message: "Job timer started" });
    } catch (error) {
      console.error('Start timer error:', error);
      res.status(500).json({ message: "Failed to start job timer" });
    }
  });

  // Stop job timer when closing job details
  app.post("/api/jobs/:id/stop-timer", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      await storage.stopJobTimer(jobId);
      
      const job = await storage.getJob(jobId);
      broadcastToClients({ type: 'job_timer_stopped', data: { jobId, job } });
      
      res.json({ message: "Job timer stopped" });
    } catch (error) {
      console.error('Stop timer error:', error);
      res.status(500).json({ message: "Failed to stop job timer" });
    }
  });

  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const parsed = createJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid job data", errors: parsed.error.flatten() });
      }
      const job = await storage.createJob(parsed.data);
      broadcastToClients({ type: 'job_created', data: job });
      res.json(job);
    } catch (error: any) {
      console.error('Create job error:', error?.message || error);
      res.status(500).json({ message: "Failed to create job" });
    }
  });



  app.post("/api/jobs/:id/pause", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('Pausing job:', id);
      await storage.pauseJob(id);
      
      const job = await storage.getJob(id);
      console.log('Job after pause:', job?.status);
      broadcastToClients({ type: 'job_updated', data: job });
      
      res.json({ message: "Job paused successfully", job });
    } catch (error) {
      console.error('Pause job error:', error);
      res.status(500).json({ message: "Failed to pause job" });
    }
  });

  app.post("/api/jobs/:id/resume", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('Resuming job:', id);
      await storage.resumeJob(id);
      
      const job = await storage.getJob(id);
      console.log('Job after resume:', job?.status);
      broadcastToClients({ type: 'job_updated', data: job });
      
      res.json({ message: "Job resumed successfully", job });
    } catch (error) {
      console.error('Resume job error:', error);
      res.status(500).json({ message: "Failed to resume job" });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      await storage.deleteJob(id);
      
      broadcastToClients({ type: 'job_deleted', data: { id } });
      
      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  app.put("/api/materials/:id/progress", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { completedSheets } = req.body;
      
      await storage.updateMaterialProgress(id, completedSheets);
      
      broadcastToClients({ type: 'material_updated', data: { id, completedSheets } });
      
      res.json({ message: "Material progress updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update material progress" });
    }
  });

  app.post("/api/materials/:id/add-sheets", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const { additionalSheets, isRecut } = req.body;
      
      if (!additionalSheets || additionalSheets < 1) {
        return res.status(400).json({ message: "Additional sheets must be a positive number" });
      }
      
      await storage.addSheetsToMaterial(materialId, additionalSheets, isRecut);
      
      res.json({ message: "Sheets added successfully" });
    } catch (error) {
      console.error('Add sheets error:', error);
      res.status(500).json({ message: "Failed to add sheets" });
    }
  });

  // Update individual sheet status
  app.post("/api/materials/:materialId/sheets/:sheetIndex", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.materialId);
      const sheetIndex = parseInt(req.params.sheetIndex);
      const { status } = req.body;
      const userId = req.session.user?.id;
      
      console.log('Updating sheet status:', { materialId, sheetIndex, status, userId });
      
      await storage.updateSheetStatus(materialId, sheetIndex, status, userId);
      
      broadcastToClients({ type: 'sheet_status_updated', data: { materialId, sheetIndex, status } });
      
      res.json({ message: "Sheet status updated" });
    } catch (error) {
      console.error('Update sheet status error:', error);
      res.status(500).json({ message: "Failed to update sheet status" });
    }
  });

  app.put("/api/materials/:id/sheet-status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sheetIndex, status } = req.body;
      const userId = req.session.user?.id;
      
      await storage.updateSheetStatus(id, sheetIndex, status, userId);
      
      broadcastToClients({ type: 'sheet_status_updated', data: { id, sheetIndex, status } });
      
      res.json({ message: "Sheet status updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update sheet status" });
    }
  });

  app.delete("/api/materials/:id/sheet/:sheetIndex", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const sheetIndex = parseInt(req.params.sheetIndex);
      
      await storage.deleteSheet(materialId, sheetIndex);
      
      broadcastToClients({ type: 'sheet_deleted', data: { materialId, sheetIndex } });
      
      res.json({ message: "Sheet deleted successfully" });
    } catch (error) {
      console.error('Delete sheet error:', error);
      res.status(500).json({ message: "Failed to delete sheet" });
    }
  });

  // Add recut entry
  app.post("/api/materials/:id/recuts", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const { quantity, reason } = req.body;
      const userId = req.session.user?.id;
      
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: 'Invalid recut quantity' });
      }
      
      await storage.addRecutEntry(materialId, quantity, reason, userId);
      
      broadcastToClients({ type: 'recut_added', data: { materialId, quantity, reason } });
      
      res.json({ message: 'Recut entry added successfully' });
    } catch (error) {
      console.error('Add recut error:', error);
      res.status(500).json({ message: 'Failed to add recut entry' });
    }
  });

  // Get recut entries for material
  app.get("/api/materials/:id/recuts", async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const recutEntries = await storage.getRecutEntries(materialId);
      res.json(recutEntries);
    } catch (error) {
      console.error('Get recuts error:', error);
      res.status(500).json({ message: 'Failed to fetch recut entries' });
    }
  });

  // Add material to existing job
  app.post("/api/jobs/:id/materials", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { colorId, totalSheets } = req.body;
      
      if (!colorId || !totalSheets || totalSheets < 1) {
        return res.status(400).json({ message: "Color ID and valid sheet count required" });
      }
      
      await storage.addMaterialToJob(jobId, colorId, totalSheets);
      
      broadcastToClients({ type: 'job_updated', data: { jobId } });
      
      res.json({ message: "Material added to job successfully" });
    } catch (error) {
      console.error('Add material to job error:', error);
      res.status(500).json({ message: "Failed to add material to job" });
    }
  });

  // Delete material from job
  app.delete("/api/materials/:id", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      
      await storage.deleteMaterial(materialId);
      
      broadcastToClients({ type: 'material_deleted', data: { materialId } });
      
      res.json({ message: "Material deleted successfully" });
    } catch (error) {
      console.error('Delete material error:', error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // Delete individual recut entry
  app.delete("/api/recuts/:id", requireAuth, async (req, res) => {
    try {
      const recutId = parseInt(req.params.id);
      
      await storage.deleteRecutEntry(recutId);
      
      broadcastToClients({ type: 'recut_deleted', data: { recutId } });
      
      res.json({ message: "Recut entry deleted successfully" });
    } catch (error) {
      console.error('Delete recut error:', error);
      res.status(500).json({ message: "Failed to delete recut entry" });
    }
  });

  // Update recut sheet status
  app.put("/api/recuts/:id/sheet-status", requireAuth, async (req, res) => {
    try {
      const recutId = parseInt(req.params.id);
      const { sheetIndex, status } = req.body;
      const userId = req.session.user?.id;
      
      await storage.updateRecutSheetStatus(recutId, sheetIndex, status, userId);
      
      broadcastToClients({ type: 'recut_sheet_status_updated', data: { recutId, sheetIndex, status } });
      
      res.json({ message: "Recut sheet status updated" });
    } catch (error) {
      console.error('Update recut sheet status error:', error);
      res.status(500).json({ message: "Failed to update recut sheet status" });
    }
  });

  // Cutlist management routes
  app.post("/api/jobs/:id/cutlists", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { count } = req.body;
      
      if (!count || count < 1) {
        return res.status(400).json({ message: "Count must be at least 1" });
      }
      
      const cutlists = await storage.createCutlists(jobId, count);
      
      const job = await storage.getJob(jobId);
      broadcastToClients({ type: 'job_updated', data: job });
      
      res.json({ cutlists });
    } catch (error) {
      res.status(500).json({ message: "Failed to create cutlists" });
    }
  });

  app.delete("/api/cutlists/:id", requireAuth, async (req, res) => {
    try {
      const cutlistId = parseInt(req.params.id);
      
      await storage.deleteCutlist(cutlistId);
      
      broadcastToClients({ type: 'cutlist_deleted', data: { cutlistId } });
      
      res.json({ message: "Cutlist deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete cutlist" });
    }
  });

  // Colors API (redirected to supplies for backward compatibility)
  app.get("/api/colors", requireAuth, async (req, res) => {
    try {
      const supplies = await storage.getAllSupplies();
      // Transform supplies to match the old colors format for backward compatibility
      const colors = supplies.map(supply => ({
        id: supply.id,
        name: supply.name,
        hexColor: supply.hexColor,
        groupId: supply.location?.id || null,
        texture: supply.texture,
        createdAt: supply.createdAt,
        updatedAt: supply.updatedAt,
        group: supply.location ? { id: supply.location.id, name: supply.location.name } : null
      }));
      res.json(colors);
    } catch (error) {
      console.error("Error fetching colors:", error);
      res.status(500).json({ message: "Failed to fetch colors" });
    }
  });

  app.post("/api/colors", requireAuth, async (req, res) => {
    try {
      const colorData = req.body;
      // Transform color data to supply format
      const supplyData = {
        name: colorData.name,
        hexColor: colorData.hexColor,
        pieceSize: 'sheet',
        quantityOnHand: 0,
        locationId: colorData.groupId,
        texture: colorData.texture,
        defaultVendor: '',
        defaultVendorPrice: undefined
      };
      const supply = await storage.createSupply(supplyData);
      // Transform back to color format
      const color = {
        id: supply.id,
        name: supply.name,
        hexColor: supply.hexColor,
        groupId: null, // New supplies don't have location until added to supply_locations
        texture: supply.texture,
        createdAt: supply.createdAt,
        updatedAt: supply.updatedAt
      };
      res.json(color);
    } catch (error) {
      console.error("Error creating color:", error);
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  app.put("/api/colors/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const colorData = req.body;
      // Transform color data to supply format
      const supplyData = {
        name: colorData.name,
        hexColor: colorData.hexColor,
        locationId: colorData.groupId,
        texture: colorData.texture
      };
      await storage.updateSupply(id, supplyData);
      res.json({ message: "Color updated successfully" });
    } catch (error) {
      console.error("Error updating color:", error);
      res.status(500).json({ message: "Failed to update color" });
    }
  });

  app.delete("/api/colors/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSupply(id);
      res.json({ message: "Color deleted successfully" });
    } catch (error) {
      console.error("Error deleting color:", error);
      res.status(500).json({ message: "Failed to delete color" });
    }
  });

  // Color group routes
  app.get("/api/color-groups", requireAuth, async (req, res) => {
    try {
      const groups = await storage.getAllColorGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch color groups" });
    }
  });

  app.post("/api/color-groups", requireAuth, async (req, res) => {
    try {
      const groupData = insertColorGroupSchema.parse(req.body);
      const group = await storage.createColorGroup(groupData);
      res.json(group);
    } catch (error) {
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  app.put("/api/color-groups/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      await storage.updateColorGroup(id, name);
      res.json({ message: "Color group updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  app.delete("/api/color-groups/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteColorGroup(id);
      res.json({ message: "Color group deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete color group" });
    }
  });

  // Supply routes (new)
  app.get("/api/supplies", requireAuth, async (req, res) => {
    try {
      const { search } = req.query;
      let supplies;
      
      if (search) {
        supplies = await storage.searchSupplies(search as string);
      } else {
        supplies = await storage.getAllSupplies();
      }
      
      res.json(supplies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplies" });
    }
  });

  app.get("/api/supplies/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supply = await storage.getSupply(id);
      if (!supply) {
        return res.status(404).json({ message: "Supply not found" });
      }
      res.json(supply);
    } catch (error) {
      console.error('Get supply error:', error);
      res.status(500).json({ message: "Failed to fetch supply" });
    }
  });

  // Supply location metrics (on hand, allocated, available) for a supply
  app.get("/api/supplies/:id/location-metrics", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rows = await db.select({
        id: supplyLocations.id,
        locationId: supplyLocations.locationId,
        locationName: locations.name,
        onHandQuantity: supplyLocations.onHandQuantity,
        allocatedQuantity: supplyLocations.allocatedQuantity,
        availableQuantity: supplyLocations.availableQuantity,
      })
      .from(supplyLocations)
      .leftJoin(locations, eq(supplyLocations.locationId, locations.id))
      .where(eq(supplyLocations.supplyId, id));

      res.json(rows);
    } catch (error) {
      console.error('Get supply location metrics error:', error);
      res.status(500).json({ message: "Failed to fetch supply location metrics" });
    }
  });

  app.post("/api/supplies", requireAuth, async (req, res) => {
    try {
      console.log('Creating supply with data:', req.body);
      const supplyData = insertSupplyWithRelationsSchema.parse(req.body);
      const supply = await storage.createSupply(supplyData);
      res.json(supply);
    } catch (error) {
      console.error('Create supply error:', error);
      res.status(400).json({ message: "Invalid supply data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/supplies/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('=== UPDATE SUPPLY REQUEST ===');
      console.log('Supply ID:', id);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('User session:', req.session.user);
      
      const supplyData = insertSupplyWithRelationsSchema.partial().parse(req.body);
      console.log('Parsed supply data:', JSON.stringify(supplyData, null, 2));
      
      console.log('Calling storage.updateSupply...');
      await storage.updateSupply(id, supplyData);
      // Recalculate available for all locations of this supply
      await db.update(supplyLocations)
        .set({ availableQuantity: sql`${supplyLocations.onHandQuantity} - ${supplyLocations.allocatedQuantity}` })
        .where(eq(supplyLocations.supplyId, id));
      console.log('Storage.updateSupply completed successfully');
      
      console.log('Sending success response...');
      res.json({ message: "Supply updated successfully" });
      console.log('=== UPDATE SUPPLY COMPLETED ===');
    } catch (error) {
      console.error('=== UPDATE SUPPLY ERROR ===');
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('=== END ERROR ===');
      res.status(400).json({ message: "Invalid supply data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/supplies/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSupply(id);
      res.json({ message: "Supply deleted successfully" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete supply";
      const status = message.includes("purchase orders") ? 400 : 500;
      res.status(status).json({ message });
    }
  });

  app.post("/api/supplies/:id/quantity", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity, type, description, jobId } = req.body;
      const userId = req.session.user?.id;
      
      await storage.updateSupplyQuantity(id, quantity, type, description, jobId, userId);
      res.json({ message: "Supply quantity updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid quantity update data" });
    }
  });

  app.post("/api/supplies/:id/allocate", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity, jobId } = req.body;
      const userId = req.session.user?.id;
      
      const { locationId } = req.body;
      await storage.allocateSupplyForJob(id, quantity, jobId, locationId, userId);
      res.json({ message: "Supply allocated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid allocation data" });
    }
  });

  // Location routes (new)
  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getAllLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.post("/api/locations", requireAuth, async (req, res) => {
    try {
      const locationData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(locationData);
      res.json(location);
    } catch (error) {
      res.status(400).json({ message: "Invalid location data" });
    }
  });

  app.put("/api/locations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      await storage.updateLocation(id, name);
      res.json({ message: "Location updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid location data" });
    }
  });

  app.delete("/api/locations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLocation(id);
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  app.patch("/api/locations/:id/toggle-active", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;
      await storage.toggleLocationActive(id, isActive);
      res.json({ message: "Location status updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid location data" });
    }
  });

  // Vendor routes
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getAllVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

   app.put("/api/vendors/:id", requireAuth, async (req, res) => {
    console.log('--------', req.params.id);
    try {
      const id = parseInt(req.params.id);
      const vendorData = insertVendorSchema.parse(req.body);
      await storage.updateVendor(id, vendorData);
      res.json({ message: "Success Editting" });
    } catch (error) {
      res.status(400).json({ message: "Invalid vendor data" });
    }
  });

  app.delete("/api/vendors/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('----------', id);
      await storage.deleteVendor(id);
      res.json({ message: "Vendor deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete Vendor" });
    }
  });
  // Get vendors for a specific supply
  app.get("/api/supplies/:id/vendors", requireAuth, async (req, res) => {
    try {
      const supplyId = parseInt(req.params.id);
      const vendors = await storage.getVendorsForSupply(supplyId);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors for supply" });
    }
  });

  // Get supplies with stock at a specific location
  app.get("/api/locations/:id/supplies", requireAuth, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const supplies = await storage.getSuppliesAtLocation(locationId);
      res.json(supplies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch supplies at location" });
    }
  });

  // Enhanced Purchase Order Management
  app.get("/api/purchase-orders/enhanced", requireAuth, async (req, res) => {
    try {
      const { fromDate, toDate, status, outstandingOnly } = req.query;
      
      let conditions = [];
      if (fromDate) {
        conditions.push(gte(purchaseOrders.createdAt, new Date(fromDate as string)));
      }
      if (toDate) {
        conditions.push(lte(purchaseOrders.createdAt, new Date(toDate as string)));
      }
      if (status) {
        conditions.push(eq(purchaseOrders.status, status as string));
      }
      
      // Get purchase orders
      const orders = await db.select()
        .from(purchaseOrders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(purchaseOrders.createdAt));
      
      // Get items for each order
      // Batch-load all items for these orders in a single query
      const orderIds = orders.map((o) => o.id);
      const allItems = orderIds.length === 0 ? [] : await db.select({
        id: purchaseOrderItems.id,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        supplyId: purchaseOrderItems.supplyId,
        vendorId: purchaseOrderItems.vendorId,
        locationId: purchaseOrderItems.locationId,
        neededQuantity: purchaseOrderItems.neededQuantity,
        orderQuantity: purchaseOrderItems.orderQuantity,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        pricePerUnit: purchaseOrderItems.pricePerUnit,
        totalPrice: purchaseOrderItems.totalPrice,
        supply: {
          id: supplies.id,
          name: supplies.name,
          hexColor: supplies.hexColor,
          pieceSize: supplies.pieceSize
        },
        location: {
          id: locations.id,
          name: locations.name
        }
      })
      .from(purchaseOrderItems)
      .leftJoin(supplies, eq(purchaseOrderItems.supplyId, supplies.id))
      .leftJoin(locations, eq(purchaseOrderItems.locationId, locations.id))
      .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds));

      const itemsByOrder: Record<number, any[]> = {};
      for (const it of allItems) {
        const list = itemsByOrder[it.purchaseOrderId] || (itemsByOrder[it.purchaseOrderId] = []);
        list.push(it);
      }

      const ordersWithItems = orders.map((order) => {
        const items = itemsByOrder[order.id] || [];
        const filteredItems = (String(outstandingOnly) === 'true')
          ? items.filter((it: any) => (it.orderQuantity || 0) > (it.receivedQuantity || 0))
          : items;
        return { ...order, items: filteredItems };
      });
      
      res.json(ordersWithItems);
    } catch (error) {
      console.error('Get enhanced purchase orders error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/purchase-orders/enhanced", requireAuth, async (req, res) => {
    try {
      const { vendorId, expectedDeliveryDate, notes, items, sendEmail = false } = req.body;
      const userId = req.session.user?.id;
      
      if (!vendorId || !items || items.length === 0) {
        return res.status(400).json({ message: "Vendor and items are required" });
      }
      
      // Generate order number
      const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Calculate total amount
      const totalAmount = items.reduce((sum: number, item: any) => {
        return sum + (item.orderQuantity * item.pricePerUnit);
      }, 0);
      
      // Create purchase order
      const [order] = await db.insert(purchaseOrders)
        .values({
          poNumber,
          status: 'ordered',
          dateOrdered: new Date(),
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          totalAmount,
          additionalComments: notes,
          createdBy: userId || 1 // Fallback to user ID 1 if not available
        })
        .returning();
      
      // Create purchase order items
      const orderItems = await Promise.all(
        items.map(async (item: any) => {
          const [orderItem] = await db.insert(purchaseOrderItems)
            .values({
              purchaseOrderId: order.id,
              supplyId: item.supplyId,
              vendorId: item.vendorId,
              locationId: item.locationId,
              neededQuantity: item.neededQuantity,
              orderQuantity: item.orderQuantity,
              pricePerUnit: item.pricePerUnit,
              totalPrice: item.orderQuantity * item.pricePerUnit
            })
            .returning();
          return orderItem;
        })
      );
      
      // Send email if requested
      if (sendEmail) {
        try {
          // This would integrate with your email service
          console.log(`Sending PO email for order ${poNumber}`);
          // await sendPurchaseOrderEmail(vendorEmail, order, items);
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          // Don't fail the whole request if email fails
        }
      }
      
      res.json({ 
        message: "Purchase order created successfully",
        order: { ...order, items: orderItems }
      });
    } catch (error) {
      console.error('Create enhanced purchase order error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to create purchase order" });
    }
  });

  app.put("/api/purchase-orders/:id/status", requireAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status, dateReceived } = req.body;
      
      const updateData: any = { status };
      if (status === 'received' && dateReceived) {
        updateData.dateReceived = new Date(dateReceived);
      }
      
      await db.update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, orderId));
      
      // If received, update inventory
      if (status === 'received') {
        const orderItems = await db.select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, orderId));
        
        for (const item of orderItems) {
          // Check if supply location exists
          const existingLocation = await db.select()
            .from(supplyLocations)
            .where(and(
              eq(supplyLocations.supplyId, item.supplyId),
              eq(supplyLocations.locationId, item.locationId)
            ));
          
          if (existingLocation.length > 0) {
            // Update existing record
            await db.update(supplyLocations)
              .set({ 
                onHandQuantity: sql`${supplyLocations.onHandQuantity} + ${item.receivedQuantity || item.orderQuantity}`,
                availableQuantity: sql`${supplyLocations.availableQuantity} + ${item.receivedQuantity || item.orderQuantity}`
              })
              .where(and(
                eq(supplyLocations.supplyId, item.supplyId),
                eq(supplyLocations.locationId, item.locationId)
              ));
          } else {
            // Create new record
            await db.insert(supplyLocations)
              .values({
                supplyId: item.supplyId,
                locationId: item.locationId,
                onHandQuantity: item.receivedQuantity || item.orderQuantity,
                availableQuantity: item.receivedQuantity || item.orderQuantity,
                minimumQuantity: 0,
                reorderPoint: 0,
                orderGroupSize: 1
              });
          }
          
          // Create inventory movement record
          await db.insert(inventoryMovements)
            .values({
              supplyId: item.supplyId,
              toLocationId: item.locationId,
              quantity: item.receivedQuantity || item.orderQuantity,
              movementType: 'check_in',
              referenceType: 'purchase_order',
              referenceId: orderId,
              notes: `Received from PO ${orderId}`,
              userId: req.session.user?.id
            });
        }
      }
      
      res.json({ message: "Purchase order status updated successfully" });
    } catch (error) {
      console.error('Update PO status error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to update purchase order status" });
    }
  });

  app.put("/api/purchase-orders/:id/items/:itemId", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const { receivedQuantity } = req.body;
      const [current] = await db.select({
        orderQuantity: purchaseOrderItems.orderQuantity,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
      }).from(purchaseOrderItems).where(eq(purchaseOrderItems.id, parseInt(itemId)));
      const target = Math.max(0, Math.min(parseInt(receivedQuantity), current?.orderQuantity || 0));
      await db.update(purchaseOrderItems)
        .set({ receivedQuantity: target })
        .where(eq(purchaseOrderItems.id, parseInt(itemId)));
      
      res.json({ message: "Purchase order item updated successfully" });
    } catch (error) {
      console.error('Update PO item error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to update purchase order item" });
    }
  });

  app.post("/api/purchase-orders/:id/send-email", requireAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { to, cc, bcc, subject, message } = req.body || {};
      
      // Get order details (schema uses poNumber/dateOrdered/additionalComments). Vendor info is derived from items' vendorIds.
      const [order] = await db.select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        dateOrdered: purchaseOrders.dateOrdered,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        totalAmount: purchaseOrders.totalAmount,
        additionalComments: purchaseOrders.additionalComments,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId));
      
      if (!order) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      
      // Get order items and collect vendor info
      const items = await db.select({
        id: purchaseOrderItems.id,
        supplyId: purchaseOrderItems.supplyId,
        vendorId: purchaseOrderItems.vendorId,
        orderQuantity: purchaseOrderItems.orderQuantity,
        pricePerUnit: purchaseOrderItems.pricePerUnit,
        totalPrice: purchaseOrderItems.totalPrice,
        supply: {
          id: supplies.id,
          name: supplies.name,
          pieceSize: supplies.pieceSize
        }
      })
      .from(purchaseOrderItems)
      .innerJoin(supplies, eq(purchaseOrderItems.supplyId, supplies.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

      // Determine recipient email
      let recipientEmail: string | null = (to as string) || null;
      if (!recipientEmail) {
        if (items.length > 0 && items[0].vendorId) {
          const [vendorRow] = await db.select({
            id: vendors.id,
            email: vendors.email,
          }).from(vendors).where(eq(vendors.id, items[0].vendorId));
          recipientEmail = vendorRow?.email || null;
        }
      }
      if (!recipientEmail) {
        return res.status(400).json({ message: "No recipient email found for this order" });
      }

      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Email service not configured (SENDGRID_API_KEY missing)" });
      }
      sgMail.setApiKey(apiKey);

      const emailSubject = subject || `Purchase Order ${order.poNumber}`;
      const emailBody = message || `Please find details for purchase order ${order.poNumber}.`;

      const itemsRowsHtml = items.map(it => `
        <tr>
          <td style=\"padding:6px 8px;border-bottom:1px solid #eee;\">${it.supply?.name || it.supplyId}</td>
          <td style=\"padding:6px 8px;border-bottom:1px solid #eee;\">${it.orderQuantity}</td>
          <td style=\"padding:6px 8px;border-bottom:1px solid #eee;\">$${(it.pricePerUnit/100).toFixed(2)}</td>
          <td style=\"padding:6px 8px;border-bottom:1px solid #eee;\">$${(it.totalPrice/100).toFixed(2)}</td>
        </tr>
      `).join("");

      const html = `
        <div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;color:#111;\">
          <p>${emailBody}</p>
          <p><strong>PO #:</strong> ${order.poNumber}</p>
          <table style=\"width:100%;border-collapse:collapse;margin-top:10px;\">
            <thead>
              <tr>
                <th style=\"text-align:left;padding:6px 8px;border-bottom:2px solid #333;\">Item</th>
                <th style=\"text-align:left;padding:6px 8px;border-bottom:2px solid #333;\">Qty</th>
                <th style=\"text-align:left;padding:6px 8px;border-bottom:2px solid #333;\">Price</th>
                <th style=\"text-align:left;padding:6px 8px;border-bottom:2px solid #333;\">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>
          <p style=\"margin-top:10px;\"><strong>PO Total:</strong> $${(order.totalAmount/100).toFixed(2)}</p>
        </div>
      `;

      const msg: any = {
        to: recipientEmail,
        from: process.env.SENDGRID_FROM_EMAIL || recipientEmail,
        subject: emailSubject,
        html,
      };
      if (cc) msg.cc = cc;
      if (bcc) msg.bcc = bcc;

      await sgMail.send(msg);

      await db.update(purchaseOrders)
        .set({
          vendorEmail: recipientEmail,
          emailSubject: emailSubject,
          additionalComments: (order.additionalComments || "") + (message ? `\n\nEmail: ${message}` : ""),
          sendEmail: true,
          updatedAt: new Date()
        })
        .where(eq(purchaseOrders.id, orderId));

      res.json({ message: "Purchase order email sent successfully" });
    } catch (error) {
      console.error('Send PO email error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to send purchase order email" });
    }
  });

  // User management routes (Super Admin only)
  app.get("/api/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, createdAt: u.createdAt })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireSuperAdmin, async (req, res) => {
    try {
      const { username, email, password, role } = insertUserSchema.parse(req.body);
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      if (!['user', 'admin', 'super_admin'].includes(role || '')) {
        return res.status(400).json({ message: "Invalid role specified" });
      }

      // Check if username already exists (case-insensitive)
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username: (username || '').toLowerCase(), // Store username in lowercase
        email,
        password: hashedPassword,
        role: role || 'admin'
      });
      
      res.json({ id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt });
    } catch (error: any) {
      console.error('Create user error:', error);
      if (error.message?.includes('duplicate key') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "Username already exists" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { username, email, password, role } = req.body;
      
      if (role && !['user', 'admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }

      const updateData: any = {};
      
      // Handle username update with case-insensitive check
      if (username) {
        const lowerUsername = username.toLowerCase();
        // Check if this username is already taken by another user
        const existingUser = await storage.getUserByUsername(lowerUsername);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Username already exists" });
        }
        updateData.username = lowerUsername;
      }
      
      if (email !== undefined) updateData.email = email || null;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      if (role) updateData.role = role;

      const user = await storage.updateUser(userId, updateData);
      
      res.json({ id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt });
    } catch (error: any) {
      console.error('Update user error:', error);
      if (error.message?.includes('duplicate key') || error.message?.includes('unique')) {
        return res.status(400).json({ message: "Username already exists" });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Prevent deleting yourself
      if (id === req.session.user?.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });



  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const { sheetsFrom, sheetsTo, timeFrom, timeTo } = req.query;
      const stats = await storage.getDashboardStats(
        sheetsFrom as string | undefined,
        sheetsTo as string | undefined,
        timeFrom as string | undefined,
        timeTo as string | undefined
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Setup initial admin user
  app.post("/api/setup", async (req, res) => {
    
    try {
      // Check if any users exist
      console.log(req.body);
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.length > 0) {
        return res.status(400).json({ message: "Setup already completed" });
      }

      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.createUser({
        username: username.toLowerCase(), // Store username in lowercase
        password: hashedPassword,
        role: 'super_admin'
      });
      res.json({ message: "Initial admin user created successfully" });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({ message: "Setup failed" });
    }
  });

  app.get("/api/setup/required", async (req, res) => {
    try {
      const existingUsers = await storage.getAllUsers();
      res.json({ required: existingUsers.length === 0 });
    } catch (error) {
      console.error('Setup check error:', error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const { name, company, contact_info } = req.body;
      const vendor = await storage.createOneVendor({
        name: name.toLowerCase(), 
        company: company,
        contactInfo: contact_info
      });
      res.json(vendor);
    } catch (error) {
      console.error('Creating error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Vendor failed" });
    }
  })

  // Remove duplicate/incorrect vendors route (typo missing leading slash)
  // app.get("api/vendors", ...) was incorrect; proper route exists above with requireAuth
  /*
  app.get("api/vendors", async (req, res) => {
     try {
      const existingVendors = await storage.getAllVendors();
      res.json({ required: existingVendors.length === 0 });
    } catch (error) {
      console.error('Setup check error:', error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  })
  */

  // Enhanced inventory management routes
  // Check-in/Check-out operations
  app.post("/api/inventory/check-in", requireAuth, async (req, res) => {
    try {
      const { supplyId, locationId, quantity, referenceType, referenceId, notes } = req.body;
      const userId = req.session.user?.id;
      
      if (!supplyId || !locationId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid check-in data" });
      }
      
      // Create inventory movement record
      await db.insert(inventoryMovements).values({
        supplyId,
        toLocationId: locationId,
        quantity,
        movementType: 'check_in',
        referenceType,
        referenceId,
        notes,
        userId
      });
      
      // Update supply location quantity
      const existingLocation = await db.select()
        .from(supplyLocations)
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, locationId)
        ));
      
      if (existingLocation.length > 0) {
        // Update existing record
        await db.update(supplyLocations)
          .set({ 
            onHandQuantity: sql`${supplyLocations.onHandQuantity} + ${quantity}`,
            availableQuantity: sql`${supplyLocations.availableQuantity} + ${quantity}`
          })
          .where(and(
            eq(supplyLocations.supplyId, supplyId),
            eq(supplyLocations.locationId, locationId)
          ));
      } else {
        // Create new record
        await db.insert(supplyLocations).values({
          supplyId,
          locationId,
          onHandQuantity: quantity,
          availableQuantity: quantity,
          minimumQuantity: 0,
          reorderPoint: 0,
          orderGroupSize: 1
        });
      }
      
      res.json({ message: "Inventory checked in successfully" });
    } catch (error) {
      console.error('Check-in error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to check in inventory" });
    }
  });

  app.post("/api/inventory/check-out", requireAuth, async (req, res) => {
    try {
      const { supplyId, locationId, quantity, referenceType, referenceId, notes } = req.body;
      const userId = req.session.user?.id;
      
      if (!supplyId || !locationId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid check-out data" });
      }
      
      // Check if enough inventory is available
      const currentStock = await db.select()
        .from(supplyLocations)
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, locationId)
        ));
      
      if (currentStock.length === 0 || currentStock[0].availableQuantity < quantity) {
        return res.status(400).json({ message: "Insufficient inventory available" });
      }
      
      // Create inventory movement record
      await db.insert(inventoryMovements).values({
        supplyId,
        fromLocationId: locationId,
        quantity,
        movementType: 'check_out',
        referenceType,
        referenceId,
        notes,
        userId
      });
      
      // Update supply location quantity
      await db.update(supplyLocations)
        .set({ 
          onHandQuantity: sql`${supplyLocations.onHandQuantity} - ${quantity}`,
          availableQuantity: sql`${supplyLocations.availableQuantity} - ${quantity}`
        })
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, locationId)
        ));
      
      res.json({ message: "Inventory checked out successfully" });
    } catch (error) {
      console.error('Check-out error:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to check out inventory" });
    }
  });

  app.post("/api/inventory/transfer", requireAuth, async (req, res) => {
    try {
      const { supplyId, fromLocationId, toLocationId, quantity, notes } = req.body;
      const userId = req.session.user?.id;
      
      if (!supplyId || !fromLocationId || !toLocationId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid transfer data" });
      }
      
      // Check if enough inventory is available at source location
      const sourceStock = await db.select()
        .from(supplyLocations)
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, fromLocationId)
        ));
      
      if (sourceStock.length === 0 || sourceStock[0].availableQuantity < quantity) {
        return res.status(400).json({ message: "Insufficient inventory at source location" });
      }
      
      // Create inventory movement record
      await db.insert(inventoryMovements).values({
        supplyId,
        fromLocationId,
        toLocationId,
        quantity,
        movementType: 'transfer',
        notes,
        userId
      });
      
      // Update source location quantity
      await db.update(supplyLocations)
        .set({ 
          onHandQuantity: sql`${supplyLocations.onHandQuantity} - ${quantity}`,
          availableQuantity: sql`${supplyLocations.availableQuantity} - ${quantity}`
        })
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, fromLocationId)
        ));
      
      // Update or create destination location quantity
      const destLocation = await db.select()
        .from(supplyLocations)
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, toLocationId)
        ));
      
      if (destLocation.length > 0) {
        await db.update(supplyLocations)
          .set({ 
            onHandQuantity: sql`${supplyLocations.onHandQuantity} + ${quantity}`,
            availableQuantity: sql`${supplyLocations.availableQuantity} + ${quantity}`
          })
          .where(and(
            eq(supplyLocations.supplyId, supplyId),
            eq(supplyLocations.locationId, toLocationId)
          ));
      } else {
        await db.insert(supplyLocations).values({
          supplyId,
          locationId: toLocationId,
          onHandQuantity: quantity,
          availableQuantity: quantity,
          minimumQuantity: 0,
          reorderPoint: 0,
          orderGroupSize: 1
        });
      }
      
      res.json({ message: "Inventory transferred successfully" });
    } catch (error) {
      console.error('Transfer error:', error);
      res.status(500).json({ message: "Failed to transfer inventory" });
    }
  });

  app.post("/api/inventory/adjust", requireAuth, async (req, res) => {
    try {
      const { supplyId, locationId, quantity, notes } = req.body;
      const userId = req.session.user?.id;
      
      if (!supplyId || !locationId || !quantity) {
        return res.status(400).json({ message: "Invalid adjustment data" });
      }
      
      // Create inventory movement record
      await db.insert(inventoryMovements).values({
        supplyId,
        toLocationId: locationId,
        quantity: Math.abs(quantity),
        movementType: 'adjust',
        notes,
        userId
      });
      
      // Update supply location quantity
      const existingLocation = await db.select()
        .from(supplyLocations)
        .where(and(
          eq(supplyLocations.supplyId, supplyId),
          eq(supplyLocations.locationId, locationId)
        ));
      
      if (existingLocation.length > 0) {
        await db.update(supplyLocations)
          .set({ 
            onHandQuantity: sql`${supplyLocations.onHandQuantity} + ${quantity}`,
            availableQuantity: sql`${supplyLocations.availableQuantity} + ${quantity}`
          })
          .where(and(
            eq(supplyLocations.supplyId, supplyId),
            eq(supplyLocations.locationId, locationId)
          ));
      } else if (quantity > 0) {
        await db.insert(supplyLocations).values({
          supplyId,
          locationId,
          onHandQuantity: quantity,
          availableQuantity: quantity,
          minimumQuantity: 0,
          reorderPoint: 0,
          orderGroupSize: 1
        });
      }
      
      res.json({ message: "Inventory adjusted successfully" });
    } catch (error) {
      console.error('Adjustment error:', error);
      res.status(500).json({ message: "Failed to adjust inventory" });
    }
  });

  // Inventory movements
  app.get("/api/inventory/movements", requireAuth, async (req, res) => {
    try {
      const { supplyId, locationId, fromDate, toDate } = req.query;
      
      let conditions = [];
      if (supplyId) {
        conditions.push(eq(inventoryMovements.supplyId, parseInt(supplyId as string)));
      }
      if (locationId) {
        conditions.push(or(
          eq(inventoryMovements.fromLocationId, parseInt(locationId as string)),
          eq(inventoryMovements.toLocationId, parseInt(locationId as string))
        ));
      }
      if (fromDate) {
        conditions.push(gte(inventoryMovements.createdAt, new Date(fromDate as string)));
      }
      if (toDate) {
        conditions.push(lte(inventoryMovements.createdAt, new Date(toDate as string)));
      }
      
      const movements = await db.select({
        id: inventoryMovements.id,
        supplyId: inventoryMovements.supplyId,
        fromLocationId: inventoryMovements.fromLocationId,
        toLocationId: inventoryMovements.toLocationId,
        quantity: inventoryMovements.quantity,
        movementType: inventoryMovements.movementType,
        referenceType: inventoryMovements.referenceType,
        referenceId: inventoryMovements.referenceId,
        notes: inventoryMovements.notes,
        createdAt: inventoryMovements.createdAt,
        supply: {
          id: supplies.id,
          name: supplies.name,
          hexColor: supplies.hexColor
        },
        fromLocation: {
          id: locations.id,
          name: locations.name
        },
        toLocation: {
          id: locations.id,
          name: locations.name
        }
      })
      .from(inventoryMovements)
      .leftJoin(supplies, eq(inventoryMovements.supplyId, supplies.id))
      .leftJoin(locations, eq(inventoryMovements.fromLocationId, locations.id))
      .leftJoin(locations, eq(inventoryMovements.toLocationId, locations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryMovements.createdAt));
      
      res.json(movements);
    } catch (error) {
      console.error('Get movements error:', error);
      res.status(500).json({ message: "Failed to fetch inventory movements" });
    }
  });

  // Email center basic endpoints
  app.get("/api/emails", requireAuth, async (req, res) => {
    try {
      const { folder = 'sent', q } = req.query as any;
      let results = await db.select().from(emails).where(eq(emails.folder, folder as string));
      if (q) {
        const query = (q as string).toLowerCase();
        results = results.filter((e: any) =>
          (e.subject || '').toLowerCase().includes(query) ||
          (e.to || '').toLowerCase().includes(query) ||
          (e.from || '').toLowerCase().includes(query)
        );
      }
      res.json(results);
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch emails' });
    }
  });

  app.post("/api/emails", requireAuth, async (req, res) => {
    try {
      const { from, to, cc, bcc, subject, body, status, scheduledAt } = req.body || {};
      const defaultFrom = process.env.SENDGRID_FROM_EMAIL || (req.session?.user?.email ? req.session.user.email : 'noreply@cnc-job-manager.local');
      const fromEmail = from || defaultFrom;
      if (!to && status !== 'draft') {
        return res.status(400).json({ message: 'Recipient (to) is required unless saving a draft' });
      }
      const safeStatus = (status === 'draft' || status === 'scheduled' || status === 'sent') ? status : 'sent';
      const folder = safeStatus === 'draft' ? 'drafts' : (safeStatus === 'scheduled' ? 'scheduled' : 'sent');
      const [saved] = await db.insert(emails).values({ from: fromEmail, to: to || '', cc, bcc, subject, body, folder, status: safeStatus, scheduledAt: scheduledAt ? new Date(scheduledAt) : null }).returning();
      res.json(saved);
    } catch (e) {
      res.status(500).json({ message: 'Failed to store email' });
    }
  });

  app.delete("/api/emails/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.update(emails).set({ folder: 'trash' }).where(eq(emails.id, id));
      res.json({ message: 'Moved to trash' });
    } catch (e) {
      res.status(500).json({ message: 'Failed to delete email' });
    }
  });

  // Reorder management
  app.get("/api/inventory/need-to-purchase", requireAuth, async (req, res) => {
    try {
      // Compute outstanding on-order amount per supply/location from open POs
      const onOrderAgg = await db
        .select({
          supplyId: purchaseOrderItems.supplyId,
          locationId: purchaseOrderItems.locationId,
          outstanding: sql<number>`SUM(GREATEST(${purchaseOrderItems.orderQuantity} - ${purchaseOrderItems.receivedQuantity}, 0))`,
        })
        .from(purchaseOrderItems)
        .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .where(
          or(
            eq(purchaseOrders.status, 'ordered'),
            eq(purchaseOrders.status, 'partially_received')
          )
        )
        .groupBy(purchaseOrderItems.supplyId, purchaseOrderItems.locationId);

      const outstandingByKey: Record<string, number> = {};
      for (const row of onOrderAgg) {
        if (row.supplyId && row.locationId) {
          outstandingByKey[`${row.supplyId}-${row.locationId}`] = Number(row.outstanding) || 0;
        }
      }

      const rows = await db.select({
        supplyId: supplyLocations.supplyId,
        locationId: supplyLocations.locationId,
        onHandQuantity: supplyLocations.onHandQuantity,
        allocatedQuantity: supplyLocations.allocatedQuantity,
        availableQuantity: supplyLocations.availableQuantity,
        minimumQuantity: supplyLocations.minimumQuantity,
        reorderPoint: supplyLocations.reorderPoint,
        orderGroupSize: supplyLocations.orderGroupSize,
        supply: {
          id: supplies.id,
          name: supplies.name,
          hexColor: supplies.hexColor,
          pieceSize: supplies.pieceSize,
          partNumber: supplies.partNumber,
        },
        location: {
          id: locations.id,
          name: locations.name
        }
      })
      .from(supplyLocations)
      .innerJoin(supplies, eq(supplyLocations.supplyId, supplies.id))
      .innerJoin(locations, eq(supplyLocations.locationId, locations.id))
      .where(
        or(
          lte(supplyLocations.availableQuantity, supplyLocations.minimumQuantity),
          lte(supplyLocations.availableQuantity, supplyLocations.reorderPoint)
        )
      )
      .orderBy(supplies.name);

      const enriched = rows.map((r) => {
        const available = (r.availableQuantity ?? (r.onHandQuantity - (r.allocatedQuantity || 0))) || 0;
        const threshold = Math.max(r.minimumQuantity || 0, r.reorderPoint || 0);
        let base = Math.max(0, threshold - available);
        if ((r.allocatedQuantity || 0) > 0 && base < (r.allocatedQuantity || 0)) {
          base = r.allocatedQuantity || 0;
        }
        // Subtract outstanding on-order amount so we don't double-order
        const key = `${r.supplyId}-${r.locationId}`;
        const outstanding = outstandingByKey[key] || 0;
        base = Math.max(0, base - outstanding);
        const group = Math.max(1, r.orderGroupSize || 1);
        const suggestedOrderQty = base <= 0 ? 0 : Math.ceil(base / group) * group;
        return { ...r, available, suggestedOrderQty };
      });

      // Merge manual need-to-purchase items from session (persist across refresh per user)
      const manualItems: Array<{ supplyId: number; locationId: number; quantity: number }> = (req.session as any).manualNeedToPurchase || [];
      const manualByKey: Record<string, number> = {};
      for (const m of manualItems) {
        if (!m || !m.supplyId || !m.locationId) continue;
        const k = `${m.supplyId}-${m.locationId}`;
        manualByKey[k] = (manualByKey[k] || 0) + Math.max(0, Number(m.quantity) || 0);
      }

      const enrichedByKey: Record<string, any> = {};
      for (const r of enriched) {
        enrichedByKey[`${r.supplyId}-${r.locationId}`] = r;
      }

      // For any manual entry not already present, fetch its stock row so we can display it
      const missingKeys = Object.keys(manualByKey).filter((k) => !enrichedByKey[k]);
      if (missingKeys.length > 0) {
        const parts = missingKeys.map((k) => k.split('-').map((n) => parseInt(n, 10))).filter(([s, l]) => s && l);
        const supplyIds = parts.map(([s]) => s);
        const locationIds = parts.map(([_, l]) => l);
        const extraRows = await db.select({
            supplyId: supplyLocations.supplyId,
            locationId: supplyLocations.locationId,
            onHandQuantity: supplyLocations.onHandQuantity,
            allocatedQuantity: supplyLocations.allocatedQuantity,
            availableQuantity: supplyLocations.availableQuantity,
            minimumQuantity: supplyLocations.minimumQuantity,
            reorderPoint: supplyLocations.reorderPoint,
            orderGroupSize: supplyLocations.orderGroupSize,
            supply: {
              id: supplies.id,
              name: supplies.name,
              hexColor: supplies.hexColor,
              pieceSize: supplies.pieceSize,
              partNumber: supplies.partNumber,
            },
            location: {
              id: locations.id,
              name: locations.name
            }
          })
          .from(supplyLocations)
          .innerJoin(supplies, eq(supplyLocations.supplyId, supplies.id))
          .innerJoin(locations, eq(supplyLocations.locationId, locations.id))
          .where(and(inArray(supplyLocations.supplyId, supplyIds), inArray(supplyLocations.locationId, locationIds)));

        for (const row of extraRows) {
          const available = (row.availableQuantity ?? (row.onHandQuantity - (row.allocatedQuantity || 0))) || 0;
          enrichedByKey[`${row.supplyId}-${row.locationId}`] = { ...row, available, suggestedOrderQty: 0 };
        }
      }

      // Apply manual quantity overrides
      for (const k of Object.keys(manualByKey)) {
        if (enrichedByKey[k]) {
          enrichedByKey[k].suggestedOrderQty = Math.max(1, manualByKey[k]);
        }
      }

      // Apply per-user qty overrides from session (persist input across refresh)
      const overrides: Record<string, number> = (req.session as any).needToPurchaseOverrides || {};
      for (const k of Object.keys(overrides)) {
        if (enrichedByKey[k]) {
          const q = Number(overrides[k]);
          if (!Number.isNaN(q) && q >= 0) {
            enrichedByKey[k].suggestedOrderQty = q;
          }
        }
      }

      res.json(Object.values(enrichedByKey));
    } catch (error) {
      console.error('Need to purchase error:', error);
      res.status(500).json({ message: "Failed to fetch need to purchase data" });
    }
  });

  // Add a manual Need To Purchase item to the current user's session
  app.post("/api/inventory/need-to-purchase/manual", requireAuth, async (req, res) => {
    try {
      const { supplyId, locationId, quantity } = req.body || {};
      const sid = parseInt(supplyId);
      const lid = parseInt(locationId);
      const qty = Math.max(1, parseInt(quantity));
      if (!sid || !lid || !qty) {
        return res.status(400).json({ message: 'supplyId, locationId and quantity are required' });
      }
      const sess: any = req.session;
      if (!sess.manualNeedToPurchase) sess.manualNeedToPurchase = [];
      sess.manualNeedToPurchase.push({ supplyId: sid, locationId: lid, quantity: qty });
      await new Promise((resolve, reject) => sess.save((err: any) => err ? reject(err) : resolve(null)));
      res.json({ message: 'Added', item: { supplyId: sid, locationId: lid, quantity: qty } });
    } catch (error) {
      console.error('Add manual need-to-purchase error:', error);
      res.status(500).json({ message: 'Failed to add manual item' });
    }
  });

  // Persist a per-user override for Qty to order (by supply/location)
  app.post("/api/inventory/need-to-purchase/override", requireAuth, async (req, res) => {
    try {
      const { supplyId, locationId, quantity } = req.body || {};
      const sid = parseInt(supplyId);
      const lid = parseInt(locationId);
      const qty = Number(quantity);
      if (!sid || !lid || Number.isNaN(qty) || qty < 0) {
        return res.status(400).json({ message: 'supplyId, locationId and non-negative quantity are required' });
      }
      const key = `${sid}-${lid}`;
      const sess: any = req.session;
      if (!sess.needToPurchaseOverrides) sess.needToPurchaseOverrides = {};
      sess.needToPurchaseOverrides[key] = qty;
      await new Promise((resolve, reject) => sess.save((err: any) => err ? reject(err) : resolve(null)));
      res.json({ message: 'Override saved', key, quantity: qty });
    } catch (error) {
      console.error('Save need-to-purchase override error:', error);
      res.status(500).json({ message: 'Failed to save override' });
    }
  });

  app.get("/api/inventory/alerts", requireAuth, async (req, res) => {
    try {
      const alerts = await db.select({
        id: inventoryAlerts.id,
        supplyId: inventoryAlerts.supplyId,
        locationId: inventoryAlerts.locationId,
        alertType: inventoryAlerts.alertType,
        message: inventoryAlerts.message,
        isRead: inventoryAlerts.isRead,
        isResolved: inventoryAlerts.isResolved,
        createdAt: inventoryAlerts.createdAt,
        supply: {
          id: supplies.id,
          name: supplies.name,
          hexColor: supplies.hexColor
        },
        location: {
          id: locations.id,
          name: locations.name
        }
      })
      .from(inventoryAlerts)
      .innerJoin(supplies, eq(inventoryAlerts.supplyId, supplies.id))
      .innerJoin(locations, eq(inventoryAlerts.locationId, locations.id))
      .where(eq(inventoryAlerts.isResolved, false))
      .orderBy(desc(inventoryAlerts.createdAt));
      
      res.json(alerts);
    } catch (error) {
      console.error('Get alerts error:', error);
      res.status(500).json({ message: "Failed to fetch inventory alerts" });
    }
  });

  app.post("/api/inventory/alerts/:id/resolve", requireAuth, async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);
      
      await db.update(inventoryAlerts)
        .set({ isResolved: true })
        .where(eq(inventoryAlerts.id, alertId));
      
      res.json({ message: "Alert resolved successfully" });
    } catch (error) {
      console.error('Resolve alert error:', error);
      res.status(500).json({ message: "Failed to resolve alert" });
    }
  });

  // Location categories
  app.get("/api/location-categories", requireAuth, async (req, res) => {
    try {
      const categories = await db.select()
        .from(locationCategories)
        .where(eq(locationCategories.isActive, true))
        .orderBy(locationCategories.sortOrder, locationCategories.name);
      
      res.json(categories);
    } catch (error) {
      console.error('Get location categories error:', error);
      res.status(500).json({ message: "Failed to fetch location categories" });
    }
  });

  app.post("/api/location-categories", requireAuth, async (req, res) => {
    try {
      const { name, description, sortOrder } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }
      
      const category = await db.insert(locationCategories)
        .values({ name, description, sortOrder: sortOrder || 0 })
        .returning();
      
      res.json(category[0]);
    } catch (error) {
      console.error('Create location category error:', error);
      res.status(500).json({ message: "Failed to create location category" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket setup for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  function broadcastToClients(message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  return httpServer;
}
