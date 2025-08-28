import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import type {
  CutlistWithMaterials,
  JobTimeLogType,
  GcodeFileType,
  JobSheetType,
  SupplyType,
  JobRodType,
} from "./types" // Assuming these types are declared in a separate file

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: text("role").notNull().default("user"), // user, admin, super_admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  data: text("data").notNull(), // JSON string containing session data
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const locationCategories = pgTable("location_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  categoryId: integer("category_id").references(() => locationCategories.id),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

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
})

export const supplyVendors = pgTable("supply_vendors", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  vendorId: integer("vendor_id")
    .references(() => vendors.id)
    .notNull(),
  vendorPartNumber: text("vendor_part_number"), // Vendor's specific part number
  price: integer("price").notNull().default(0), // Price from this vendor in cents
  isPreferred: boolean("is_preferred").default(false), // Preferred vendor selection
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const supplyLocations = pgTable("supply_locations", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => locations.id)
    .notNull(),
  onHandQuantity: integer("on_hand_quantity").notNull().default(0), // Current stock at location
  allocatedQuantity: integer("allocated_quantity").notNull().default(0), // Reserved for jobs
  availableQuantity: integer("available_quantity").notNull().default(0), // Available for use
  minimumQuantity: integer("minimum_quantity").notNull().default(0), // Reorder threshold
  reorderPoint: integer("reorder_point").notNull().default(0), // When to reorder
  orderGroupSize: integer("order_group_size").notNull().default(1), // Order in groups of
  suggestedOrderQty: integer("suggested_order_qty").default(0), // Calculated order quantity
  lastReorderDate: timestamp("last_reorder_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  fromLocationId: integer("from_location_id").references(() => locations.id),
  toLocationId: integer("to_location_id").references(() => locations.id),
  quantity: integer("quantity").notNull(),
  movementType: text("movement_type").notNull(), // 'check_in', 'check_out', 'transfer', 'adjust'
  referenceType: text("reference_type"), // 'purchase_order', 'job', 'manual', 'adjustment'
  referenceId: integer("reference_id"), // ID of the reference (PO, job, etc.)
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const supplyTransactions = pgTable("supply_transactions", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  type: text("type").notNull(), // 'allocate', 'use', 'receive', 'adjust'
  quantity: integer("quantity").notNull(),
  description: text("description"),
  jobId: integer("job_id").references(() => jobs.id), // if related to a job
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  contactInfo: text("contact_info"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  paymentTerms: text("payment_terms"), // Net 30, etc.
  creditLimit: integer("credit_limit"), // in cents
  rating: integer("rating"), // 1-5 stars
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const vendorContacts = pgTable("vendor_contacts", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id")
    .references(() => vendors.id)
    .notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"), // 'purchasing', 'sales', 'technical'
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const inventoryAlerts = pgTable("inventory_alerts", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => locations.id)
    .notNull(),
  alertType: text("alert_type").notNull(), // 'low_stock', 'reorder_point', 'overstock'
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  isResolved: boolean("is_resolved").default(false),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(), // PO-YYYYMMDD-XXX
  dateOrdered: timestamp("date_ordered").defaultNow().notNull(),
  dateReceived: timestamp("date_received"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  totalAmount: integer("total_amount").notNull().default(0), // in cents
  status: text("status").notNull().default("draft"), // draft, pending, ordered, partially_received, received, cancelled
  vendorEmail: text("vendor_email"),
  emailSubject: text("email_subject"),
  additionalComments: text("additional_comments"),
  sendEmail: boolean("send_email").default(false),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .references(() => purchaseOrders.id)
    .notNull(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  vendorId: integer("vendor_id")
    .references(() => vendors.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => locations.id)
    .notNull(),
  neededQuantity: integer("needed_quantity").notNull().default(0), // What's required
  orderQuantity: integer("order_quantity").notNull(), // What's being ordered
  receivedQuantity: integer("received_quantity").notNull().default(0), // What's been received
  pricePerUnit: integer("price_per_unit").notNull(), // in cents
  totalPrice: integer("total_price").notNull(), // in cents
  orderInGroups: integer("order_in_groups").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  folder: text("folder").notNull().default("sent"),
  from: text("from").notNull(),
  to: text("to").notNull(), // comma-separated list
  cc: text("cc"),
  bcc: text("bcc"),
  subject: text("subject"),
  body: text("body"),
  status: text("status").default("sent"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const colorGroups = pgTable("color_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hexColor: text("hex_color").notNull(),
  groupId: integer("group_id").references(() => colorGroups.id),
  texture: text("texture"), // URL or path to texture image
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

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
})

export const cutlists = pgTable("cutlists", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  name: text("name").notNull(), // e.g., "Cutlist 1", "Cutlist 2"
  orderIndex: integer("order_index").notNull().default(0), // For ordering cutlists
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const jobMaterials = pgTable("job_materials", {
  id: serial("id").primaryKey(),
  cutlistId: integer("cutlist_id").references(() => cutlists.id),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  totalSheets: integer("total_sheets").notNull(),
  completedSheets: integer("completed_sheets").notNull().default(0),
  sheetStatuses: text("sheet_statuses").array().default([]), // Array of 'cut', 'skip', 'pending'
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const jobTimeLogs = pgTable("job_time_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const recutEntries = pgTable("recut_entries", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id")
    .references(() => jobMaterials.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"), // Optional reason for the recut
  sheetStatuses: text("sheet_statuses").array().default([]), // Array of 'cut', 'skip', 'pending' for each recut sheet
  completedSheets: integer("completed_sheets").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").references(() => users.id),
})

export const sheetCutLogs = pgTable("sheet_cut_logs", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id")
    .references(() => jobMaterials.id)
    .notNull(),
  sheetIndex: integer("sheet_index").notNull(), // Which sheet (0-based)
  status: text("status").notNull(), // 'cut', 'skip', 'pending'
  isRecut: boolean("is_recut").notNull().default(false), // Whether this is a recut sheet
  recutId: integer("recut_id").references(() => recutEntries.id), // Reference to recut entry if applicable
  cutAt: timestamp("cut_at").defaultNow().notNull(), // When the sheet was cut/skipped
  userId: integer("user_id").references(() => users.id), // Who performed the action
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const partChecklists = pgTable("part_checklists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isTemplate: boolean("is_template").default(true), // Template vs job-specific
  jobId: integer("job_id").references(() => jobs.id), // null for templates
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const partChecklistItems = pgTable("part_checklist_items", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id")
    .references(() => partChecklists.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("general"), // sheets, hardware, rods, general
  sortOrder: integer("sort_order").default(0),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const gcodeFiles = pgTable("gcode_files", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum"), // For file integrity
  isValidated: boolean("is_validated").default(false),
  validationResults: jsonb("validation_results"), // Store validation details
  uploadedBy: integer("uploaded_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const jobRods = pgTable("job_rods", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  supplyId: integer("supply_id").references(() => supplies.id),
  rodName: text("rod_name").notNull(),
  lengthInches: text("length_inches").notNull(), // Format like "5 5/16"
  allocated: integer("allocated").default(0),
  used: integer("used").default(0),
  stillRequired: integer("still_required").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const jobSheets = pgTable("job_sheets", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  materialType: text("material_type").notNull(),
  qty: integer("qty").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const jobHardware = pgTable("job_hardware", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  supplyId: integer("supply_id")
    .references(() => supplies.id)
    .notNull(),
  onHand: integer("on_hand").notNull().default(0),
  available: integer("available").notNull().default(0),
  allocated: integer("allocated").notNull().default(0), // Previously "needed"
  used: integer("used").notNull().default(0),
  stillRequired: integer("still_required").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  jobTimeLogs: many(jobTimeLogs),
  inventoryMovements: many(inventoryMovements),
  supplyTransactions: many(supplyTransactions),
  partChecklists: many(partChecklists),
  gcodeFiles: many(gcodeFiles),
  purchaseOrders: many(purchaseOrders),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const locationCategoriesRelations = relations(locationCategories, ({ many }) => ({
  locations: many(locations),
}))

export const locationsRelations = relations(locations, ({ one, many }) => ({
  category: one(locationCategories, {
    fields: [locations.categoryId],
    references: [locationCategories.id],
  }),
  supplyLocations: many(supplyLocations),
  inventoryMovements: many(inventoryMovements),
  purchaseOrderItems: many(purchaseOrderItems),
}))

export const suppliesRelations = relations(supplies, ({ many }) => ({
  supplyVendors: many(supplyVendors),
  supplyLocations: many(supplyLocations),
  inventoryMovements: many(inventoryMovements),
  supplyTransactions: many(supplyTransactions),
  jobMaterials: many(jobMaterials),
  purchaseOrderItems: many(purchaseOrderItems),
  jobHardware: many(jobHardware),
}))

export const supplyVendorsRelations = relations(supplyVendors, ({ one }) => ({
  supply: one(supplies, {
    fields: [supplyVendors.supplyId],
    references: [supplies.id],
  }),
  vendor: one(vendors, {
    fields: [supplyVendors.vendorId],
    references: [vendors.id],
  }),
}))

export const supplyLocationsRelations = relations(supplyLocations, ({ one }) => ({
  supply: one(supplies, {
    fields: [supplyLocations.supplyId],
    references: [supplies.id],
  }),
  location: one(locations, {
    fields: [supplyLocations.locationId],
    references: [locations.id],
  }),
}))

export const vendorsRelations = relations(vendors, ({ many }) => ({
  supplyVendors: many(supplyVendors),
  vendorContacts: many(vendorContacts),
  purchaseOrderItems: many(purchaseOrderItems),
}))

export const vendorContactsRelations = relations(vendorContacts, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorContacts.vendorId],
    references: [vendors.id],
  }),
}))

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  supply: one(supplies, {
    fields: [inventoryMovements.supplyId],
    references: [supplies.id],
  }),
  fromLocation: one(locations, {
    fields: [inventoryMovements.fromLocationId],
    references: [locations.id],
  }),
  toLocation: one(locations, {
    fields: [inventoryMovements.toLocationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [inventoryMovements.userId],
    references: [users.id],
  }),
}))

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
}))

export const inventoryAlertsRelations = relations(inventoryAlerts, ({ one }) => ({
  supply: one(supplies, {
    fields: [inventoryAlerts.supplyId],
    references: [supplies.id],
  }),
  location: one(locations, {
    fields: [inventoryAlerts.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [inventoryAlerts.userId],
    references: [users.id],
  }),
}))

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
}))

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
  location: one(locations, {
    fields: [purchaseOrderItems.locationId],
    references: [locations.id],
  }),
}))

export const colorGroupsRelations = relations(colorGroups, ({ many }) => ({
  colors: many(colors),
}))

export const colorsRelations = relations(colors, ({ one }) => ({
  group: one(colorGroups, {
    fields: [colors.groupId],
    references: [colorGroups.id],
  }),
}))

export const jobsRelations = relations(jobs, ({ many }) => ({
  cutlists: many(cutlists),
  timeLogs: many(jobTimeLogs),
  supplyTransactions: many(supplyTransactions),
  partChecklists: many(partChecklists),
  gcodeFiles: many(gcodeFiles),
  sheets: many(jobSheets),
  hardware: many(jobHardware),
  rods: many(jobRods),
}))

export const cutlistsRelations = relations(cutlists, ({ one, many }) => ({
  job: one(jobs, {
    fields: [cutlists.jobId],
    references: [jobs.id],
  }),
  materials: many(jobMaterials),
}))

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
  sheetCutLogs: many(sheetCutLogs),
}))

export const jobTimeLogsRelations = relations(jobTimeLogs, ({ one }) => ({
  job: one(jobs, {
    fields: [jobTimeLogs.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [jobTimeLogs.userId],
    references: [users.id],
  }),
}))

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
}))

export const sheetCutLogsRelations = relations(sheetCutLogs, ({ one }) => ({
  material: one(jobMaterials, {
    fields: [sheetCutLogs.materialId],
    references: [jobMaterials.id],
  }),
  recut: one(recutEntries, {
    fields: [sheetCutLogs.recutId],
    references: [recutEntries.id],
  }),
  user: one(users, {
    fields: [sheetCutLogs.userId],
    references: [users.id],
  }),
}))

export const partChecklistsRelations = relations(partChecklists, ({ one, many }) => ({
  job: one(jobs, {
    fields: [partChecklists.jobId],
    references: [jobs.id],
  }),
  createdBy: one(users, {
    fields: [partChecklists.createdBy],
    references: [users.id],
  }),
  items: many(partChecklistItems),
}))

export const partChecklistItemsRelations = relations(partChecklistItems, ({ one }) => ({
  checklist: one(partChecklists, {
    fields: [partChecklistItems.checklistId],
    references: [partChecklists.id],
  }),
  completedBy: one(users, {
    fields: [partChecklistItems.completedBy],
    references: [users.id],
  }),
}))

export const gcodeFilesRelations = relations(gcodeFiles, ({ one }) => ({
  job: one(jobs, {
    fields: [gcodeFiles.jobId],
    references: [jobs.id],
  }),
  uploadedBy: one(users, {
    fields: [gcodeFiles.uploadedBy],
    references: [users.id],
  }),
}))

export const jobSheetsRelations = relations(jobSheets, ({ one }) => ({
  job: one(jobs, {
    fields: [jobSheets.jobId],
    references: [jobs.id],
  }),
}))

export const jobRodsRelations = relations(jobRods, ({ one }) => ({
  job: one(jobs, {
    fields: [jobRods.jobId],
    references: [jobs.id],
  }),
  supply: one(supplies, {
    fields: [jobRods.supplyId],
    references: [supplies.id],
  }),
}))

export const jobHardwareRelations = relations(jobHardware, ({ one }) => ({
  job: one(jobs, {
    fields: [jobHardware.jobId],
    references: [jobs.id],
  }),
  supply: one(supplies, {
    fields: [jobHardware.supplyId],
    references: [supplies.id],
  }),
}))

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
})

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertLocationCategorySchema = createInsertSchema(locationCategories).omit({
  id: true,
  createdAt: true,
})

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
})

export const insertSupplySchema = createInsertSchema(supplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertSupplyWithRelationsSchema = createInsertSchema(supplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  vendors: z
    .array(
      z.object({
        id: z.number().optional(),
        vendorId: z.number().optional(),
        vendorPartNumber: z.string().optional(),
        price: z.number().optional(),
        isPreferred: z.boolean().optional(),
      }),
    )
    .optional(),
  locations: z
    .array(
      z.object({
        id: z.number().optional(),
        locationId: z.number().optional(),
        onHandQuantity: z.number().optional(),
        minimumQuantity: z.number().optional(),
        orderGroupSize: z.number().optional(),
      }),
    )
    .optional(),
})

export const insertSupplyVendorSchema = createInsertSchema(supplyVendors).omit({
  id: true,
  createdAt: true,
})

export const insertSupplyLocationSchema = createInsertSchema(supplyLocations).omit({
  id: true,
  createdAt: true,
})

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true,
  createdAt: true,
})

export const insertSupplyTransactionSchema = createInsertSchema(supplyTransactions).omit({
  id: true,
  createdAt: true,
})

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertVendorContactSchema = createInsertSchema(vendorContacts).omit({
  id: true,
  createdAt: true,
})

export const insertInventoryAlertSchema = createInsertSchema(inventoryAlerts).omit({
  id: true,
  createdAt: true,
})

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  poNumber: true,
  dateOrdered: true,
  totalAmount: true,
  createdAt: true,
  updatedAt: true,
})

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  totalPrice: true,
  createdAt: true,
})

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertColorGroupSchema = createInsertSchema(colorGroups).omit({
  id: true,
  createdAt: true,
})

export const insertColorSchema = createInsertSchema(colors).omit({
  id: true,
  createdAt: true,
})

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  jobNumber: true,
  createdAt: true,
  updatedAt: true,
  totalDuration: true,
})

export const insertCutlistSchema = createInsertSchema(cutlists).omit({
  id: true,
  createdAt: true,
})

export const insertJobMaterialSchema = createInsertSchema(jobMaterials).omit({
  id: true,
  createdAt: true,
  completedSheets: true,
  sheetStatuses: true,
})

export const insertJobTimeLogSchema = createInsertSchema(jobTimeLogs).omit({
  id: true,
  createdAt: true,
})

export const insertRecutEntrySchema = createInsertSchema(recutEntries).omit({
  id: true,
  createdAt: true,
})

export const insertSheetCutLogSchema = createInsertSchema(sheetCutLogs).omit({
  id: true,
  createdAt: true,
})

export const insertPartChecklistSchema = createInsertSchema(partChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertPartChecklistItemSchema = createInsertSchema(partChecklistItems).omit({
  id: true,
  createdAt: true,
})

export const insertGcodeFileSchema = createInsertSchema(gcodeFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertJobSheetSchema = createInsertSchema(jobSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertJobRodSchema = createInsertSchema(jobRods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertJobHardwareSchema = createInsertSchema(jobHardware).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const createJobSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  jobName: z.string().min(1, "Job name is required"),
  materials: z
    .array(
      z.object({
        supplyId: z.number().min(1, "Supply is required"),
        totalSheets: z.number().min(1, "Must have at least 1 sheet"),
      }),
    )
    .min(1, "At least one material is required"),
})

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

// Type exports
export type User = typeof users.$inferSelect
export type InsertUser = z.infer<typeof insertUserSchema>

export type Session = typeof sessions.$inferSelect
export type InsertSession = z.infer<typeof insertSessionSchema>

export type LocationCategory = typeof locationCategories.$inferSelect
export type InsertLocationCategory = z.infer<typeof insertLocationCategorySchema>

export type Location = typeof locations.$inferSelect
export type InsertLocation = z.infer<typeof insertLocationSchema>

export type Supply = typeof supplies.$inferSelect
export type InsertSupply = z.infer<typeof insertSupplySchema>

export type SupplyVendor = typeof supplyVendors.$inferSelect
export type InsertSupplyVendor = z.infer<typeof insertSupplyVendorSchema>

export type SupplyLocation = typeof supplyLocations.$inferSelect
export type InsertSupplyLocation = z.infer<typeof insertSupplyLocationSchema>

export type InventoryMovement = typeof inventoryMovements.$inferSelect
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>

export type SupplyTransaction = typeof supplyTransactions.$inferSelect
export type InsertSupplyTransaction = z.infer<typeof insertSupplyTransactionSchema>

export type Vendor = typeof vendors.$inferSelect
export type InsertVendor = z.infer<typeof insertVendorSchema>

export type VendorContact = typeof vendorContacts.$inferSelect
export type InsertVendorContact = z.infer<typeof insertVendorContactSchema>

export type InventoryAlert = typeof inventoryAlerts.$inferSelect
export type InsertInventoryAlert = z.infer<typeof insertInventoryAlertSchema>

export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>

export type Email = typeof emails.$inferSelect
export type InsertEmail = z.infer<typeof insertEmailSchema>

export type ColorGroup = typeof colorGroups.$inferSelect
export type InsertColorGroup = z.infer<typeof insertColorGroupSchema>

export type Color = typeof colors.$inferSelect
export type InsertColor = z.infer<typeof insertColorSchema>

export type Job = typeof jobs.$inferSelect
export type InsertJob = z.infer<typeof insertJobSchema>

export type Cutlist = typeof cutlists.$inferSelect
export type InsertCutlist = z.infer<typeof insertCutlistSchema>

export type JobMaterial = typeof jobMaterials.$inferSelect
export type InsertJobMaterial = z.infer<typeof insertJobMaterialSchema>

export type JobTimeLog = typeof jobTimeLogs.$inferSelect
export type InsertJobTimeLog = z.infer<typeof insertJobTimeLogSchema>

export type RecutEntry = typeof recutEntries.$inferSelect
export type InsertRecutEntry = z.infer<typeof insertRecutEntrySchema>

export type SheetCutLog = typeof sheetCutLogs.$inferSelect
export type InsertSheetCutLog = z.infer<typeof insertSheetCutLogSchema>

export type PartChecklist = typeof partChecklists.$inferSelect
export type InsertPartChecklist = z.infer<typeof insertPartChecklistSchema>

export type PartChecklistItem = typeof partChecklistItems.$inferSelect
export type InsertPartChecklistItem = z.infer<typeof insertPartChecklistItemSchema>

export type PartChecklistType = PartChecklist & {
  items: PartChecklistItem[]
  createdBy: User
}

export type PartChecklistItemType = PartChecklistItem

export type GcodeFile = typeof gcodeFiles.$inferSelect
export type InsertGcodeFile = z.infer<typeof insertGcodeFileSchema>

export type JobSheet = typeof jobSheets.$inferSelect
export type InsertJobSheet = z.infer<typeof insertJobSheetSchema>

export type JobRod = typeof jobRods.$inferSelect
export type InsertJobRod = z.infer<typeof insertJobRodSchema>

export type JobHardware = typeof jobHardware.$inferSelect
export type InsertJobHardware = z.infer<typeof insertJobHardwareSchema>

export type JobWithCutlists = Job & {
  cutlists: CutlistWithMaterials[]
  timeLogs: JobTimeLogType[]
  partChecklists: PartChecklistType[]
  gcodeFiles: GcodeFileType[]
  sheets: JobSheetType[]
  hardware: (JobHardware & { supply: SupplyType })[]
  rods: JobRodType[]
}

export type JobWithChecklists = Job & {
  checklists: PartChecklistType[]
  jobTimeLogs: JobTimeLog[]
}

export type ColorWithGroup = Color & {
  group: ColorGroup | null
}

export type LocationWithCategory = Location & {
  category: LocationCategory | null
}

export type SupplyWithLocation = Supply & {
  location: Location | null
}

export type SupplyWithLocationEnhanced = Supply & {
  locations: (SupplyLocation & {
    location: LocationWithCategory
  })[]
}

export type VendorWithContacts = Vendor & {
  contacts: VendorContact[]
}

export type PurchaseOrderWithItems = PurchaseOrder & {
  items: (PurchaseOrderItem & {
    supply: Supply
    vendor: Vendor
    location: Location
  })[]
  createdBy: User
}

export type PartChecklistWithItems = PartChecklist & {
  items: PartChecklistItem[]
  createdBy: User
}
