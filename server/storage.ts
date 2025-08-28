import {
  users,
  jobs,
  partChecklists,
  partChecklistItems,
  jobTimeLogs,
  locations,
  supplies,
  supplyVendors,
  supplyLocations,
  supplyTransactions,
  vendors,
  purchaseOrders,
  purchaseOrderItems,
  locationCategories,
  inventoryMovements,
  vendorContacts,
  inventoryAlerts,
  jobSheets,
  jobHardware,
  jobRods,
  type User,
  type InsertUser,
  type Job,
  type JobWithChecklists,
  type CreateJob,
  type JobTimeLog,
  type PartChecklistType,
  type InsertPartChecklist,
  type PartChecklistItemType,
  type InsertPartChecklistItem,
  type Location,
  type InsertLocation,
  type Supply,
  type InsertSupply,
  type SupplyWithLocation,
  type SupplyTransaction,
  type InsertSupplyTransaction,
  type Vendor,
  type InsertVendor,
  type PurchaseOrderWithItems,
  type InsertPurchaseOrder,
  type InsertPurchaseOrderItem,
  type LocationCategory,
  type InsertLocationCategory,
  type InventoryMovement,
  type InsertInventoryMovement,
  type JobSheet,
  type JobHardware,
  type JobRod,
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
  createJob(jobData: CreateJob): Promise<JobWithChecklists>;
  getJob(id: number): Promise<JobWithChecklists | undefined>;
  getAllJobs(search?: string, status?: string): Promise<JobWithChecklists[]>;
  updateJobStatus(id: number, status: string): Promise<void>;
  startJobTimer(jobId: number, userId?: number): Promise<void>;
  stopJobTimer(jobId: number): Promise<void>;
  startJob(id: number, userId: number): Promise<void>;
  pauseJob(id: number): Promise<void>;
  resumeJob(id: number): Promise<void>;
  completeJob(id: number): Promise<void>;
  deleteJob(jobId: number): Promise<void>;
  // Part Checklist management
  createChecklist(jobId: number, data: InsertPartChecklist): Promise<PartChecklistType>;
  getChecklistsForJob(jobId: number): Promise<PartChecklistType[]>;
  addChecklistItem(checklistId: number, data: InsertPartChecklistItem): Promise<PartChecklistItemType>;
  updateChecklistItem(itemId: number, isCompleted: boolean, completedBy?: number): Promise<void>;
  deleteChecklistItem(itemId: number): Promise<void>;
  deleteChecklist(checklistId: number): Promise<void>;

  // Supply management (new)
  getAllSupplies(): Promise<SupplyWithLocation[]>;
  getSupply(id: number): Promise<any>;
  createSupply(supply: InsertSupply): Promise<Supply>;
  updateSupply(id: number, supply: Partial<InsertSupply>): Promise<void>;
  deleteSupply(id: number): Promise<void>;
  searchSupplies(query: string): Promise<SupplyWithLocation[]>;
  updateSupplyQuantity(id: number, quantity: number, type: 'receive' | 'use' | 'adjust', description?: string, jobId?: number, userId?: number): Promise<void>;
  allocateSupplyForJob(supplyId: number, quantity: number, jobId: number, locationId: number, userId?: number): Promise<void>;

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
  private async calculateJobStatus(job: JobWithChecklists): Promise<string> {
    let totalItems = 0;
    let completedItems = 0;
    let skippedItems = 0;
    let hasAnyActivity = false; // Track if any items have been marked (completed or skipped)

    // Count checklist items
    for (const checklist of job.checklists || []) {
      const itemStatuses = checklist.items || [];
      const completedCount = itemStatuses.filter(item => item.isCompleted).length;
      // Assume skipped is a status if available; otherwise, just use completed
      // For now, assuming no skipped for checklists, but can add if schema has it

      totalItems += itemStatuses.length;
      completedItems += completedCount;

      if (completedCount > 0) {
        hasAnyActivity = true;
      }
    }

    // Calculate effective total (excluding skipped items if applicable)
    const effectiveTotalItems = totalItems - skippedItems;

    // Determine status based on activity and completion
    if (!hasAnyActivity) {
      return 'waiting'; // No items have been marked at all
    } else if (completedItems < effectiveTotalItems) {
      return 'in_progress'; // Some activity but not all non-skipped items are completed
    } else {
      return 'done'; // All non-skipped items are completed
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

  async getAllVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(vendors.name);
  }

  async createOneVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, vendorData: Partial<InsertVendor>): Promise<void> {
    await db.update(vendors).set(vendorData).where(eq(vendors.id, id));
  }

  async deleteVendor(id: number): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  async createJob(jobData: CreateJob): Promise<JobWithChecklists> {
    const jobNumber = `JOB-${Date.now()}`;

    const [job] = await db.insert(jobs).values({
      jobNumber,
      customerName: jobData.customerName,
      jobName: jobData.jobName,
    }).returning();

    return this.getJob(job.id) as Promise<JobWithChecklists>;
  }

  async getJob(id: number): Promise<JobWithChecklists | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) return undefined;

    const checklists = await this.getChecklistsForJob(id);
    const timeLogs = await db.select().from(jobTimeLogs).where(eq(jobTimeLogs.jobId, id));

    const jobWithChecklists = {
      ...job,
      checklists,
      jobTimeLogs: timeLogs as JobTimeLog[],
    } as JobWithChecklists;

    // Only auto-update status if job is not manually paused
    if (job.status !== 'paused') {
      const calculatedStatus = await this.calculateJobStatus(jobWithChecklists);
      if (job.status !== calculatedStatus) {
        await this.updateJobStatus(job.id, calculatedStatus);
        jobWithChecklists.status = calculatedStatus;
      }
    }

    return jobWithChecklists;
  }

  async getAllJobs(search?: string, status?: string): Promise<JobWithChecklists[]> {
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

    const jobsList = await db
      .select()
      .from(jobs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(jobs.createdAt));

    const jobsWithData = await Promise.all(
      jobsList.map(async (job) => {
        return this.getJob(job.id);
      })
    );

    return jobsWithData.filter(job => job !== undefined) as JobWithChecklists[];
  }

  async updateJobStatus(id: number, status: string): Promise<void> {
    await db
      .update(jobs)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));
  }

  async startJobTimer(jobId: number, userId?: number): Promise<void> {
    const existingActiveLog = await db.select().from(jobTimeLogs).where(and(eq(jobTimeLogs.jobId, jobId), sql`${jobTimeLogs.endTime} IS NULL`));

    if (existingActiveLog.length > 0) {
      return;
    }

    const now = new Date();

    await db.insert(jobTimeLogs).values({
      jobId,
      startTime: now,
      userId,
    });
  }

  async stopJobTimer(jobId: number): Promise<void> {
    const now = new Date();

    await db
      .update(jobTimeLogs)
      .set({
        endTime: now,
      })
      .where(and(eq(jobTimeLogs.jobId, jobId), sql`${jobTimeLogs.endTime} IS NULL`));

    const timeLogs = await db.select().from(jobTimeLogs).where(eq(jobTimeLogs.jobId, jobId));
    const totalDuration = timeLogs.reduce((total, log) => {
      if (log.endTime) {
        return total + (log.endTime.getTime() - log.startTime.getTime()) / 1000;
      }
      return total;
    }, 0);

    await db
      .update(jobs)
      .set({
        totalDuration: Math.round(totalDuration),
        updatedAt: now,
      })
      .where(eq(jobs.id, jobId));
  }

  async startJob(id: number, userId: number): Promise<void> {
    const now = new Date();

    await db
      .update(jobs)
      .set({
        status: 'in_progress',
        startTime: now,
        updatedAt: now,
      })
      .where(eq(jobs.id, id));

    await db.insert(jobTimeLogs).values({
      jobId: id,
      startTime: now,
      userId,
    });
  }

  async pauseJob(id: number): Promise<void> {
    const now = new Date();

    await db
      .update(jobs)
      .set({
        status: 'paused',
        updatedAt: now,
      })
      .where(eq(jobs.id, id));

    await db
      .update(jobTimeLogs)
      .set({
        endTime: now,
      })
      .where(and(eq(jobTimeLogs.jobId, id), sql`${jobTimeLogs.endTime} IS NULL`));
  }

  async resumeJob(id: number): Promise<void> {
    const now = new Date();

    const job = await this.getJob(id);
    if (!job) return;

    const correctStatus = await this.calculateJobStatus(job);

    await db
      .update(jobs)
      .set({
        status: correctStatus,
        updatedAt: now,
      })
      .where(eq(jobs.id, id));

    if (correctStatus === 'in_progress') {
      await db.insert(jobTimeLogs).values({
        jobId: id,
        startTime: now,
      });
    }

    console.log('Job resumed - status set to:', correctStatus);
  }

  async completeJob(id: number): Promise<void> {
    const now = new Date();

    await db
      .update(jobTimeLogs)
      .set({
        endTime: now,
      })
      .where(and(eq(jobTimeLogs.jobId, id), sql`${jobTimeLogs.endTime} IS NULL`));

    const timeLogs = await db.select().from(jobTimeLogs).where(eq(jobTimeLogs.jobId, id));
    const totalDuration = timeLogs.reduce((total, log) => {
      if (log.endTime) {
        return total + (log.endTime.getTime() - log.startTime.getTime()) / 1000;
      }
      return total;
    }, 0);

    await db
      .update(jobs)
      .set({
        status: 'done',
        endTime: now,
        totalDuration: Math.round(totalDuration),
        updatedAt: now,
      })
      .where(eq(jobs.id, id));
  }

  async deleteJob(jobId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete checklist items
      await tx.delete(partChecklistItems).where(
        inArray(partChecklistItems.checklistId,
          tx.select({ id: partChecklists.id }).from(partChecklists).where(eq(partChecklists.jobId, jobId))
        )
      );

      // Delete checklists
      await tx.delete(partChecklists).where(eq(partChecklists.jobId, jobId));

      // Delete time logs
      await tx.delete(jobTimeLogs).where(eq(jobTimeLogs.jobId, jobId));

      // Delete sheets, hardware, rods
      await tx.delete(jobSheets).where(eq(jobSheets.jobId, jobId));
      await tx.delete(jobHardware).where(eq(jobHardware.jobId, jobId));
      await tx.delete(jobRods).where(eq(jobRods.jobId, jobId));

      // Delete job
      await tx.delete(jobs).where(eq(jobs.id, jobId));
    });
  }

  async createChecklist(jobId: number, data: InsertPartChecklist): Promise<PartChecklistType> {
    const [checklist] = await db.insert(partChecklists).values({
      ...data,
      jobId
    }).returning();

    return checklist as PartChecklistType;
  }

  async getChecklistsForJob(jobId: number): Promise<PartChecklistType[]> {
    const checklists = await db.select().from(partChecklists).where(eq(partChecklists.jobId, jobId)).orderBy(partChecklists.createdAt);
    return await Promise.all(
      checklists.map(async (checklist) => {
        const items = await db.select().from(partChecklistItems).where(eq(partChecklistItems.checklistId, checklist.id)).orderBy(partChecklistItems.sortOrder);
        return { ...checklist, items } as PartChecklistType;
      })
    );
  }

  async addChecklistItem(checklistId: number, data: InsertPartChecklistItem): Promise<PartChecklistItemType> {
    const [item] = await db.insert(partChecklistItems).values({
      ...data,
      checklistId
    }).returning();

    return item as PartChecklistItemType;
  }

  async updateChecklistItem(itemId: number, isCompleted: boolean, completedBy?: number): Promise<void> {
    const updateData: any = {};
    updateData.isCompleted = isCompleted;
    updateData.completedAt = isCompleted ? new Date() : null;
    if (isCompleted && completedBy) {
      updateData.completedBy = completedBy;
    }

    await db.update(partChecklistItems).set(updateData).where(eq(partChecklistItems.id, itemId));
  }

  async deleteChecklistItem(itemId: number): Promise<void> {
    await db.delete(partChecklistItems).where(eq(partChecklistItems.id, itemId));
  }

  async deleteChecklist(checklistId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(partChecklistItems).where(eq(partChecklistItems.checklistId, checklistId));
      await tx.delete(partChecklists).where(eq(partChecklists.id, checklistId));
    });
  }

  // Supply management (new)
  async getAllSupplies(): Promise<SupplyWithLocation[]> {
    const suppliesData = await db.select().from(supplies).orderBy(supplies.name);

    const supplyLocationRows = await db.select({
      supplyId: supplyLocations.supplyId,
      locationId: supplyLocations.locationId,
      onHandQuantity: supplyLocations.onHandQuantity,
      allocatedQuantity: supplyLocations.allocatedQuantity,
      availableQuantity: supplyLocations.availableQuantity,
      minimumQuantity: supplyLocations.minimumQuantity,
      orderGroupSize: supplyLocations.orderGroupSize,
      locationName: locations.name,
      categoryId: locations.categoryId,
    })
      .from(supplyLocations)
      .leftJoin(locations, eq(supplyLocations.locationId, locations.id));

    const supplyIdToSummary: Record<number, any> = {};
    for (const row of supplyLocationRows) {
      const key = row.supplyId;
      if (!supplyIdToSummary[key]) {
        supplyIdToSummary[key] = {
          totalOnHand: 0,
          totalAllocated: 0,
          totalAvailable: 0,
          locationsSummary: [] as any[],
        };
      }
      supplyIdToSummary[key].totalOnHand += row.onHandQuantity || 0;
      supplyIdToSummary[key].totalAllocated += row.allocatedQuantity || 0;
      supplyIdToSummary[key].totalAvailable += row.availableQuantity || 0;
      supplyIdToSummary[key].locationsSummary.push({
        locationId: row.locationId,
        locationName: row.locationName,
        categoryId: row.categoryId,
        onHandQuantity: row.onHandQuantity || 0,
        allocatedQuantity: row.allocatedQuantity || 0,
        availableQuantity: row.availableQuantity || 0,
        minimumQuantity: row.minimumQuantity || 0,
        orderGroupSize: row.orderGroupSize || 1,
      });
    }

    const suppliesWithLocation = suppliesData.map(supply => ({
      ...supply,
      location: null,
      ...(supplyIdToSummary[supply.id] || {
        totalOnHand: 0,
        totalAllocated: 0,
        totalAvailable: 0,
        locationsSummary: [],
      })
    }));

    return suppliesWithLocation;
  }

  async getSupply(id: number): Promise<any> {
    const [supply] = await db.select().from(supplies).where(eq(supplies.id, id));
    if (!supply) return undefined;

    const vendorRelations = await db.select({
      id: supplyVendors.id,
      vendorId: supplyVendors.vendorId,
      vendorPartNumber: supplyVendors.vendorPartNumber,
      price: supplyVendors.price,
      isPreferred: supplyVendors.isPreferred
    }).from(supplyVendors).where(eq(supplyVendors.supplyId, id));

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
  }

  async createSupply(supplyData: any): Promise<Supply> {
    const { vendors, locations, ...basicSupplyData } = supplyData;

    const [supply] = await db.insert(supplies).values(basicSupplyData).returning();

    if (vendors && vendors.length > 0) {
      const vendorRelations = vendors.map((vendor: any) => ({
        supplyId: supply.id,
        vendorId: vendor.vendorId,
        vendorPartNumber: vendor.vendorPartNumber,
        price: vendor.price,
        isPreferred: vendor.isPreferred
      }));
      await db.insert(supplyVendors).values(vendorRelations);
    }

    if (locations && locations.length > 0) {
      const locationRelations = locations.map((location: any) => ({
        supplyId: supply.id,
        locationId: location.locationId,
        onHandQuantity: location.onHandQuantity || 0,
        minimumQuantity: location.minimumQuantity || 0,
        orderGroupSize: location.orderGroupSize || 1,
        availableQuantity: (location.onHandQuantity || 0)
      }));
      await db.insert(supplyLocations).values(locationRelations);
      await db.update(supplyLocations)
        .set({ availableQuantity: sql`${supplyLocations.onHandQuantity} - ${supplyLocations.allocatedQuantity}` })
        .where(eq(supplyLocations.supplyId, supply.id));
    }

    return supply;
  }

  async updateSupply(id: number, supplyData: any): Promise<void> {
    const { vendors, locations, ...basicSupplyData } = supplyData;

    await db.update(supplies).set(basicSupplyData).where(eq(supplies.id, id));

    await db.delete(supplyVendors).where(eq(supplyVendors.supplyId, id));
    if (vendors && vendors.length > 0) {
      const vendorRelations = vendors.map((vendor: any) => ({
        supplyId: id,
        vendorId: vendor.vendorId,
        vendorPartNumber: vendor.vendorPartNumber,
        price: vendor.price,
        isPreferred: vendor.isPreferred
      }));
      await db.insert(supplyVendors).values(vendorRelations);
    }

    await db.delete(supplyLocations).where(eq(supplyLocations.supplyId, id));
    if (locations && locations.length > 0) {
      const locationRelations = locations.map((location: any) => ({
        supplyId: id,
        locationId: location.locationId,
        onHandQuantity: location.onHandQuantity || 0,
        minimumQuantity: location.minimumQuantity || 0,
        orderGroupSize: location.orderGroupSize || 1,
        availableQuantity: (location.onHandQuantity || 0)
      }));
      await db.insert(supplyLocations).values(locationRelations);
      await db.update(supplyLocations)
        .set({ availableQuantity: sql`${supplyLocations.onHandQuantity} - ${supplyLocations.allocatedQuantity}` })
        .where(eq(supplyLocations.supplyId, id));
    }
  }

  async deleteSupply(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      const poi = await tx.select({ count: sql<number>`count(*)` })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.supplyId, id));
      if (Number(poi[0].count) > 0) {
        throw new Error("Cannot delete supply: it is referenced by existing purchase orders");
      }

      await tx.delete(supplyVendors).where(eq(supplyVendors.supplyId, id));
      await tx.delete(supplyLocations).where(eq(supplyLocations.supplyId, id));
      await tx.delete(supplyTransactions).where(eq(supplyTransactions.supplyId, id));
      await tx.delete(inventoryMovements).where(eq(inventoryMovements.supplyId, id));

      await tx.delete(supplies).where(eq(supplies.id, id));
    });
  }

  async searchSupplies(query: string): Promise<SupplyWithLocation[]> {
    const suppliesData = await db.select()
      .from(supplies)
      .where(ilike(supplies.name, `%${query}%`))
      .orderBy(supplies.name);

    if (suppliesData.length === 0) return [];

    const supplyIds = suppliesData.map(s => s.id);
    const supplyLocationRows = await db.select({
      supplyId: supplyLocations.supplyId,
      locationId: supplyLocations.locationId,
      onHandQuantity: supplyLocations.onHandQuantity,
      allocatedQuantity: supplyLocations.allocatedQuantity,
      availableQuantity: supplyLocations.availableQuantity,
      minimumQuantity: supplyLocations.minimumQuantity,
      orderGroupSize: supplyLocations.orderGroupSize,
      locationName: locations.name,
      categoryId: locations.categoryId,
    })
      .from(supplyLocations)
      .leftJoin(locations, eq(supplyLocations.locationId, locations.id))
      .where(inArray(supplyLocations.supplyId, supplyIds));

    const supplyIdToSummary: Record<number, any> = {};
    for (const row of supplyLocationRows) {
      const key = row.supplyId;
      if (!supplyIdToSummary[key]) {
        supplyIdToSummary[key] = {
          totalOnHand: 0,
          totalAllocated: 0,
          totalAvailable: 0,
          locationsSummary: [] as any[],
        };
      }
      supplyIdToSummary[key].totalOnHand += row.onHandQuantity || 0;
      supplyIdToSummary[key].totalAllocated += row.allocatedQuantity || 0;
      supplyIdToSummary[key].totalAvailable += row.availableQuantity || 0;
      supplyIdToSummary[key].locationsSummary.push({
        locationId: row.locationId,
        locationName: row.locationName,
        categoryId: row.categoryId,
        onHandQuantity: row.onHandQuantity || 0,
        allocatedQuantity: row.allocatedQuantity || 0,
        availableQuantity: row.availableQuantity || 0,
        minimumQuantity: row.minimumQuantity || 0,
        orderGroupSize: row.orderGroupSize || 1,
      });
    }

    const suppliesWithLocation = suppliesData.map(supply => ({
      ...supply,
      location: null,
      ...(supplyIdToSummary[supply.id] || {
        totalOnHand: 0,
        totalAllocated: 0,
        totalAvailable: 0,
        locationsSummary: [],
      })
    }));

    return suppliesWithLocation;
  }

  async updateSupplyQuantity(id: number, quantity: number, type: 'receive' | 'use' | 'adjust', description?: string, jobId?: number, userId?: number): Promise<void> {
    await db.insert(supplyTransactions).values({
      supplyId: id,
      type,
      quantity,
      description,
      jobId,
      userId
    });
  }

  async allocateSupplyForJob(supplyId: number, quantity: number, jobId: number, locationId: number, userId?: number): Promise<void> {
    await db.insert(supplyTransactions).values({
      supplyId,
      type: 'allocate',
      quantity,
      description: `Allocated for job ${jobId}`,
      jobId,
      userId,
    });

    const existing = await db.select().from(supplyLocations).where(and(eq(supplyLocations.supplyId, supplyId), eq(supplyLocations.locationId, locationId)));
    if (existing.length === 0) {
      await db.insert(supplyLocations).values({
        supplyId,
        locationId,
        onHandQuantity: 0,
        allocatedQuantity: 0,
        availableQuantity: 0,
        minimumQuantity: 0,
        reorderPoint: 0,
        orderGroupSize: 1
      });
    }

    await db.update(supplyLocations)
      .set({
        allocatedQuantity: sql`${supplyLocations.allocatedQuantity} + ${quantity}`,
        availableQuantity: sql`${supplyLocations.onHandQuantity} - (${supplyLocations.allocatedQuantity} + ${quantity})`
      })
      .where(and(eq(supplyLocations.supplyId, supplyId), eq(supplyLocations.locationId, locationId)));
  }

  // Location management (new)
  async getAllLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(locations.name);
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
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
    return await db
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
  }

  // Enhanced inventory management (new)
  // Check-in/Check-out operations
  async checkInInventory(supplyId: number, locationId: number, quantity: number, referenceType?: string, referenceId?: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(inventoryMovements).values({
      supplyId,
      fromLocationId: null,
      toLocationId: locationId,
      quantity,
      movementType: 'check_in',
      referenceType,
      referenceId,
      notes,
      userId
    });
  }

  async checkOutInventory(supplyId: number, locationId: number, quantity: number, referenceType?: string, referenceId?: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(inventoryMovements).values({
      supplyId,
      fromLocationId: locationId,
      toLocationId: null,
      quantity,
      movementType: 'check_out',
      referenceType,
      referenceId,
      notes,
      userId
    });
  }

  async transferInventory(supplyId: number, fromLocationId: number, toLocationId: number, quantity: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(inventoryMovements).values({
      supplyId,
      fromLocationId,
      toLocationId,
      quantity,
      movementType: 'transfer',
      notes,
      userId
    });
  }

  async adjustInventory(supplyId: number, locationId: number, quantity: number, notes?: string, userId?: number): Promise<void> {
    await db.insert(inventoryMovements).values({
      supplyId,
      fromLocationId: locationId,
      toLocationId: locationId,
      quantity,
      movementType: 'adjustment',
      notes,
      userId
    });
  }

  // Inventory movements
  async getInventoryMovements(supplyId?: number, locationId?: number, fromDate?: Date, toDate?: Date): Promise<any[]> {
    let conditions = [];
    if (supplyId) conditions.push(eq(inventoryMovements.supplyId, supplyId));
    if (locationId) conditions.push(or(eq(inventoryMovements.fromLocationId, locationId), eq(inventoryMovements.toLocationId, locationId)));
    if (fromDate) conditions.push(gte(inventoryMovements.createdAt, fromDate));
    if (toDate) conditions.push(lte(inventoryMovements.createdAt, toDate));

    return await db.select().from(inventoryMovements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryMovements.createdAt));
  }

  async getInventoryMovement(id: number): Promise<any> {
    const [movement] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
    return movement;
  }

  // Reorder management
  async getNeedToPurchase(): Promise<any[]> {
    return await db.select().from(supplyLocations)
      .leftJoin(supplies, eq(supplyLocations.supplyId, supplies.id))
      .where(sql`${supplyLocations.onHandQuantity} < ${supplyLocations.minimumQuantity}`);
  }

  async getReorderSuggestions(): Promise<any[]> {
    return await db.select().from(supplyLocations)
      .leftJoin(supplies, eq(supplyLocations.supplyId, supplies.id))
      .where(sql`${supplyLocations.onHandQuantity} < ${supplyLocations.reorderPoint}`);
  }

  async updateReorderPoint(supplyLocationId: number, reorderPoint: number): Promise<void> {
    await db.update(supplyLocations).set({ reorderPoint }).where(eq(supplyLocations.id, supplyLocationId));
  }

  async getInventoryAlerts(): Promise<any[]> {
    return await db.select().from(inventoryAlerts).orderBy(desc(inventoryAlerts.createdAt));
  }

  async resolveInventoryAlert(alertId: number): Promise<void> {
    await db.delete(inventoryAlerts).where(eq(inventoryAlerts.id, alertId));
  }

  // Location categories
  async getAllLocationCategories(): Promise<any[]> {
    return await db.select().from(locationCategories).orderBy(locationCategories.name);
  }

  async createLocationCategory(category: any): Promise<any> {
    const [newCategory] = await db.insert(locationCategories).values(category).returning();
    return newCategory;
  }

  async updateLocationCategory(id: number, category: any): Promise<void> {
    await db.update(locationCategories).set(category).where(eq(locationCategories.id, id));
  }

  async deleteLocationCategory(id: number): Promise<void> {
    await db.delete(locationCategories).where(eq(locationCategories.id, id));
  }

  // Purchase order management
  async getAllPurchaseOrders(fromDate?: string, toDate?: string): Promise<PurchaseOrderWithItems[]> {
    let conditions = [];
    if (fromDate) conditions.push(gte(purchaseOrders.dateOrdered, new Date(fromDate)));
    if (toDate) conditions.push(lte(purchaseOrders.dateOrdered, new Date(toDate)));

    const orders = await db.select().from(purchaseOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchaseOrders.dateOrdered));

    return await Promise.all(
      orders.map(async (order) => {
        const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, order.id));
        const itemsWithDetails = await Promise.all(
          items.map(async (item) => {
            const [supply] = await db.select().from(supplies).where(eq(supplies.id, item.supplyId)).limit(1);
            const [vendor] = await db.select().from(vendors).where(eq(vendors.id, item.vendorId)).limit(1);
            return { ...item, supply, vendor };
          })
        );

        const [createdByUser] = await db.select().from(users).where(eq(users.id, order.createdBy)).limit(1);

        return { ...order, items: itemsWithDetails, createdByUser } as PurchaseOrderWithItems;
      })
    );
  }

  async createPurchaseOrder(orderData: InsertPurchaseOrder, items: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithItems> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const existingPOs = await db.select().from(purchaseOrders).where(sql`po_number LIKE 'PO-${dateStr}-%'`);
    const poNumber = `PO-${dateStr}-${String(existingPOs.length + 1).padStart(3, '0')}`;

    const totalAmount = items.reduce((sum, item) => sum + item.orderQuantity * item.pricePerUnit, 0);

    const [po] = await db.insert(purchaseOrders).values({ ...orderData, poNumber, totalAmount }).returning();

    await db.insert(purchaseOrderItems).values(items.map(item => ({ ...item, purchaseOrderId: po.id })));

    return this.getAllPurchaseOrders().then(pos => pos.find(p => p.id === po.id)!);
  }

  async updatePurchaseOrderReceived(id: number, dateReceived: Date): Promise<void> {
    await db.update(purchaseOrders).set({ dateReceived, status: 'received', updatedAt: new Date() }).where(eq(purchaseOrders.id, id));
  }

  async getVendorsForSupply(supplyId: number): Promise<Vendor[]> {
    const supplyVendorsData = await db.select({
      vendor: vendors,
    }).from(supplyVendors)
      .innerJoin(vendors, eq(supplyVendors.vendorId, vendors.id))
      .where(eq(supplyVendors.supplyId, supplyId));

    if (supplyVendorsData.length > 0) {
      return supplyVendorsData.map(sv => sv.vendor);
    }

    return await db.select().from(vendors);
  }

  async getJobSheets(jobId: number): Promise<JobSheet[]> {
    return await db.select().from(jobSheets).where(eq(jobSheets.jobId, jobId));
  }

  async createJobSheet(jobId: number, data: { materialType: string; qty: number }): Promise<JobSheet> {
    const [sheet] = await db.insert(jobSheets).values({ jobId, ...data }).returning();
    return sheet;
  }

  async deleteJobSheet(jobId: number, sheetId: number): Promise<void> {
    await db.delete(jobSheets).where(and(eq(jobSheets.jobId, jobId), eq(jobSheets.id, sheetId)));
  }

  async getJobHardware(jobId: number): Promise<JobHardware[]> {
    return await db.select().from(jobHardware).where(eq(jobHardware.jobId, jobId));
  }

  async createJobHardware(jobId: number, data: { supplyId: number; allocated: number; used: number; stillRequired: number }): Promise<JobHardware> {
    const [hardware] = await db.insert(jobHardware).values({ jobId, ...data }).returning();
    return hardware;
  }

  async deleteJobHardware(jobId: number, hardwareId: number): Promise<void> {
    await db.delete(jobHardware).where(and(eq(jobHardware.jobId, jobId), eq(jobHardware.id, hardwareId)));
  }

  async getJobRods(jobId: number): Promise<JobRod[]> {
    return await db.select().from(jobRods).where(eq(jobRods.jobId, jobId));
  }

  async createJobRod(jobId: number, data: { rodName: string; lengthInches: string }): Promise<JobRod> {
    const [rod] = await db.insert(jobRods).values({ jobId, ...data }).returning();
    return rod;
  }

  async deleteJobRod(jobId: number, rodId: number): Promise<void> {
    await db.delete(jobRods).where(and(eq(jobRods.jobId, jobId), eq(jobRods.id, rodId)));
  }

  async importJobData(jobId: number, category: "sheets" | "hardware" | "rods", file: File): Promise<{ imported: number }> {
    // File parsing would be in routes, but for completeness, assume data is parsed here or adjust interface
    // For now, placeholder
    return { imported: 0 };
  }

  async getDashboardStats(sheetsFrom?: string, sheetsTo?: string, timeFrom?: string, timeTo?: string): Promise<{
    activeJobs: number;
    itemsCheckedToday: number;
    avgJobTime: number;
    avgItemTime: number;
    materialColors: number;
    jobsByStatus: { waiting: number; in_progress: number; done: number };
  }> {
    const statusCounts = await db.select({
      status: jobs.status,
      count: sql<number>`count(*)`
    }).from(jobs).groupBy(jobs.status);

    const jobsByStatus = {
      waiting: 0,
      in_progress: 0,
      done: 0
    };

    statusCounts.forEach(({ status, count }) => {
      if (status === 'waiting') jobsByStatus.waiting = Number(count);
      else if (status === 'in_progress') jobsByStatus.in_progress = Number(count);
      else if (status === 'done') jobsByStatus.done = Number(count);
    });

    const itemsCheckedToday = Number((await db.select({ count: sql<number>`count(*)` }).from(partChecklistItems).where(sql`completed_at >= CURRENT_DATE`))[0].count);

    const avgTimeResult = await db.select({
      avgDuration: sql<number>`avg(${jobs.totalDuration})`
    }).from(jobs)
      .where(sql`${jobs.totalDuration} IS NOT NULL`);

    const avgJobTime = Math.round(Number(avgTimeResult[0]?.avgDuration || 0));

    let avgItemTime = 0;
    const jobsForItemTime = await db.query.jobs.findMany({
      where: sql`${jobs.totalDuration} IS NOT NULL`,
      with: {
        checklists: {
          with: {
            items: true
          }
        }
      }
    });

    if (jobsForItemTime.length > 0) {
      const perJobItemTimes = jobsForItemTime.map(job => {
        let totalItems = 0;
        job.checklists.forEach(checklist => {
          totalItems += checklist.items.length;
        });
        return totalItems > 0 ? (job.totalDuration || 0) / totalItems : 0;
      }).filter(time => time > 0);
      avgItemTime = perJobItemTimes.length > 0 ? perJobItemTimes.reduce((a, b) => a + b, 0) / perJobItemTimes.length : 0;
    }

    const materialColors = Number((await db.select({ count: sql<number>`count(*)` }).from(supplies))[0].count);

    return {
      activeJobs: jobsByStatus.waiting + jobsByStatus.in_progress,
      itemsCheckedToday,
      avgJobTime,
      avgItemTime,
      materialColors,
      jobsByStatus
    };
  }

}

export const storage = new DatabaseStorage();
