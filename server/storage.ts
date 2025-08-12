import { 
  users, jobs, cutlists, jobMaterials, colors, colorGroups, jobTimeLogs, recutEntries, sheetCutLogs,
  locations, supplies, supplyVendors, supplyLocations, supplyTransactions, vendors, purchaseOrders, purchaseOrderItems,
  locationCategories, inventoryMovements, vendorContacts, inventoryAlerts,
  type User, type InsertUser, type Job, type JobWithMaterials, 
  type Color, type ColorGroup, type InsertColor, type InsertColorGroup,
  type JobMaterial, type InsertJobMaterial, type CreateJob,
  type ColorWithGroup, type JobTimeLog, type Cutlist, type InsertCutlist,
  type CutlistWithMaterials, type JobWithCutlists, type RecutEntry,
  type Location, type InsertLocation, type Supply, type InsertSupply,
  type SupplyWithLocation, type SupplyTransaction, type InsertSupplyTransaction,
  type Vendor, type InsertVendor, type PurchaseOrderWithItems, type InsertPurchaseOrder, type InsertPurchaseOrderItem,
  type LocationCategory, type InsertLocationCategory, type InventoryMovement, type InsertInventoryMovement
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, sql, inArray, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  // Vendor management
  getAllVendors(): Promise<Vendor[]>;
  createOneVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendorData: Partial<InsertVendor>): Promise<void>;
  deleteVendor(id: number): Promise<void>;
  // Job management
  createJob(jobData: CreateJob): Promise<JobWithMaterials>;
  getJob(id: number): Promise<JobWithMaterials | undefined>;
  getAllJobs(search?: string, status?: string): Promise<JobWithMaterials[]>;
  updateJobStatus(id: number, status: string): Promise<void>;
  startJobTimer(jobId: number, userId?: number): Promise<void>;
  stopJobTimer(jobId: number): Promise<void>;
  startJob(id: number, userId: number): Promise<void>;
  pauseJob(id: number): Promise<void>;
  resumeJob(id: number): Promise<void>;
  completeJob(id: number): Promise<void>;
  deleteJob(jobId: number): Promise<void>;
  updateMaterialProgress(materialId: number, completedSheets: number): Promise<void>;
  updateSheetStatus(materialId: number, sheetIndex: number, status: string, userId?: number): Promise<void>;
  deleteSheet(materialId: number, sheetIndex: number): Promise<void>;
  addSheetsToMaterial(materialId: number, additionalSheets: number, isRecut?: boolean): Promise<void>;
  addMaterialToJob(jobId: number, colorId: number, totalSheets: number): Promise<void>;
  deleteMaterial(materialId: number): Promise<void>;
  deleteRecutEntry(recutId: number): Promise<void>;
  
  // Recut management
  addRecutEntry(materialId: number, quantity: number, reason?: string, userId?: number): Promise<void>;
  getRecutEntries(materialId: number): Promise<any[]>;
  updateRecutSheetStatus(recutId: number, sheetIndex: number, status: string, userId?: number): Promise<void>;
  
  // Sheet cutting tracking
  logSheetCut(materialId: number, sheetIndex: number, status: string, isRecut?: boolean, recutId?: number, userId?: number): Promise<void>;
  getSheetCutLogs(materialId: number, fromDate?: Date, toDate?: Date): Promise<any[]>;

  // Cutlist management
  createCutlists(jobId: number, count: number): Promise<Cutlist[]>;
  deleteCutlist(cutlistId: number): Promise<void>;
  getCutlistsForJob(jobId: number): Promise<CutlistWithMaterials[]>;

  // Color management
  getAllColors(): Promise<ColorWithGroup[]>;
  createColor(color: InsertColor): Promise<Color>;
  updateColor(id: number, color: Partial<InsertColor>): Promise<void>;
  deleteColor(id: number): Promise<void>;
  searchColors(query: string): Promise<ColorWithGroup[]>;

  // Color group management
  getAllColorGroups(): Promise<ColorGroup[]>;
  createColorGroup(group: InsertColorGroup): Promise<ColorGroup>;
  updateColorGroup(id: number, name: string): Promise<void>;
  deleteColorGroup(id: number): Promise<void>;

  // Supply management (new)
  getAllSupplies(): Promise<SupplyWithLocation[]>;
  getSupply(id: number): Promise<any>;
  createSupply(supply: InsertSupply): Promise<Supply>;
  updateSupply(id: number, supply: Partial<InsertSupply>): Promise<void>;
  deleteSupply(id: number): Promise<void>;
  searchSupplies(query: string): Promise<SupplyWithLocation[]>;
  updateSupplyQuantity(id: number, quantity: number, type: 'receive' | 'use' | 'adjust', description?: string, jobId?: number, userId?: number): Promise<void>;
  allocateSupplyForJob(supplyId: number, quantity: number, jobId: number, userId?: number): Promise<void>;

  // Location management (new)
  getAllLocations(): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, name: string, description?: string): Promise<void>;
  deleteLocation(id: number): Promise<void>;
  toggleLocationActive(id: number, isActive: boolean): Promise<void>;
  getSuppliesAtLocation(locationId: number): Promise<any[]>;

  // Enhanced inventory management (new)
  // Check-in/Check-out operations
  checkInInventory(supplyId: number, locationId: number, quantity: number, referenceType?: string, referenceId?: number, notes?: string, userId?: number): Promise<void>;
  checkOutInventory(supplyId: number, locationId: number, quantity: number, referenceType?: string, referenceId?: number, notes?: string, userId?: number): Promise<void>;
  transferInventory(supplyId: number, fromLocationId: number, toLocationId: number, quantity: number, notes?: string, userId?: number): Promise<void>;
  adjustInventory(supplyId: number, locationId: number, quantity: number, notes?: string, userId?: number): Promise<void>;
  
  // Inventory movements
  getInventoryMovements(supplyId?: number, locationId?: number, fromDate?: Date, toDate?: Date): Promise<any[]>;
  getInventoryMovement(id: number): Promise<any>;
  
  // Reorder management
  getNeedToPurchase(): Promise<any[]>;
  getReorderSuggestions(): Promise<any[]>;
  updateReorderPoint(supplyLocationId: number, reorderPoint: number): Promise<void>;
  getInventoryAlerts(): Promise<any[]>;
  resolveInventoryAlert(alertId: number): Promise<void>;
  
  // Location categories
  getAllLocationCategories(): Promise<any[]>;
  createLocationCategory(category: any): Promise<any>;
  updateLocationCategory(id: number, category: any): Promise<void>;
  deleteLocationCategory(id: number): Promise<void>;

  // Purchase order management
  getAllPurchaseOrders(fromDate?: string, toDate?: string): Promise<PurchaseOrderWithItems[]>;
  createPurchaseOrder(orderData: InsertPurchaseOrder, items: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithItems>;
  updatePurchaseOrderReceived(id: number, dateReceived: Date): Promise<void>;
  getAllVendors(): Promise<Vendor[]>;
  getVendorsForSupply(supplyId: number): Promise<Vendor[]>;

  // Dashboard stats
  getDashboardStats(sheetsFrom?: string, sheetsTo?: string, timeFrom?: string, timeTo?: string): Promise<{
    activeJobs: number;
    sheetsCutToday: number;
    avgJobTime: number;
    avgSheetTime: number;
    materialColors: number;
    jobsByStatus: { waiting: number; in_progress: number; done: number };
  }>;
}

export class DatabaseStorage implements IStorage {
  // Helper function to calculate job status based on sheet completion
  private async calculateJobStatus(job: JobWithMaterials): Promise<string> {
    let totalSheets = 0;
    let completedSheets = 0;
    let skippedSheets = 0;
    let hasAnyActivity = false; // Track if any sheets have been marked (cut or skipped)
    
    // Count original material sheets
    for (const cutlist of job.cutlists || []) {
      for (const material of cutlist.materials || []) {
        const sheetStatuses = material.sheetStatuses || [];
        const cutCount = sheetStatuses.filter(status => status === 'cut').length;
        const skipCount = sheetStatuses.filter(status => status === 'skip').length;
        
        totalSheets += material.totalSheets;
        completedSheets += cutCount;
        skippedSheets += skipCount;
        
        // Check if any sheets have been marked (cut or skipped)
        if (cutCount > 0 || skipCount > 0) {
          hasAnyActivity = true;
        }
        
        // Get recut entries for this material
        const materialRecutEntries = await db.select().from(recutEntries).where(eq(recutEntries.materialId, material.id));
        
        // Add recut sheets
        for (const recut of materialRecutEntries) {
          const recutStatuses = recut.sheetStatuses || [];
          const recutCutCount = recutStatuses.filter((s: string) => s === 'cut').length;
          const recutSkipCount = recutStatuses.filter((s: string) => s === 'skip').length;
          
          totalSheets += recut.quantity;
          completedSheets += recutCutCount;
          skippedSheets += recutSkipCount;
          
          // Check if any recut sheets have been marked
          if (recutCutCount > 0 || recutSkipCount > 0) {
            hasAnyActivity = true;
          }
        }
      }
    }
    
    // Calculate effective total (excluding skipped sheets)
    const effectiveTotalSheets = totalSheets - skippedSheets;
    
    // Determine status based on activity and completion
    if (!hasAnyActivity) {
      return 'waiting'; // No sheets have been marked at all
    } else if (completedSheets < effectiveTotalSheets) {
      return 'in_progress'; // Some activity but not all non-skipped sheets are cut
    } else {
      return 'done'; // All non-skipped sheets are cut
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Always search using lowercase for case-insensitive lookup
    const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }



  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.username);
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async createJob(jobData: CreateJob): Promise<JobWithMaterials> {
    const jobNumber = `JOB-${Date.now()}`;
    
    const [job] = await db.insert(jobs).values({
      jobNumber,
      customerName: jobData.customerName,
      jobName: jobData.jobName,
    }).returning();

    // Create first cutlist
    const [cutlist] = await db.insert(cutlists).values({
      jobId: job.id,
      name: "Cutlist 1",
      orderIndex: 1,
    }).returning();

    // Insert materials into the first cutlist
    const materialPromises = jobData.materials.map(material =>
      db.insert(jobMaterials).values({
        cutlistId: cutlist.id,
        supplyId: material.colorId, // colorId is actually supplyId from the frontend
        totalSheets: material.totalSheets,
      }).returning()
    );

    await Promise.all(materialPromises);

    return this.getJob(job.id) as Promise<JobWithMaterials>;
  }

  async getJob(id: number): Promise<JobWithMaterials | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) return undefined;

    // Get cutlists for this job
    const jobCutlists = await db
      .select()
      .from(cutlists)
      .where(eq(cutlists.jobId, id))
      .orderBy(cutlists.orderIndex);

    // For each cutlist, get materials with colors and recut entries
    const cutlistsWithMaterials = await Promise.all(
      jobCutlists.map(async (cutlist) => {
        const materials = await db
          .select({
            id: jobMaterials.id,
            cutlistId: jobMaterials.cutlistId,
            supplyId: jobMaterials.supplyId,
            totalSheets: jobMaterials.totalSheets,
            completedSheets: jobMaterials.completedSheets,
            sheetStatuses: jobMaterials.sheetStatuses,
            createdAt: jobMaterials.createdAt,
            color: {
              id: supplies.id,
              name: supplies.name,
              hexColor: supplies.hexColor,
              groupId: sql`NULL`, // Map locationId to groupId for backward compatibility
              texture: supplies.texture,
              createdAt: supplies.createdAt,
            }
          })
          .from(jobMaterials)
          .innerJoin(supplies, eq(jobMaterials.supplyId, supplies.id))
          .where(eq(jobMaterials.cutlistId, cutlist.id));

        // For each material, get recut entries
        const materialsWithRecuts = await Promise.all(
          materials.map(async (material) => {
            const recutEntries = await this.getRecutEntries(material.id);
            return {
              ...material,
              recutEntries
            };
          })
        );

        return {
          ...cutlist,
          materials: materialsWithRecuts
        };
      })
    );

    // Get time logs
    const timeLogs = await db
      .select()
      .from(jobTimeLogs)
      .where(eq(jobTimeLogs.jobId, id));

    // For backward compatibility, flatten all materials from all cutlists
    const allMaterials = cutlistsWithMaterials.flatMap(cutlist => cutlist.materials || []);

    const jobWithMaterials = {
      ...job,
      cutlists: cutlistsWithMaterials as CutlistWithMaterials[],
      materials: allMaterials, // For backward compatibility
      jobTimeLogs: timeLogs, // Use correct property name for timer logs
    } as unknown as JobWithMaterials;
    
    // Only auto-update status if job is not manually paused
    if (job.status !== 'paused') {
      const calculatedStatus = await this.calculateJobStatus(jobWithMaterials);
      if (job.status !== calculatedStatus) {
        await this.updateJobStatus(job.id, calculatedStatus);
        jobWithMaterials.status = calculatedStatus;
      }
    }

    return jobWithMaterials;
  }

  async getAllJobs(search?: string, status?: string): Promise<JobWithMaterials[]> {
    let whereConditions = [];
    
    if (search) {
      whereConditions.push(
        or(
          ilike(jobs.customerName, `%${search}%`),
          ilike(jobs.jobName, `%${search}%`),
          ilike(jobs.jobNumber, `%${search}%`)
        )
      );
    }
    
    if (status && status !== 'all') {
      whereConditions.push(eq(jobs.status, status));
    }

    const jobsList = await db.select().from(jobs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(jobs.createdAt));

    // For each job, get cutlists and materials with automatic status calculation
    const jobsWithData = await Promise.all(
      jobsList.map(async (job) => {
        return this.getJob(job.id);
      })
    );

    return jobsWithData.filter(job => job !== undefined) as JobWithMaterials[];
  }

  async updateJobStatus(id: number, status: string): Promise<void> {
    await db.update(jobs).set({ 
      status,
      updatedAt: new Date()
    }).where(eq(jobs.id, id));
  }

  async startJobTimer(jobId: number, userId?: number): Promise<void> {
    // Check if there's already an active timer for this job
    const existingActiveLog = await db.select().from(jobTimeLogs).where(
      and(
        eq(jobTimeLogs.jobId, jobId),
        sql`${jobTimeLogs.endTime} IS NULL`
      )
    );
    
    // If there's already an active timer, don't start another one
    if (existingActiveLog.length > 0) {
      return;
    }
    
    const now = new Date();
    
    // Create time log entry
    await db.insert(jobTimeLogs).values({
      jobId,
      startTime: now,
      userId
    });
  }

  async stopJobTimer(jobId: number): Promise<void> {
    const now = new Date();
    
    // Close any open time logs for this job
    const result = await db.update(jobTimeLogs).set({
      endTime: now
    }).where(
      and(
        eq(jobTimeLogs.jobId, jobId),
        sql`${jobTimeLogs.endTime} IS NULL`
      )
    );
    
    // Calculate total duration if we closed a time log
    const timeLogs = await db.select().from(jobTimeLogs).where(eq(jobTimeLogs.jobId, jobId));
    const totalDuration = timeLogs.reduce((total, log) => {
      if (log.endTime) {
        return total + (log.endTime.getTime() - log.startTime.getTime()) / 1000;
      }
      return total;
    }, 0);

    // Update job's total duration
    await db.update(jobs).set({
      totalDuration: Math.round(totalDuration),
      updatedAt: now
    }).where(eq(jobs.id, jobId));
  }

  async startJob(id: number, userId: number): Promise<void> {
    const now = new Date();
    
    // Update job status and start time
    await db.update(jobs).set({
      status: 'in_progress',
      startTime: now,
      updatedAt: now
    }).where(eq(jobs.id, id));

    // Create time log entry
    await db.insert(jobTimeLogs).values({
      jobId: id,
      startTime: now,
      userId
    });
  }

  async pauseJob(id: number): Promise<void> {
    const now = new Date();
    
    // Update job status
    await db.update(jobs).set({
      status: 'paused',
      updatedAt: now
    }).where(eq(jobs.id, id));

    // Close current time log
    await db.update(jobTimeLogs).set({
      endTime: now
    }).where(
      and(
        eq(jobTimeLogs.jobId, id),
        sql`${jobTimeLogs.endTime} IS NULL`
      )
    );
  }

  async resumeJob(id: number): Promise<void> {
    const now = new Date();
    
    // Get the job to determine correct status
    const job = await this.getJob(id);
    if (!job) return;
    
    // Calculate what the status should be based on completion
    const correctStatus = await this.calculateJobStatus(job);
    
    // Update job status to calculated status (not hardcoded in_progress)
    await db.update(jobs).set({
      status: correctStatus,
      updatedAt: now
    }).where(eq(jobs.id, id));

    // Only start a new time log if job is actually in progress
    if (correctStatus === 'in_progress') {
      await db.insert(jobTimeLogs).values({
        jobId: id,
        startTime: now
      });
    }
    
    console.log('Job resumed - status set to:', correctStatus);
  }

  async completeJob(id: number): Promise<void> {
    const now = new Date();
    
    // Close current time log
    await db.update(jobTimeLogs).set({
      endTime: now
    }).where(
      and(
        eq(jobTimeLogs.jobId, id),
        sql`${jobTimeLogs.endTime} IS NULL`
      )
    );

    // Calculate total duration
    const timeLogs = await db.select().from(jobTimeLogs).where(eq(jobTimeLogs.jobId, id));
    const totalDuration = timeLogs.reduce((total, log) => {
      if (log.endTime) {
        return total + (log.endTime.getTime() - log.startTime.getTime()) / 1000;
      }
      return total;
    }, 0);

    // Update job
    await db.update(jobs).set({
      status: 'done',
      endTime: now,
      totalDuration: Math.round(totalDuration),
      updatedAt: now
    }).where(eq(jobs.id, id));
  }

  async updateMaterialProgress(materialId: number, completedSheets: number): Promise<void> {
    await db.update(jobMaterials).set({
      completedSheets
    }).where(eq(jobMaterials.id, materialId));
  }

  // Remove recut methods - replaced with cutlist system
  async createCutlists(jobId: number, count: number): Promise<Cutlist[]> {
    const existingCutlists = await db.select().from(cutlists).where(eq(cutlists.jobId, jobId));
    const nextIndex = existingCutlists.length + 1;
    
    const newCutlists = [];
    for (let i = 0; i < count; i++) {
      const [cutlist] = await db.insert(cutlists).values({
        jobId,
        name: `Cutlist ${nextIndex + i}`,
        orderIndex: nextIndex + i,
      }).returning();
      newCutlists.push(cutlist);
    }
    
    return newCutlists;
  }

  async deleteCutlist(cutlistId: number): Promise<void> {
    // Delete materials first (cascade)
    await db.delete(jobMaterials).where(eq(jobMaterials.cutlistId, cutlistId));
    // Delete cutlist
    await db.delete(cutlists).where(eq(cutlists.id, cutlistId));
  }

  async getCutlistsForJob(jobId: number): Promise<CutlistWithMaterials[]> {
    const cutlistsData = await db
      .select({
        id: cutlists.id,
        jobId: cutlists.jobId,
        name: cutlists.name,
        orderIndex: cutlists.orderIndex,
        createdAt: cutlists.createdAt,
        materials: sql`(
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', jm.id,
              'cutlistId', jm.cutlist_id,
              'colorId', jm.color_id,
              'totalSheets', jm.total_sheets,
              'completedSheets', jm.completed_sheets,
              'sheetStatuses', jm.sheet_statuses,
              'createdAt', jm.created_at,
              'color', json_build_object(
                'id', c.id,
                'name', c.name,
                'hexColor', c.hex_color,
                'groupId', c.group_id,
                'createdAt', c.created_at
              )
            )
          ), '[]'::json)
          FROM job_materials jm
          JOIN colors c ON jm.color_id = c.id
          WHERE jm.cutlist_id = cutlists.id
        )`
      })
      .from(cutlists)
      .where(eq(cutlists.jobId, jobId))
      .orderBy(cutlists.orderIndex);

    return cutlistsData as CutlistWithMaterials[];
  }

  async addSheetsToMaterial(materialId: number, additionalSheets: number, isRecut?: boolean): Promise<void> {
    // Get current material data
    const [material] = await db.select().from(jobMaterials).where(eq(jobMaterials.id, materialId));
    if (!material) return;

    // Get current sheet statuses
    let sheetStatuses = material.sheetStatuses || [];
    
    // Add new pending sheets to the status array
    for (let i = 0; i < additionalSheets; i++) {
      sheetStatuses.push('pending');
    }

    // Update the material with new total sheets and statuses
    await db.update(jobMaterials).set({
      totalSheets: material.totalSheets + additionalSheets,
      sheetStatuses
    }).where(eq(jobMaterials.id, materialId));
  }

  async addMaterialToJob(jobId: number, colorId: number, totalSheets: number): Promise<void> {
    // Get the job to find a cutlist to add the material to
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Use the first cutlist, or create one if none exists
    let cutlistId = job.cutlists?.[0]?.id;
    
    if (!cutlistId) {
      // Create a default cutlist for the job
      const [cutlist] = await db.insert(cutlists).values({
        jobId: jobId,
        name: 'Main Cutlist',
      }).returning();
      cutlistId = cutlist.id;
    }

    // Create initial sheet statuses array
    const initialStatuses = Array(totalSheets).fill('pending');

    // Add the new material to the cutlist
    await db.insert(jobMaterials).values({
      cutlistId: cutlistId,
      supplyId: colorId, // colorId is actually supplyId from the frontend
      totalSheets: totalSheets,
      completedSheets: 0,
      sheetStatuses: initialStatuses,
    });
  }

  async deleteMaterial(materialId: number): Promise<void> {
    // First delete all recut entries for this material
    await db.delete(recutEntries).where(eq(recutEntries.materialId, materialId));
    
    // Then delete the material itself
    await db.delete(jobMaterials).where(eq(jobMaterials.id, materialId));
  }

  async deleteRecutEntry(recutId: number): Promise<void> {
    await db.delete(recutEntries).where(eq(recutEntries.id, recutId));
  }

  async updateSheetStatus(materialId: number, sheetIndex: number, status: string, userId?: number): Promise<void> {
    // Use a transaction to prevent race conditions
    return await db.transaction(async (tx) => {
      // First, get the current material data with a lock
      const [material] = await tx.select().from(jobMaterials).where(eq(jobMaterials.id, materialId));
      if (!material) return;

      // Initialize arrays
      let sheetStatuses = material.sheetStatuses || [];
      
      // Ensure the array is large enough for the target index
      while (sheetStatuses.length <= sheetIndex) {
        sheetStatuses.push('pending');
      }
      
      // Only update if the status is actually different to prevent unnecessary updates
      if (sheetStatuses[sheetIndex] === status) {
        return; // No change needed
      }
      
      // Update the sheet status
      sheetStatuses[sheetIndex] = status;
      
      // Calculate completed sheets based on 'cut' status only
      const completedSheets = sheetStatuses.filter(s => s === 'cut').length;
      
      console.log(`Updating material ${materialId}, sheet ${sheetIndex}: ${status}, completed: ${completedSheets}/${sheetStatuses.length}`);
      
      // Update database with new statuses
      await tx.update(jobMaterials).set({
        sheetStatuses,
        completedSheets
      }).where(eq(jobMaterials.id, materialId));

      // Log the sheet cutting activity
      await tx.insert(sheetCutLogs).values({
        materialId,
        sheetIndex,
        status,
        isRecut: false,
        userId
      });

      // Get the job and update its automatic status
      const cutlistData = await tx.select({
        jobId: cutlists.jobId
      }).from(jobMaterials)
      .innerJoin(cutlists, eq(jobMaterials.cutlistId, cutlists.id))
      .where(eq(jobMaterials.id, materialId));
      
      if (cutlistData.length > 0) {
        const jobId = cutlistData[0].jobId;
        const job = await this.getJob(jobId);
        if (job) {
          const newStatus = await this.calculateJobStatus(job);
          await tx.update(jobs).set({
            status: newStatus,
            updatedAt: new Date()
          }).where(eq(jobs.id, jobId));
        }
      }
    });
  }

  async deleteSheet(materialId: number, sheetIndex: number): Promise<void> {
    // Get current material data
    const [material] = await db.select().from(jobMaterials).where(eq(jobMaterials.id, materialId));
    if (!material) return;

    // Get current sheet statuses
    let sheetStatuses = material.sheetStatuses || [];
    
    // Remove the sheet at the specified index
    if (sheetIndex >= 0 && sheetIndex < sheetStatuses.length) {
      sheetStatuses.splice(sheetIndex, 1);
    }
    
    // Recalculate completed sheets
    const completedSheets = sheetStatuses.filter(s => s === 'cut').length;
    
    // Update the material with new total sheets and statuses
    await db.update(jobMaterials).set({
      totalSheets: material.totalSheets - 1,
      sheetStatuses,
      completedSheets
    }).where(eq(jobMaterials.id, materialId));
  }

  async addRecutEntry(materialId: number, quantity: number, reason?: string, userId?: number): Promise<void> {
    // Initialize sheet statuses as all pending
    const sheetStatuses = Array(quantity).fill('pending');
    
    await db.insert(recutEntries).values({
      materialId,
      quantity,
      reason,
      sheetStatuses,
      completedSheets: 0,
      userId
    });
  }

  async getRecutEntries(materialId: number): Promise<any[]> {
    const entries = await db.select({
      id: recutEntries.id,
      quantity: recutEntries.quantity,
      reason: recutEntries.reason,
      sheetStatuses: recutEntries.sheetStatuses,
      completedSheets: recutEntries.completedSheets,
      createdAt: recutEntries.createdAt,
      user: {
        id: users.id,
        username: users.username
      }
    })
    .from(recutEntries)
    .leftJoin(users, eq(recutEntries.userId, users.id))
    .where(eq(recutEntries.materialId, materialId))
    .orderBy(desc(recutEntries.createdAt));
    
    return entries;
  }

  async updateRecutSheetStatus(recutId: number, sheetIndex: number, status: string, userId?: number): Promise<void> {
    // Get current recut entry
    const [recutEntry] = await db.select().from(recutEntries).where(eq(recutEntries.id, recutId));
    if (!recutEntry) return;

    // Get current sheet statuses
    let sheetStatuses = recutEntry.sheetStatuses || [];
    
    // Ensure array is long enough
    while (sheetStatuses.length <= sheetIndex) {
      sheetStatuses.push('pending');
    }
    
    // Update the status
    sheetStatuses[sheetIndex] = status;
    
    // Recalculate completed sheets
    const completedSheets = sheetStatuses.filter(s => s === 'cut').length;
    
    // Update the recut entry
    await db.update(recutEntries).set({
      sheetStatuses,
      completedSheets
    }).where(eq(recutEntries.id, recutId));

    // Log the recut sheet cutting activity
    await db.insert(sheetCutLogs).values({
      materialId: recutEntry.materialId,
      sheetIndex,
      status,
      isRecut: true,
      recutId,
      userId
    });

    // Get the job and update its automatic status
    const jobData = await db.select({
      jobId: cutlists.jobId
    }).from(recutEntries)
    .innerJoin(jobMaterials, eq(recutEntries.materialId, jobMaterials.id))
    .innerJoin(cutlists, eq(jobMaterials.cutlistId, cutlists.id))
    .where(eq(recutEntries.id, recutId));
    
    if (jobData.length > 0) {
      const jobId = jobData[0].jobId;
      const job = await this.getJob(jobId);
      if (job) {
        const newStatus = await this.calculateJobStatus(job);
        await db.update(jobs).set({
          status: newStatus,
          updatedAt: new Date()
        }).where(eq(jobs.id, jobId));
      }
    }
  }

  async logSheetCut(materialId: number, sheetIndex: number, status: string, isRecut: boolean = false, recutId?: number, userId?: number): Promise<void> {
    await db.insert(sheetCutLogs).values({
      materialId,
      sheetIndex,
      status,
      isRecut,
      recutId,
      userId
    });
  }

  async getSheetCutLogs(materialId: number, fromDate?: Date, toDate?: Date): Promise<any[]> {
    const conditions = [eq(sheetCutLogs.materialId, materialId)];
    
    if (fromDate) {
      conditions.push(gte(sheetCutLogs.cutAt, fromDate));
    }
    if (toDate) {
      conditions.push(lte(sheetCutLogs.cutAt, toDate));
    }
    
    return await db.select().from(sheetCutLogs)
      .where(and(...conditions))
      .orderBy(sheetCutLogs.cutAt);
  }

  async deleteJob(jobId: number): Promise<void> {
    // Delete in proper order due to foreign key constraints
    
    // First delete recut entries
    await db.delete(recutEntries).where(
      inArray(recutEntries.materialId, 
        db.select({ id: jobMaterials.id }).from(jobMaterials).where(
          inArray(jobMaterials.cutlistId, 
            db.select({ id: cutlists.id }).from(cutlists).where(eq(cutlists.jobId, jobId))
          )
        )
      )
    );
    
    // Then delete job materials (which cascade from cutlists)
    await db.delete(jobMaterials).where(
      inArray(jobMaterials.cutlistId, 
        db.select({ id: cutlists.id }).from(cutlists).where(eq(cutlists.jobId, jobId))
      )
    );
    
    // Delete cutlists
    await db.delete(cutlists).where(eq(cutlists.jobId, jobId));
    
    // Delete job time logs
    await db.delete(jobTimeLogs).where(eq(jobTimeLogs.jobId, jobId));
    
    // Finally delete the job
    await db.delete(jobs).where(eq(jobs.id, jobId));
  }



  async getAllColors(): Promise<ColorWithGroup[]> {
    // Redirect to supplies for backward compatibility
    const supplies = await this.getAllSupplies();
    // Transform supplies to match the old colors format for backward compatibility
    const colors = supplies.map(supply => ({
      id: supply.id,
      name: supply.name,
      hexColor: supply.hexColor,
      groupId: supply.location?.id || null,
      texture: supply.texture,
      createdAt: supply.createdAt,
      group: supply.location ? { id: supply.location.id, name: supply.location.name } : null
    }));
    return colors as ColorWithGroup[];
  }

  async createColor(color: InsertColor): Promise<Color> {
    const [newColor] = await db.insert(colors).values(color).returning();
    return newColor;
  }

  async updateColor(id: number, color: Partial<InsertColor>): Promise<void> {
    await db.update(colors).set(color).where(eq(colors.id, id));
  }

  async deleteColor(id: number): Promise<void> {
    await db.delete(colors).where(eq(colors.id, id));
  }

  async searchColors(query: string): Promise<ColorWithGroup[]> {
    return await db.query.colors.findMany({
      where: ilike(colors.name, `%${query}%`),
      with: { group: true },
      orderBy: colors.name
    }) as ColorWithGroup[];
  }

  async getAllColorGroups(): Promise<ColorGroup[]> {
    return await db.select().from(colorGroups).orderBy(colorGroups.name);
  }

  async createColorGroup(group: InsertColorGroup): Promise<ColorGroup> {
    const [newGroup] = await db.insert(colorGroups).values(group).returning();
    return newGroup;
  }

  async updateColorGroup(id: number, name: string): Promise<void> {
    await db.update(colorGroups).set({ name }).where(eq(colorGroups.id, id));
  }

  async deleteColorGroup(id: number): Promise<void> {
    await db.delete(colorGroups).where(eq(colorGroups.id, id));
  }

  async getDashboardStats(sheetsFrom?: string, sheetsTo?: string, timeFrom?: string, timeTo?: string) {
    // Count jobs by status
    const statusCounts = await db.select({
      status: jobs.status,
      count: sql<number>`count(*)`
    }).from(jobs).groupBy(jobs.status);

    const jobsByStatus = {
      waiting: 0,
      in_progress: 0,
      paused: 0,
      done: 0
    };

    statusCounts.forEach(({ status, count }) => {
      if (status === 'waiting') jobsByStatus.waiting = Number(count);
      else if (status === 'in_progress') jobsByStatus.in_progress = Number(count);
      else if (status === 'paused') jobsByStatus.paused = Number(count);
      else if (status === 'done') jobsByStatus.done = Number(count);
    });

    // Count sheets cut using the new sheet cut logs (with date filtering if provided)
    let sheetsCutResult;
    let recutSheetsCutResult;

    if (sheetsFrom || sheetsTo) {
      const sheetsFromDate = sheetsFrom ? new Date(sheetsFrom) : new Date(0);
      const sheetsToDate = sheetsTo ? new Date(sheetsTo) : new Date(Date.now());
      
      // Add debug logging
      console.log('Sheets filtering:', {
        sheetsFrom: sheetsFromDate.toISOString(),
        sheetsTo: sheetsToDate.toISOString(),
        sheetsFromStr: sheetsFrom,
        sheetsToStr: sheetsTo
      });
      
      // Count regular sheets cut in the date range
      sheetsCutResult = await db.select({
        totalSheets: sql<number>`count(*)`
      })
      .from(sheetCutLogs)
      .where(
        and(
          eq(sheetCutLogs.isRecut, false),
          eq(sheetCutLogs.status, 'cut'),
          gte(sheetCutLogs.cutAt, sheetsFromDate),
          lte(sheetCutLogs.cutAt, sheetsToDate)
        )
      );

      // Count recut sheets cut in the date range
      recutSheetsCutResult = await db.select({
        totalRecutSheets: sql<number>`count(*)`
      })
      .from(sheetCutLogs)
      .where(
        and(
          eq(sheetCutLogs.isRecut, true),
          eq(sheetCutLogs.status, 'cut'),
          gte(sheetCutLogs.cutAt, sheetsFromDate),
          lte(sheetCutLogs.cutAt, sheetsToDate)
        )
      );
    } else {
      // Count all sheets cut (no date filtering)
      sheetsCutResult = await db.select({
        totalSheets: sql<number>`count(*)`
      })
      .from(sheetCutLogs)
      .where(
        and(
          eq(sheetCutLogs.isRecut, false),
          eq(sheetCutLogs.status, 'cut')
        )
      );

      recutSheetsCutResult = await db.select({
        totalRecutSheets: sql<number>`count(*)`
      })
      .from(sheetCutLogs)
      .where(
        and(
          eq(sheetCutLogs.isRecut, true),
          eq(sheetCutLogs.status, 'cut')
        )
      );
    }

    // Calculate average job time (with date filtering if provided)
    let avgTimeResult;
    let avgSheetTimeResult;
    let jobsForSheetTime;

    if (timeFrom || timeTo) {
      const timeFromDate = timeFrom ? new Date(timeFrom) : new Date(0);
      const timeToDate = timeTo ? new Date(timeTo) : new Date(Date.now());
      
      // Add debug logging
      console.log('Time filtering:', {
        timeFrom: timeFromDate.toISOString(),
        timeTo: timeToDate.toISOString(),
        timeFromStr: timeFrom,
        timeToStr: timeTo
      });
      
      avgTimeResult = await db.select({
        avgDuration: sql<number>`avg(${jobs.totalDuration})`
      }).from(jobs)
      .where(
        and(
          sql`${jobs.totalDuration} IS NOT NULL`,
          sql`${jobs.createdAt} >= ${timeFromDate}`,
          sql`${jobs.createdAt} <= ${timeToDate}`
        )
      );

      // Fetch jobs and their materials/recuts for correct sheet time calculation
      jobsForSheetTime = await db.query.jobs.findMany({
        where: (j, { and, gte, lte, isNotNull }) => and(
          isNotNull(j.totalDuration),
          gte(j.createdAt, timeFromDate),
          lte(j.createdAt, timeToDate)
        ),
        with: {
          cutlists: {
            with: {
              materials: {
                with: {
                  recutEntries: true
                }
              }
            }
          }
        }
      });
    } else {
      avgTimeResult = await db.select({
        avgDuration: sql<number>`avg(${jobs.totalDuration})`
      }).from(jobs)
      .where(sql`${jobs.totalDuration} IS NOT NULL`);

      jobsForSheetTime = await db.query.jobs.findMany({
        where: (j, { isNotNull }) => isNotNull(j.totalDuration),
        with: {
          cutlists: {
            with: {
              materials: {
                with: {
                  recutEntries: true
                }
              }
            }
          }
        }
      });
    }

    // Calculate average sheet time
    let avgSheetTime = 0;
    if (jobsForSheetTime && jobsForSheetTime.length > 0) {
      const perJobSheetTimes = jobsForSheetTime.map(job => {
        let totalSheets = 0;
        job.cutlists?.forEach(cutlist => {
          cutlist.materials?.forEach(material => {
            totalSheets += material.totalSheets;
            material.recutEntries?.forEach(recut => {
              totalSheets += recut.quantity;
            });
          });
        });
        if (totalSheets > 0 && job.totalDuration) {
          return job.totalDuration / totalSheets;
        }
        return null;
      }).filter(x => x !== null);
      if (perJobSheetTimes.length > 0) {
        avgSheetTime = perJobSheetTimes.reduce((a, b) => a + b, 0) / perJobSheetTimes.length;
      }
    }

    // Count material colors
    const colorCountResult = await db.select({
      count: sql<number>`count(*)`
    }).from(colors);

    const materialsTotal = Number(sheetsCutResult[0]?.totalSheets) || 0;
    const recutsTotal = Number(recutSheetsCutResult[0]?.totalRecutSheets) || 0;
    const totalSheetsCut = materialsTotal + recutsTotal;
    
    // Debug logging
    console.log('Dashboard stats calculation:', {
      materialsTotal,
      recutsTotal,
      totalSheetsCut,
      sheetsFrom,
      sheetsTo,
      timeFrom,
      timeTo
    });

    return {
      activeJobs: jobsByStatus.waiting + jobsByStatus.in_progress,
      sheetsCutToday: totalSheetsCut,
      avgJobTime: avgTimeResult[0]?.avgDuration || 0,
      avgSheetTime: avgSheetTime || 0,
      materialColors: (await db.select({ count: sql<number>`count(*)` }).from(supplies))[0]?.count || 0,
      jobsByStatus
    };
  }

  // Supply management methods
  async getAllSupplies(): Promise<SupplyWithLocation[]> {
    try {
      // Get all supplies without location relation for now
      const suppliesData = await db.select().from(supplies).orderBy(supplies.name);
      
      // Transform to match SupplyWithLocation type
      const suppliesWithLocation = suppliesData.map(supply => ({
        ...supply,
        location: null // For now, set location to null since we're not using the linking table yet
      }));
      
      return suppliesWithLocation;
    } catch (error) {
      console.error('Error in getAllSupplies:', error);
      throw error;
    }
  }

  async getSupply(id: number): Promise<any> {
    try {
      // Get basic supply data
      const [supply] = await db.select().from(supplies).where(eq(supplies.id, id));
      if (!supply) return undefined;

      // Get vendor relationships
      const vendorRelations = await db.select({
        id: supplyVendors.id,
        vendorId: supplyVendors.vendorId,
        vendorPartNumber: supplyVendors.vendorPartNumber,
        price: supplyVendors.price,
        isPreferred: supplyVendors.isPreferred
      }).from(supplyVendors).where(eq(supplyVendors.supplyId, id));

      // Get location relationships
      const locationRelations = await db.select({
        id: supplyLocations.id,
        locationId: supplyLocations.locationId,
        onHandQuantity: supplyLocations.onHandQuantity,
        minimumQuantity: supplyLocations.minimumQuantity,
        orderGroupSize: supplyLocations.orderGroupSize
      }).from(supplyLocations).where(eq(supplyLocations.supplyId, id));

      return {
        ...supply,
        vendors: vendorRelations,
        locations: locationRelations
      };
    } catch (error) {
      console.error('Error getting supply:', error);
      throw error;
    }
  }

  async createSupply(supplyData: any): Promise<Supply> {
    try {
      console.log('Creating supply with data:', supplyData);
      
      // Extract basic supply data
      const { vendors, locations, ...basicSupplyData } = supplyData;
      
      // Insert the basic supply data
      const [supply] = await db.insert(supplies).values(basicSupplyData).returning();
      
      console.log('Created supply with ID:', supply.id);
      
      // Insert vendor relationships if provided
      if (vendors && vendors.length > 0) {
        const vendorRelations = vendors.map((vendor: any) => ({
          supplyId: supply.id,
          vendorId: vendor.vendorId,
          vendorPartNumber: vendor.vendorPartNumber,
          price: vendor.price,
          isPreferred: vendor.isPreferred
        }));
        
        await db.insert(supplyVendors).values(vendorRelations);
        console.log('Created vendor relationships:', vendorRelations.length);
      }
      
      // Insert location relationships if provided
      if (locations && locations.length > 0) {
        const locationRelations = locations.map((location: any) => ({
          supplyId: supply.id,
          locationId: location.locationId,
          onHandQuantity: location.onHandQuantity || 0,
          minimumQuantity: location.minimumQuantity || 0,
          orderGroupSize: location.orderGroupSize || 1
        }));
        
        await db.insert(supplyLocations).values(locationRelations);
        console.log('Created location relationships:', locationRelations.length);
      }
      
      return supply;
    } catch (error) {
      console.error('Error creating supply:', error);
      throw error;
    }
  }

  async updateSupply(id: number, supplyData: any): Promise<void> {
    try {
      console.log('Updating supply with data:', supplyData);
      console.log('Supply ID to update:', id);
      
      // Extract basic supply data
      const { vendors, locations, ...basicSupplyData } = supplyData;
      console.log('Basic supply data:', basicSupplyData);
      console.log('Vendors data:', vendors);
      console.log('Locations data:', locations);
      
      // Update the basic supply data
      console.log('Updating basic supply data...');
      await db.update(supplies).set(basicSupplyData).where(eq(supplies.id, id));
      console.log('Basic supply data updated successfully');
      
      // Delete existing vendor relationships
      console.log('Deleting existing vendor relationships...');
      await db.delete(supplyVendors).where(eq(supplyVendors.supplyId, id));
      console.log('Existing vendor relationships deleted');
      
      // Insert new vendor relationships if provided
      if (vendors && vendors.length > 0) {
        console.log('Inserting new vendor relationships...');
        const vendorRelations = vendors.map((vendor: any) => ({
          supplyId: id,
          vendorId: vendor.vendorId,
          vendorPartNumber: vendor.vendorPartNumber,
          price: vendor.price,
          isPreferred: vendor.isPreferred
        }));
        
        await db.insert(supplyVendors).values(vendorRelations);
        console.log('Updated vendor relationships:', vendorRelations.length);
      } else {
        console.log('No vendor relationships to insert');
      }
      
      // Delete existing location relationships
      console.log('Deleting existing location relationships...');
      await db.delete(supplyLocations).where(eq(supplyLocations.supplyId, id));
      console.log('Existing location relationships deleted');
      
      // Insert new location relationships if provided
      if (locations && locations.length > 0) {
        console.log('Inserting new location relationships...');
        const locationRelations = locations.map((location: any) => ({
          supplyId: id,
          locationId: location.locationId,
          onHandQuantity: location.onHandQuantity || 0,
          minimumQuantity: location.minimumQuantity || 0,
          orderGroupSize: location.orderGroupSize || 1
        }));
        
        await db.insert(supplyLocations).values(locationRelations);
        console.log('Updated location relationships:', locationRelations.length);
      } else {
        console.log('No location relationships to insert');
      }
      
      console.log('Supply update completed successfully');
    } catch (error) {
      console.error('Error updating supply:', error);
      throw error;
    }
  }

  async deleteSupply(id: number): Promise<void> {
    await db.delete(supplies).where(eq(supplies.id, id));
  }

  async searchSupplies(query: string): Promise<SupplyWithLocation[]> {
    try {
      // Search supplies without location relation for now
      const suppliesData = await db.select()
        .from(supplies)
        .where(ilike(supplies.name, `%${query}%`))
        .orderBy(supplies.name);
      
      // Transform to match SupplyWithLocation type
      const suppliesWithLocation = suppliesData.map(supply => ({
        ...supply,
        location: null // For now, set location to null since we're not using the linking table yet
      }));
      
      return suppliesWithLocation;
    } catch (error) {
      console.error('Error in searchSupplies:', error);
      throw error;
    }
  }

  async updateSupplyQuantity(id: number, quantity: number, type: 'receive' | 'use' | 'adjust', description?: string, jobId?: number, userId?: number): Promise<void> {
    // This function needs to be updated to work with the new supply_locations table
    // For now, just create a transaction record
    await db.insert(supplyTransactions).values({
      supplyId: id,
      type,
      quantity,
      description,
      jobId,
      userId
    });
  }

  async allocateSupplyForJob(supplyId: number, quantity: number, jobId: number, userId?: number): Promise<void> {
    // This function needs to be updated to work with the new supply_locations table
    // For now, just create a transaction record
    await db.insert(supplyTransactions).values({
      supplyId,
      type: 'allocate',
      quantity,
      description: `Allocated for job ${jobId}`,
      jobId,
      userId
    });
  }

  // Enhanced inventory management (new)
  async checkInInventory(supplyId: number, locationId: number, quantity: number, referenceType?: string, referenceId?: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(supplyTransactions).values({
      supplyId,
      type: 'check_in',
      quantity,
      description: `Checked in ${quantity} from location ${locationId}`,
      jobId: referenceId, // Assuming jobId is the referenceId for check-in
      userId
    });
  }

  async checkOutInventory(supplyId: number, locationId: number, quantity: number, referenceType?: string, referenceId?: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(supplyTransactions).values({
      supplyId,
      type: 'check_out',
      quantity,
      description: `Checked out ${quantity} to location ${locationId}`,
      jobId: referenceId, // Assuming jobId is the referenceId for check-out
      userId
    });
  }

  async transferInventory(supplyId: number, fromLocationId: number, toLocationId: number, quantity: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(supplyTransactions).values({
      supplyId,
      type: 'transfer',
      quantity,
      description: `Transferred ${quantity} from location ${fromLocationId} to location ${toLocationId}`,
      jobId: null, // No direct jobId for transfers
      userId
    });
  }

  async adjustInventory(supplyId: number, locationId: number, quantity: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(supplyTransactions).values({
      supplyId,
      type: 'adjust',
      quantity,
      description: `Adjusted inventory for location ${locationId} by ${quantity}`,
      jobId: null, // No direct jobId for adjustments
      userId
    });
  }

  async getInventoryMovements(supplyId?: number, locationId?: number, fromDate?: Date, toDate?: Date): Promise<any[]> {
    let conditions = [];
    if (supplyId) {
      conditions.push(eq(inventoryMovements.supplyId, supplyId));
    }
    if (locationId) {
      conditions.push(or(
        eq(inventoryMovements.fromLocationId, locationId),
        eq(inventoryMovements.toLocationId, locationId)
      ));
    }
    if (fromDate) {
      conditions.push(gte(inventoryMovements.createdAt, fromDate));
    }
    if (toDate) {
      conditions.push(lte(inventoryMovements.createdAt, toDate));
    }

    return await db.select().from(inventoryMovements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryMovements.createdAt));
  }

  async getInventoryMovement(id: number): Promise<any> {
    const [movement] = await db.select().from(supplyTransactions).where(eq(supplyTransactions.id, id));
    return movement;
  }

  async getNeedToPurchase(): Promise<any[]> {
    // This is a placeholder. In a real application, you'd query the supply_locations table
    // to find supplies that are below their minimum quantity.
    // For now, we'll return a dummy list.
    return [
      { supplyId: 1, locationId: 1, currentQuantity: 5, minQuantity: 10, reorderPoint: 8, name: 'Wood', hexColor: '#808080' },
      { supplyId: 2, locationId: 2, currentQuantity: 2, minQuantity: 5, reorderPoint: 3, name: 'Paint', hexColor: '#FF0000' }
    ];
  }

  async getReorderSuggestions(): Promise<any[]> {
    // This is a placeholder. In a real application, you'd query the supply_locations table
    // to find supplies that are below their reorder point.
    // For now, we'll return a dummy list.
    return [
      { supplyId: 1, locationId: 1, currentQuantity: 5, reorderPoint: 8, name: 'Wood', hexColor: '#808080' },
      { supplyId: 2, locationId: 2, currentQuantity: 2, minQuantity: 5, reorderPoint: 3, name: 'Paint', hexColor: '#FF0000' }
    ];
  }

  async updateReorderPoint(supplyLocationId: number, reorderPoint: number): Promise<void> {
    await db.update(supplyLocations).set({ minimumQuantity: reorderPoint }).where(eq(supplyLocations.id, supplyLocationId));
  }

  async getInventoryAlerts(): Promise<any[]> {
    // This is a placeholder. In a real application, you'd query the supply_locations table
    // to find supplies that are below their minimum quantity.
    // For now, we'll return a dummy list.
    return [
      { supplyId: 1, locationId: 1, currentQuantity: 5, minQuantity: 10, name: 'Wood', hexColor: '#808080' },
      { supplyId: 2, locationId: 2, currentQuantity: 2, minQuantity: 5, name: 'Paint', hexColor: '#FF0000' }
    ];
  }

  async resolveInventoryAlert(alertId: number): Promise<void> {
    // This is a placeholder. In a real application, you'd update the minimum quantity
    // for the specific supply_location that triggered the alert.
    // For now, we'll just delete the alert.
    await db.delete(supplyTransactions).where(eq(supplyTransactions.id, alertId));
  }

  // Location categories
  async getAllLocationCategories(): Promise<any[]> {
    // This is a placeholder. In a real application, you'd query the location_categories table.
    return [];
  }

  async createLocationCategory(category: any): Promise<any> {
    // This is a placeholder. In a real application, you'd insert into the location_categories table.
    return { id: 1, name: 'Default Category' };
  }

  async updateLocationCategory(id: number, category: any): Promise<void> {
    // This is a placeholder. In a real application, you'd update the location_categories table.
  }

  async deleteLocationCategory(id: number): Promise<void> {
    // This is a placeholder. In a real application, you'd delete from the location_categories table.
  }

  // Location management methods
  async getAllLocations(): Promise<Location[]> {
    const results = await db
      .select({
        id: locations.id,
        name: locations.name,
        isActive: locations.isActive,
        createdAt: locations.createdAt,
        itemCount: sql<number>`COUNT(DISTINCT CASE WHEN ${supplyLocations.onHandQuantity} > 0 THEN ${supplyLocations.supplyId} END)`.as('itemCount')
      })
      .from(locations)
      .leftJoin(supplyLocations, eq(supplyLocations.locationId, locations.id))
      .groupBy(locations.id, locations.name, locations.isActive, locations.createdAt)
      .orderBy(locations.name);

    return results as unknown as Location[];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const result = await db.insert(locations).values(location).returning();
    return result[0];
  }

  async updateLocation(id: number, name: string, description?: string): Promise<void> {
    await db.update(locations).set({ name, description }).where(eq(locations.id, id));
  }

  async deleteLocation(id: number): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  async toggleLocationActive(id: number, isActive: boolean): Promise<void> {
    await db.update(locations).set({ isActive }).where(eq(locations.id, id));
  }

  async getSuppliesAtLocation(locationId: number): Promise<any[]> {
    const suppliesWithStock = await db
      .select({
        id: supplies.id,
        name: supplies.name,
        hexColor: supplies.hexColor,
        pieceSize: supplies.pieceSize,
        partNumber: supplies.partNumber,
        description: supplies.description,
        availableInCatalog: supplies.availableInCatalog,
        retailPrice: supplies.retailPrice,
        imageUrl: supplies.imageUrl,
        texture: supplies.texture,
        createdAt: supplies.createdAt,
        updatedAt: supplies.updatedAt,
        onHandQuantity: supplyLocations.onHandQuantity,
        minimumQuantity: supplyLocations.minimumQuantity,
                 orderGroupSize: supplyLocations.orderGroupSize
      })
      .from(supplies)
      .innerJoin(supplyLocations, eq(supplies.id, supplyLocations.supplyId))
      .where(eq(supplyLocations.locationId, locationId))
      .orderBy(supplies.name);

    return suppliesWithStock;
  }

  // Purchase order management methods
  async getAllPurchaseOrders(fromDate?: string, toDate?: string): Promise<PurchaseOrderWithItems[]> {
    let conditions = [];
    
    if (fromDate || toDate) {
      const fromDateObj = fromDate ? new Date(fromDate) : new Date(0);
      const toDateObj = toDate ? new Date(toDate) : new Date(Date.now());
      
      conditions.push(
        gte(purchaseOrders.dateOrdered, fromDateObj),
        lte(purchaseOrders.dateOrdered, toDateObj)
      );
    }

    // Get purchase orders
    const orders = await db.select().from(purchaseOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchaseOrders.dateOrdered));

    // Get items for each order
    const ordersWithItems: PurchaseOrderWithItems[] = await Promise.all(
      orders.map(async (order) => {
        const items = await db.select({
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
          orderInGroups: purchaseOrderItems.orderInGroups,
          createdAt: purchaseOrderItems.createdAt
        })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, order.id));

        // Get supply and vendor details for each item
        const itemsWithDetails: (typeof purchaseOrderItems.$inferSelect & { supply: Supply; vendor: Vendor; })[] = await Promise.all(
          items.map(async (item) => {
            const supply = await db.select().from(supplies).where(eq(supplies.id, item.supplyId)).limit(1);
            const vendorRows = await db.select().from(vendors).where(eq(vendors.id, item.vendorId)).limit(1);
            const vendorRow = vendorRows[0];
            const mappedVendor: Vendor = {
              id: vendorRow.id,
              name: vendorRow.name,
              company: vendorRow.company,
              contact_info: vendorRow.contactInfo,
              createdAt: vendorRow.createdAt,
            };
            
            return {
              ...item,
              supply: supply[0] || null,
              vendor: mappedVendor
            };
          })
        );

        const createdByUser = await db.select().from(users)
          .where(eq(users.id, order.createdBy))
          .limit(1);

        return {
          ...order,
          items: itemsWithDetails,
          createdByUser: createdByUser[0] as User
        } as PurchaseOrderWithItems;
      })
    );

    return ordersWithItems;
  }

  async createPurchaseOrder(orderData: InsertPurchaseOrder, orderItems: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithItems> {
    // Generate PO number (format: PO-YYYYMMDD-XXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const existingPOs = await db.select().from(purchaseOrders)
      .where(sql`${purchaseOrders.poNumber} LIKE ${`PO-${dateStr}-%`}`);
    
    const poNumber = `PO-${dateStr}-${String(existingPOs.length + 1).padStart(3, '0')}`;
    
    // Calculate total amount
    const totalAmount = orderItems.reduce((sum, item) => sum + (item.orderQuantity * item.pricePerUnit), 0);

    // Create purchase order
    const [purchaseOrder] = await db.insert(purchaseOrders).values({
      ...orderData,
      poNumber,
      totalAmount
    }).returning();

    // Create purchase order items
    const purchaseOrderItemsResult = await Promise.all(
      orderItems.map(item => 
        db.insert(purchaseOrderItems).values({
          ...item,
          purchaseOrderId: purchaseOrder.id,
          totalPrice: item.orderQuantity * item.pricePerUnit
        }).returning()
      )
    );

    // Get the complete purchase order with items
    const items = await db.select({
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
      orderInGroups: purchaseOrderItems.orderInGroups,
      createdAt: purchaseOrderItems.createdAt
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));

    // Get supply and vendor details for each item
    const itemsWithDetails: (typeof purchaseOrderItems.$inferSelect & { supply: Supply; vendor: Vendor })[] = await Promise.all(
      items.map(async (item) => {
        const supply = await db.select().from(supplies).where(eq(supplies.id, item.supplyId)).limit(1);
        const vendorRows = await db.select().from(vendors).where(eq(vendors.id, item.vendorId)).limit(1);
        const vendorRow = vendorRows[0];
        const mappedVendor: Vendor = {
          id: vendorRow.id,
          name: vendorRow.name,
          company: vendorRow.company,
          contact_info: vendorRow.contactInfo,
          createdAt: vendorRow.createdAt,
        };
        
        return {
          ...item,
          supply: supply[0] || null,
          vendor: mappedVendor
        };
      })
    );

    const createdByUser = await db.select().from(users)
      .where(eq(users.id, purchaseOrder.createdBy))
      .limit(1);

    return {
      ...purchaseOrder,
      items: itemsWithDetails,
      createdByUser: createdByUser[0] as User
    } as PurchaseOrderWithItems;
  }

  async updatePurchaseOrderReceived(id: number, dateReceived: Date): Promise<void> {
    await db.update(purchaseOrders)
      .set({ 
        dateReceived, 
        status: 'received',
        updatedAt: new Date()
      })
      .where(eq(purchaseOrders.id, id));
  }

  async getAllVendors(): Promise<Vendor[]> {
    try {
      console.log('Fetching vendors from database...');
      // Select only the columns that exist in the database
      const result = await db.select().from(vendors).orderBy(vendors.id);
      console.log('Vendors fetched successfully:', result.length);
      // Map DB field contactInfo to API type contact_info
      return result.map((v) => ({
        id: v.id,
        name: v.name,
        company: v.company,
        contact_info: v.contactInfo,
        createdAt: v.createdAt,
      }));
    } catch (error) {
      console.error('Error in getAllVendors:', error);
      throw error;
    }
  }

  async createOneVendor(vendor: InsertVendor): Promise<Vendor> {
    const result = await db.insert(vendors).values({
      name: vendor.name,
      company: vendor.company,
      contactInfo: (vendor as any).contact_info ?? (vendor as any).contactInfo ?? null,
      email: (vendor as any).email ?? null,
      phone: (vendor as any).phone ?? null,
    }).returning();
    const v = result[0];
    return { id: v.id, name: v.name, company: v.company, contact_info: v.contactInfo, createdAt: v.createdAt } as Vendor;
  }

  async updateVendor(id: number, vendorData: Partial<InsertVendor>): Promise<void> {
    await db.update(vendors).set({
      name: vendorData.name,
      company: vendorData.company,
      contactInfo: (vendorData as any).contact_info ?? (vendorData as any).contactInfo,
      email: (vendorData as any).email ?? null,
      phone: (vendorData as any).phone ?? null,
    }).where(eq(vendors.id, id));
  }

  async deleteVendor(id: number): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id))
  }

  async getVendorsForSupply(supplyId: number): Promise<Vendor[]> {
    try {
      // First try to get vendors specifically for this supply
      const supplyVendorData = await db
        .select({
          id: vendors.id,
          name: vendors.name,
          company: vendors.company,
          contact_info: vendors.contactInfo,
          address: vendors.address,
          phone: vendors.phone,
          email: vendors.email,
          createdAt: vendors.createdAt,
          updatedAt: vendors.updatedAt,
          price: supplyVendors.price,
          vendorPartNumber: supplyVendors.vendorPartNumber,
          isPreferred: supplyVendors.isPreferred
        })
        .from(vendors)
        .innerJoin(supplyVendors, eq(vendors.id, supplyVendors.vendorId))
        .where(eq(supplyVendors.supplyId, supplyId))
        .orderBy(vendors.company);

      // If we found specific vendors for this supply, return them
      if (supplyVendorData.length > 0) {
        return supplyVendorData;
      }

      // Fallback: return all vendors if no specific ones found
      console.log(`No specific vendors found for supply ${supplyId}, returning all vendors as fallback`);
      const allVendors = await db
        .select({
          id: vendors.id,
          name: vendors.name,
          company: vendors.company,
          contact_info: vendors.contactInfo,
          address: vendors.address,
          phone: vendors.phone,
          email: vendors.email,
          createdAt: vendors.createdAt,
          updatedAt: vendors.updatedAt,
          price: sql<number>`0`.as('price'), // Default price when no specific pricing
          vendorPartNumber: sql<string>`''`.as('vendorPartNumber'), // Default part number
          isPreferred: sql<boolean>`false`.as('isPreferred') // Default preference
        })
        .from(vendors)
        .orderBy(vendors.company);

      return allVendors;
    } catch (error) {
      console.error(`Error getting vendors for supply ${supplyId}:`, error);
      // Return empty array on error
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
