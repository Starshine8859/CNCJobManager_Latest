# Migration Guide: Colors Table to Supplies Table

## Overview
This document outlines all the changes needed to migrate from the old `colors` table to the new `supplies` table.

## Database Changes

### 1. Schema Updates (shared/schema.ts)

**Remove old tables:**
```typescript
// Remove these table definitions:
export const colors = pgTable("colors", { ... });
export const colorGroups = pgTable("color_groups", { ... });

// Remove these relations:
export const colorsRelations = relations(colors, ({ one, many }) => ({ ... }));
export const colorGroupsRelations = relations(colorGroups, ({ one, many }) => ({ ... }));

// Remove these schemas:
export const insertColorSchema = createInsertSchema(colors).omit({ ... });
export const insertColorGroupSchema = createInsertSchema(colorGroups).omit({ ... });

// Remove these types:
export type Color = typeof colors.$inferSelect;
export type InsertColor = z.infer<typeof insertColorSchema>;
export type ColorGroup = typeof colorGroups.$inferSelect;
export type InsertColorGroup = z.infer<typeof insertColorGroupSchema>;
```

**Update jobMaterials relation:**
```typescript
// Change from:
colorId: integer("color_id").references(() => colors.id).notNull(),

// To:
supplyId: integer("supply_id").references(() => supplies.id).notNull(),
```

**Update ColorWithGroup type:**
```typescript
// Change from:
export type ColorWithGroup = Color & {
  group: ColorGroup;
};

// To:
export type SupplyWithLocation = Supply & {
  location: Location;
};
```

## API Changes

### 2. Server Routes (server/routes.ts)

**Replace colors API with supplies API:**
```typescript
// OLD:
app.get("/api/colors", requireAuth, async (req, res) => {
  const colors = await storage.getAllColors();
  res.json(colors);
});

// NEW:
app.get("/api/colors", requireAuth, async (req, res) => {
  const supplies = await storage.getAllSupplies();
  // Transform supplies to match old colors format for backward compatibility
  const colors = supplies.map(supply => ({
    id: supply.id,
    name: supply.name,
    hexColor: supply.hexColor,
    groupId: supply.locationId,
    texture: supply.texture,
    createdAt: supply.createdAt,
    updatedAt: supply.updatedAt,
    group: supply.location ? { id: supply.location.id, name: supply.location.name } : null
  }));
  res.json(colors);
});
```

### 3. Server Storage (server/storage.ts)

**Remove old functions:**
```typescript
// Remove these function signatures:
getAllColors(): Promise<ColorWithGroup[]>;
createColor(color: InsertColor): Promise<Color>;
updateColor(id: number, color: Partial<InsertColor>): Promise<void>;
deleteColor(id: number): Promise<void>;
createColorGroup(group: InsertColorGroup): Promise<ColorGroup>;
updateColorGroup(id: number, name: string): Promise<void>;
deleteColorGroup(id: number): Promise<void>;
```

**Update dashboard stats:**
```typescript
// Change from:
materialColors: colorCountResult[0]?.count || 0,

// To:
materialColors: supplyCountResult[0]?.count || 0,
```

## Frontend Changes

### 4. Components

**job-modal.tsx:**
```typescript
// Change from:
const { data: colors = [] } = useQuery<ColorWithGroup[]>({
  queryKey: ['/api/colors'],
});

// To:
const { data: colors = [] } = useQuery<ColorWithGroup[]>({
  queryKey: ['/api/colors'], // Keep same endpoint for backward compatibility
});
```

**job-details-modal-new.tsx:**
```typescript
// Same change as job-modal.tsx
```

**admin.tsx:**
```typescript
// Change from:
const { data: colors = [] } = useQuery<ColorWithGroup[]>({
  queryKey: ['/api/colors'],
});

// To:
const { data: colors = [] } = useQuery<ColorWithGroup[]>({
  queryKey: ['/api/colors'], // Keep same endpoint for backward compatibility
});

// Update form handling to work with supplies data structure
```

### 5. Types and Interfaces

**Update all ColorWithGroup references:**
```typescript
// Change from:
ColorWithGroup

// To:
SupplyWithLocation (or keep ColorWithGroup for backward compatibility)
```

## Migration Strategy

### Option 1: Backward Compatibility (Recommended)
- Keep `/api/colors` endpoint but make it return supplies data
- Transform supplies data to match old colors format
- This allows gradual migration without breaking existing code

### Option 2: Direct Migration
- Replace all `/api/colors` calls with `/api/supplies`
- Update all frontend components to use new data structure
- More work but cleaner in the long run

## Implementation Steps

1. **Run the database migration** (already done)
2. **Update server routes** to redirect colors API to supplies
3. **Update server storage** to remove old color functions
4. **Update dashboard stats** to count supplies instead of colors
5. **Test the application** to ensure everything works
6. **Optionally update frontend** to use new data structure directly

## Benefits of Migration

- **Better inventory management** with quantity tracking
- **Location-based organization** instead of simple groups
- **Vendor management** for purchasing
- **Transaction history** for audit trails
- **More scalable** for future features 