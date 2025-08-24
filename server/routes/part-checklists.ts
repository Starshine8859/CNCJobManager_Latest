import { Router } from "express"
import { db } from "../db"
import {
  partChecklists,
  partChecklistItems,
  insertPartChecklistSchema,
  insertPartChecklistItemSchema,
} from "../../shared/schema"
import { eq, desc } from "drizzle-orm"

const router = Router()

// Get all checklists (templates and job-specific)
router.get("/", async (req, res) => {
  try {
    const { jobId, isTemplate } = req.query

    let checklists

    if (jobId) {
      checklists = await db
        .select()
        .from(partChecklists)
        .where(eq(partChecklists.jobId, Number.parseInt(jobId as string)))
        .orderBy(desc(partChecklists.createdAt))
    } else if (isTemplate !== undefined) {
      checklists = await db
        .select()
        .from(partChecklists)
        .where(eq(partChecklists.isTemplate, isTemplate === "true"))
        .orderBy(desc(partChecklists.createdAt))
    } else {
      checklists = await db.select().from(partChecklists).orderBy(desc(partChecklists.createdAt))
    }

    res.json(checklists)
  } catch (error) {
    console.error("Error fetching checklists:", error)
    res.status(500).json({ error: "Failed to fetch checklists" })
  }
})

// Get checklist with items
router.get("/:id", async (req, res) => {
  try {
    const checklistId = Number.parseInt(req.params.id)

    const [checklist] = await db.select().from(partChecklists).where(eq(partChecklists.id, checklistId))

    if (!checklist) {
      return res.status(404).json({ error: "Checklist not found" })
    }

    const items = await db
      .select()
      .from(partChecklistItems)
      .where(eq(partChecklistItems.checklistId, checklistId))
      .orderBy(partChecklistItems.sortOrder, partChecklistItems.createdAt)

    res.json({ ...checklist, items })
  } catch (error) {
    console.error("Error fetching checklist:", error)
    res.status(500).json({ error: "Failed to fetch checklist" })
  }
})

// Create new checklist
router.post("/", async (req, res) => {
  try {
    const validatedData = insertPartChecklistSchema.parse(req.body)

    const [checklist] = await db.insert(partChecklists).values(validatedData).returning()

    res.status(201).json(checklist)
  } catch (error) {
    console.error("Error creating checklist:", error)
    res.status(500).json({ error: "Failed to create checklist" })
  }
})

// Add item to checklist
router.post("/:id/items", async (req, res) => {
  try {
    const checklistId = Number.parseInt(req.params.id)
    const validatedData = insertPartChecklistItemSchema.parse({
      ...req.body,
      checklistId,
    })

    const [item] = await db.insert(partChecklistItems).values(validatedData).returning()

    res.status(201).json(item)
  } catch (error) {
    console.error("Error adding checklist item:", error)
    res.status(500).json({ error: "Failed to add checklist item" })
  }
})

// Update checklist item (toggle completion, etc.)
router.patch("/items/:itemId", async (req, res) => {
  try {
    const itemId = Number.parseInt(req.params.itemId)
    const { isCompleted, completedBy } = req.body

    const updateData: any = {}
    if (typeof isCompleted === "boolean") {
      updateData.isCompleted = isCompleted
      updateData.completedAt = isCompleted ? new Date() : null
      if (isCompleted && completedBy) {
        updateData.completedBy = completedBy
      }
    }

    const [item] = await db
      .update(partChecklistItems)
      .set(updateData)
      .where(eq(partChecklistItems.id, itemId))
      .returning()

    if (!item) {
      return res.status(404).json({ error: "Checklist item not found" })
    }

    res.json(item)
  } catch (error) {
    console.error("Error updating checklist item:", error)
    res.status(500).json({ error: "Failed to update checklist item" })
  }
})

// Delete checklist item
router.delete("/items/:itemId", async (req, res) => {
  try {
    const itemId = Number.parseInt(req.params.itemId)

    const [deletedItem] = await db.delete(partChecklistItems).where(eq(partChecklistItems.id, itemId)).returning()

    if (!deletedItem) {
      return res.status(404).json({ error: "Checklist item not found" })
    }

    res.json({ message: "Item deleted successfully" })
  } catch (error) {
    console.error("Error deleting checklist item:", error)
    res.status(500).json({ error: "Failed to delete checklist item" })
  }
})

export default router
