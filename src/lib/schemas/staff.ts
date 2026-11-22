import { z } from "zod";
import { StaffRoleSchema } from "@/lib/schemas/intake";

const FIRESTORE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const FacilityRecordSchema = z
  .object({
    id: z.string().min(1).max(128).regex(FIRESTORE_ID_REGEX),
    name: z.string().trim().min(1).max(120),
    publicCode: z.string().min(1).max(64).regex(FIRESTORE_ID_REGEX),
    active: z.boolean(),
    createdAt: z.unknown(),
  })
  .strict();

export type FacilityRecord = z.infer<typeof FacilityRecordSchema>;

export const StaffProfileSchema = z
  .object({
    uid: z.string().min(1).max(128).regex(FIRESTORE_ID_REGEX),
    email: z.string().trim().email().max(254),
    displayName: z.string().trim().min(1).max(120),
    role: StaffRoleSchema,
    facilityIds: z
      .array(z.string().min(1).max(128).regex(FIRESTORE_ID_REGEX))
      .min(1)
      .max(10),
    active: z.boolean(),
    createdAt: z.unknown(),
  })
  .strict();

export type StaffProfile = z.infer<typeof StaffProfileSchema>;

export const StaffSessionResponseSchema = z
  .object({
    authenticated: z.literal(true),
    verifiedByServer: z.literal(true),
    projectId: z.string().min(1),
    authorizationModel: z.literal("starter_tier_firestore_rules"),
    user: z.object({
      uid: z.string().min(1),
      email: z.string().email().nullable(),
      emailVerified: z.literal(true),
      displayName: z.string().nullable(),
    }),
  })
  .strict();

export type StaffSessionResponse = z.infer<typeof StaffSessionResponseSchema>;
