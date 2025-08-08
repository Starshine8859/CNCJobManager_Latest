import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: text("role").notNull().default("user"), // user, admin, super_admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// Sessions table for authentication
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id").references(() => users.id).notNull(),
  data: text("data").notNull(), // JSON string containing session data
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Locations table (replaces color groups)
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Supplies table (replaces colors with inventory management)
export const supplies = pgTable("supplies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hexColor: text("hex_color").notNull(),
  pieceSize: text("piece_size").notNull().default("sheet"), // sheet, piece, pair, etc.
  partNumber: text("part_number"), // Optional part number
  description: text("description"), // Multi-line description
  availableInCatalog: boolean("available_in_catalog").default(false), // Available in catalog
  retailPrice: integer("retail_price").default(0), // Default selling price in cents
  imageUrl: text("image_url"), // URL or path to uploaded image
  texture: text("texture"), // URL or path to texture image
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Supply-Vendor linking table (many-to-many)
export const supplyVendors = pgTable("supply_vendors", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  vendorPartNumber: text("vendor_part_number"), // Vendor's specific part number
  price: integer("price").notNull().default(0), // Price from this vendor in cents
  isPreferred: boolean("is_preferred").default(false), // Preferred vendor selection
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Supply-Location linking table (many-to-many)
export const supplyLocations = pgTable("supply_locations", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  onHandQuantity: integer("on_hand_quantity").notNull().default(0), // Current stock at location
  minimumQuantity: integer("minimum_quantity").notNull().default(0), // Reorder threshold
  orderGroupSize: integer("order_group_size").notNull().default(1), // Order in groups of
  allocationStatus: boolean("allocation_status").default(false), // Allocation priority
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Supply transactions for tracking usage
export const supplyTransactions = pgTable("supply_transactions", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  type: text("type").notNull(), // 'allocate', 'use', 'receive', 'adjust'
  quantity: integer("quantity").notNull(),
  description: text("description"),
  jobId: integer("job_id").references(() => jobs.id), // if related to a job
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(), // Company name field
  contactInfo: text("contact_info"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(), // PO-YYYYMMDD-XXX
  dateOrdered: timestamp("date_ordered").defaultNow().notNull(),
  dateReceived: timestamp("date_received"),
  totalAmount: integer("total_amount").notNull().default(0), // in cents
  status: text("status").notNull().default("pending"), // pending, ordered, received
  additionalComments: text("additional_comments"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id).notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(), // in cents
  totalPrice: integer("total_price").notNull(), // in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Legacy tables (will be migrated and eventually removed)
export const colorGroups = pgTable("color_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hexColor: text("hex_color").notNull(),
  groupId: integer("group_id").references(() => colorGroups.id),
  texture: text("texture"), // URL or path to texture image
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull().default("waiting"), // waiting, in_progress, paused, done
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  totalDuration: integer("total_duration"), // in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cutlists = pgTable("cutlists", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  name: text("name").notNull(), // e.g., "Cutlist 1", "Cutlist 2"
  orderIndex: integer("order_index").notNull().default(0), // For ordering cutlists
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobMaterials = pgTable("job_materials", {
  id: serial("id").primaryKey(),
  cutlistId: integer("cutlist_id").references(() => cutlists.id),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  totalSheets: integer("total_sheets").notNull(),
  completedSheets: integer("completed_sheets").notNull().default(0),
  sheetStatuses: text("sheet_statuses").array().default([]), // Array of 'cut', 'skip', 'pending'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobTimeLogs = pgTable("job_time_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recutEntries = pgTable("recut_entries", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").references(() => jobMaterials.id).notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"), // Optional reason for the recut
  sheetStatuses: text("sheet_statuses").array().default([]), // Array of 'cut', 'skip', 'pending' for each recut sheet
  completedSheets: integer("completed_sheets").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").references(() => users.id),
});

// Track sheet cutting activity with timestamps
export const sheetCutLogs = pgTable("sheet_cut_logs", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").references(() => jobMaterials.id).notNull(),
  sheetIndex: integer("sheet_index").notNull(), // Which sheet (0-based)
  status: text("status").notNull(), // 'cut', 'skip', 'pending'
  isRecut: boolean("is_recut").notNull().default(false), // Whether this is a recut sheet
  recutId: integer("recut_id").references(() => recutEntries.id), // Reference to recut entry if applicable
  cutAt: timestamp("cut_at").defaultNow().notNull(), // When the sheet was cut/skipped
  userId: integer("user_id").references(() => users.id), // Who performed the action
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const jobsRelations = relations(jobs, ({ many }) => ({
  cutlists: many(cutlists),
  timeLogs: many(jobTimeLogs),
}));

export const cutlistsRelations = relations(cutlists, ({ one, many }) => ({
  job: one(jobs, {
    fields: [cutlists.jobId],
    references: [jobs.id],
  }),
  materials: many(jobMaterials),
}));

export const jobMaterialsRelations = relations(jobMaterials, ({ one, many }) => ({
  cutlist: one(cutlists, {
    fields: [jobMaterials.cutlistId],
    references: [cutlists.id],
  }),
  supply: one(supplies, {
    fields: [jobMaterials.supplyId],
    references: [supplies.id],
  }),
  recutEntries: many(recutEntries),
}));

export const colorsRelations = relations(colors, ({ one, many }) => ({
  group: one(colorGroups, {
    fields: [colors.groupId],
    references: [colorGroups.id],
  }),
  jobMaterials: many(jobMaterials),
}));

export const colorGroupsRelations = relations(colorGroups, ({ many }) => ({
  colors: many(colors),
}));

export const jobTimeLogsRelations = relations(jobTimeLogs, ({ one }) => ({
  job: one(jobs, {
    fields: [jobTimeLogs.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [jobTimeLogs.userId],
    references: [users.id],
  }),
}));

export const recutEntriesRelations = relations(recutEntries, ({ one, many }) => ({
  material: one(jobMaterials, {
    fields: [recutEntries.materialId],
    references: [jobMaterials.id],
  }),
  user: one(users, {
    fields: [recutEntries.userId],
    references: [users.id],
  }),
  sheetCutLogs: many(sheetCutLogs),
}));

export const sheetCutLogsRelations = relations(sheetCutLogs, ({ one }) => ({
  material: one(jobMaterials, {
    fields: [sheetCutLogs.materialId],
    references: [jobMaterials.id],
  }),
  recutEntry: one(recutEntries, {
    fields: [sheetCutLogs.recutId],
    references: [recutEntries.id],
  }),
  user: one(users, {
    fields: [sheetCutLogs.userId],
    references: [users.id],
  }),
}));

// New relations for supplies system
export const locationsRelations = relations(locations, ({ many }) => ({
  supplies: many(supplies),
}));

export const suppliesRelations = relations(supplies, ({ many }) => ({
  supplyVendors: many(supplyVendors),
  supplyLocations: many(supplyLocations),
  transactions: many(supplyTransactions),
}));

export const supplyVendorsRelations = relations(supplyVendors, ({ one }) => ({
  supply: one(supplies, {
    fields: [supplyVendors.supplyId],
    references: [supplies.id],
  }),
  vendor: one(vendors, {
    fields: [supplyVendors.vendorId],
    references: [vendors.id],
  }),
}));

export const supplyLocationsRelations = relations(supplyLocations, ({ one }) => ({
  supply: one(supplies, {
    fields: [supplyLocations.supplyId],
    references: [supplies.id],
  }),
  location: one(locations, {
    fields: [supplyLocations.locationId],
    references: [locations.id],
  }),
}));

export const supplyTransactionsRelations = relations(supplyTransactions, ({ one }) => ({
  supply: one(supplies, {
    fields: [supplyTransactions.supplyId],
    references: [supplies.id],
  }),
  job: one(jobs, {
    fields: [supplyTransactions.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [supplyTransactions.userId],
    references: [users.id],
  }),
}));

// Purchase order relations
export const vendorsRelations = relations(vendors, ({ many }) => ({
  purchaseOrderItems: many(purchaseOrderItems),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ many, one }) => ({
  items: many(purchaseOrderItems),
  createdByUser: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  supply: one(supplies, {
    fields: [purchaseOrderItems.supplyId],
    references: [supplies.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseOrderItems.vendorId],
    references: [vendors.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertColorGroupSchema = createInsertSchema(colorGroups).omit({
  id: true,
  createdAt: true,
});

export const insertColorSchema = createInsertSchema(colors).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  jobNumber: true,
  createdAt: true,
  updatedAt: true,
  totalDuration: true,
});

export const insertCutlistSchema = createInsertSchema(cutlists).omit({
  id: true,
  createdAt: true,
});

export const insertJobMaterialSchema = createInsertSchema(jobMaterials).omit({
  id: true,
  createdAt: true,
  completedSheets: true,
  sheetStatuses: true,
});

export const insertRecutEntrySchema = createInsertSchema(recutEntries).omit({
  id: true,
  createdAt: true,
});

export const insertSheetCutLogSchema = createInsertSchema(sheetCutLogs).omit({
  id: true,
  createdAt: true,
});

// New schemas for supplies system
export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export const insertSupplySchema = createInsertSchema(supplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Extended schema for supply creation/update with vendor and location relationships
export const insertSupplyWithRelationsSchema = insertSupplySchema.extend({
  vendors: z.array(z.object({
    id: z.number().optional(),
    vendorId: z.number().optional(),
    vendorPartNumber: z.string().optional(),
    price: z.number().optional(),
    isPreferred: z.boolean().optional(),
  })).optional(),
  locations: z.array(z.object({
    id: z.number().optional(),
    locationId: z.number().optional(),
    onHandQuantity: z.number().optional(),
    minimumQuantity: z.number().optional(),
    orderGroupSize: z.number().optional(),
    allocationStatus: z.boolean().optional(),
  })).optional(),
});

export const insertSupplyVendorSchema = createInsertSchema(supplyVendors).omit({
  id: true,
  createdAt: true,
});

export const insertSupplyLocationSchema = createInsertSchema(supplyLocations).omit({
  id: true,
  createdAt: true,
});

export const insertSupplyTransactionSchema = createInsertSchema(supplyTransactions).omit({
  id: true,
  createdAt: true,
});

// Purchase order schemas
export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  poNumber: true,
  dateOrdered: true,
  totalAmount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  totalPrice: true,
  createdAt: true,
});

export const createJobSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  jobName: z.string().min(1, "Job name is required"),
  materials: z.array(z.object({
    colorId: z.number().min(1, "Color is required"),
    totalSheets: z.number().min(1, "Must have at least 1 sheet"),
  })).min(1, "At least one material is required"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Types

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type User = typeof users.$inferSelect;
export type Vendors = typeof vendors.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ColorGroup = typeof colorGroups.$inferSelect;
export type InsertColorGroup = z.infer<typeof insertColorGroupSchema>;
export type Color = typeof colors.$inferSelect;
export type InsertColor = z.infer<typeof insertColorSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Cutlist = typeof cutlists.$inferSelect;
export type InsertCutlist = z.infer<typeof insertCutlistSchema>;
export type JobMaterial = typeof jobMaterials.$inferSelect;
export type InsertJobMaterial = z.infer<typeof insertJobMaterialSchema>;
export type JobTimeLog = typeof jobTimeLogs.$inferSelect;
export type RecutEntry = typeof recutEntries.$inferSelect;
export type InsertRecutEntry = z.infer<typeof insertRecutEntrySchema>;
export type SheetCutLog = typeof sheetCutLogs.$inferSelect;
export type InsertSheetCutLog = z.infer<typeof insertSheetCutLogSchema>;
export type CreateJob = z.infer<typeof createJobSchema>;
export type Login = z.infer<typeof loginSchema>;

// Enhanced types for frontend
export type CutlistWithMaterials = Cutlist & {
  materials: (JobMaterial & { color: Color })[];
};

export type JobWithCutlists = Job & {
  cutlists: CutlistWithMaterials[];
  timeLogs: JobTimeLog[];
};

// Keep backward compatibility - include timer logs
export type JobWithMaterials = Job & {
  cutlists: (typeof cutlists.$inferSelect & {
    materials: (typeof jobMaterials.$inferSelect & {
      color: typeof colors.$inferSelect;
      recutEntries: (typeof recutEntries.$inferSelect)[];
    })[];
  })[];
  jobTimeLogs: (typeof jobTimeLogs.$inferSelect)[];
};

export type ColorWithGroup = Color & {
  group: ColorGroup | null;
};

// New types for supplies system
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Supply = typeof supplies.$inferSelect;
export type InsertSupply = z.infer<typeof insertSupplySchema>;
export type SupplyVendor = typeof supplyVendors.$inferSelect;
export type InsertSupplyVendor = z.infer<typeof insertSupplyVendorSchema>;
export type SupplyLocation = typeof supplyLocations.$inferSelect;
export type InsertSupplyLocation = z.infer<typeof insertSupplyLocationSchema>;
export type SupplyTransaction = typeof supplyTransactions.$inferSelect;
export type InsertSupplyTransaction = z.infer<typeof insertSupplyTransactionSchema>;

export type SupplyWithLocation = Supply & {
  location: Location | null;
};

// Purchase order types
export type Vendor = {
  id: number;
  name: string; 
  company: string;
  contactInfo: string | null;
  createdAt: Date;
};
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

export type PurchaseOrderWithItems = PurchaseOrder & {
  items: (PurchaseOrderItem & {
    supply: Supply;
    vendor: Vendor;
  })[];
  createdByUser: User;
};
