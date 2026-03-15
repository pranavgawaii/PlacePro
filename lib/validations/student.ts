import { z } from "zod";

export const STUDENT_BRANCHES = ["CSE", "ECE", "ENTC", "CIVIL", "MECH", "AERO"] as const;
export const PASSWORD_STRATEGIES = ["random", "pattern"] as const;

const enrollmentSchema = z
  .string({ required_error: "Enrollment number is required" })
  .trim()
  .toUpperCase()
  .min(8, "Enrollment number must be at least 8 characters")
  .max(20, "Enrollment number must be 20 characters or fewer")
  .regex(/^[A-Z0-9]+$/, "Enrollment number can contain only letters and numbers");

const mobileSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z
    .string()
    .refine((value) => value === "" || /^\d{10}$/.test(value), "Must be exactly 10 digits")
    .refine((value) => value === "" || /^[6-9]\d{9}$/.test(value), "Must start with 6, 7, 8, or 9")
);

export const studentSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or fewer"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email format"),
  enrollment_no: enrollmentSchema,
  mobile: mobileSchema,
  branch: z
    .string({ required_error: "Branch is required" })
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(STUDENT_BRANCHES)),
  batch_year: z.coerce
    .number({ required_error: "Batch year is required", invalid_type_error: "Batch year is required" })
    .int("Batch year must be an integer")
    .min(2024, "Batch year must be between 2024 and 2030")
    .max(2030, "Batch year must be between 2024 and 2030")
});

const passwordStrategySchema = z.enum(PASSWORD_STRATEGIES);

export const manualAddSchema = studentSchema.extend({
  passwordStrategy: passwordStrategySchema.default("pattern"),
  forcePasswordChange: z.boolean().default(true)
});

export const bulkUploadSchema = z.object({
  students: z.array(studentSchema).min(1, "At least one student is required").max(2000, "Maximum 2000 students per upload"),
  rowNumbers: z.array(z.number().int().min(2)).optional(),
  passwordStrategy: passwordStrategySchema.default("pattern"),
  forcePasswordChange: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.rowNumbers && value.rowNumbers.length !== value.students.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rowNumbers must match students length"
    });
  }
});

export const multiAddSchema = z.object({
  students: z.array(studentSchema).min(1, "Add at least one student").max(5, "You can add up to 5 students at once"),
  passwordStrategy: passwordStrategySchema.default("pattern"),
  forcePasswordChange: z.boolean().default(true)
});

export type StudentInput = z.infer<typeof studentSchema>;
export type ManualAddInput = z.infer<typeof manualAddSchema>;
export type BulkUploadInput = z.infer<typeof bulkUploadSchema>;
export type MultiAddInput = z.infer<typeof multiAddSchema>;
export type PasswordStrategy = z.infer<typeof passwordStrategySchema>;
