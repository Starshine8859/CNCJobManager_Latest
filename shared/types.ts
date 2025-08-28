import type {
  Cutlist,
  JobMaterial,
  Supply,
  JobTimeLog,
  User,
  PartChecklist,
  PartChecklistItem,
  GcodeFile,
  JobSheet,
  JobRod,
} from "./schema"

export type CutlistWithMaterials = Cutlist & {
  materials: (JobMaterial & {
    supply: Supply
  })[]
}

export type JobTimeLogType = JobTimeLog & {
  user?: User
}

export type PartChecklistType = PartChecklist & {
  items: PartChecklistItem[]
  createdBy: User
}

export type GcodeFileType = GcodeFile & {
  uploadedBy: User
}

export type JobSheetType = JobSheet

export type JobRodType = JobRod

export type SupplyType = Supply
