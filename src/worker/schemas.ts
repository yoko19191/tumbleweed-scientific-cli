import { z } from "zod";

// ---------------------------------------------------------------------------
// Worker job status enum
// ---------------------------------------------------------------------------
export const JobStatus = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);
export type JobStatus = z.infer<typeof JobStatus>;

// ---------------------------------------------------------------------------
// Job schemas
// ---------------------------------------------------------------------------
export const JobOutSchema = z.object({
  id: z.string(),
  job_alias: z.string().nullable(),
  job_owner: z.string(),
  submitter: z.string().nullable(),
  model_id: z.string(),
  idempotency_key: z.string().nullable(),
  params: z.record(z.unknown()),
  status: JobStatus,
  gpu_count: z.number(),
  input_keys: z.record(z.string()),
  output_uri: z.string().nullable(),
  logs_uri: z.string().nullable(),
  error: z.string().nullable(),
  ray_job_id: z.string().nullable(),
  ray_task_ref: z.string().nullable(),
  runtime_metadata: z.record(z.unknown()),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type JobOut = z.infer<typeof JobOutSchema>;

export const JobListOutSchema = z.object({
  items: z.array(JobOutSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export type JobListOut = z.infer<typeof JobListOutSchema>;

// ---------------------------------------------------------------------------
// Create job request
// ---------------------------------------------------------------------------
export const CreateJobRequestSchema = z.object({
  job_id: z.string().optional(),
  job_alias: z.string().optional(),
  job_owner: z.string().optional(),
  model_id: z.string(),
  params: z.record(z.unknown()).default({}),
  input_keys: z.record(z.string()).default({}),
  gpu_count: z.number().optional(),
  submitter: z.string().optional(),
  idempotency_key: z.string().optional(),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

// ---------------------------------------------------------------------------
// Upload schemas
// ---------------------------------------------------------------------------
export const PresignUploadRequestSchema = z.object({
  model_id: z.string(),
  input_name: z.string(),
  filename: z.string(),
  content_type: z.string().optional(),
  job_id: z.string().optional(),
  size_bytes: z.number().optional(),
});

export const PresignUploadOutSchema = z.object({
  method: z.string(),
  url: z.string(),
  object_key: z.string(),
  max_size_mb: z.number(),
  expires_seconds: z.number(),
});
export type PresignUploadOut = z.infer<typeof PresignUploadOutSchema>;

// ---------------------------------------------------------------------------
// Result / logs schemas
// ---------------------------------------------------------------------------
export const PresignedGetOutSchema = z.object({
  url: z.string(),
  object_key: z.string(),
  expires_seconds: z.number(),
});
export type PresignedGetOut = z.infer<typeof PresignedGetOutSchema>;

export const LogsOutSchema = z.object({
  content: z.string().nullable(),
  url: z.string().nullable(),
});
export type LogsOut = z.infer<typeof LogsOutSchema>;

// ---------------------------------------------------------------------------
// Model schemas (dynamic — never hardcode model IDs)
// ---------------------------------------------------------------------------
export const InputFileSpecSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  help_zh: z.string().default(""),
  required: z.boolean().default(true),
  max_size_mb: z.number(),
  example: z.string().default(""),
});

export const ParamSpecSchema = z.object({
  name: z.string(),
  type: z.enum(["str", "int", "float", "bool", "enum"]),
  default: z.unknown().nullable().default(null),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  choices: z.array(z.string()).nullable().optional(),
  description: z.string().default(""),
  help_zh: z.string().default(""),
});
export type ParamSpec = z.infer<typeof ParamSpecSchema>;

export const ModelCardSchema = z.object({
  summary_zh: z.string().default(""),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
  input_modalities: z.array(z.string()).default([]),
  output_modalities: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  links: z.record(z.string()).default({}),
});

export const ModelPublicSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  help_zh: z.string().default(""),
  enabled: z.boolean(),
  card: ModelCardSchema.nullable().optional(),
  resources: z.object({
    gpus: z.number(),
    gpus_min: z.number(),
    gpus_max: z.number(),
    timeout_seconds: z.number(),
  }),
  inputs: z.object({
    files: z.array(InputFileSpecSchema).default([]),
  }),
  params: z.array(ParamSpecSchema).default([]),
  outputs: z.object({
    collect: z.array(z.string()),
    primary: z.array(z.string()).default([]),
  }),
  limits: z
    .object({
      max_total_residues: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type ModelPublic = z.infer<typeof ModelPublicSchema>;

export const ModelListOutSchema = z.object({
  items: z.array(ModelPublicSchema),
});
export type ModelListOut = z.infer<typeof ModelListOutSchema>;

// ---------------------------------------------------------------------------
// Health / readyz
// ---------------------------------------------------------------------------
export const HealthOutSchema = z.object({
  status: z.string(),
});

export const ReadyOutSchema = z.object({
  status: z.string(),
  checks: z.record(z.string()),
  resources: z
    .object({
      gpus_total: z.number(),
      gpus_available: z.number(),
    })
    .optional(),
});
export type ReadyOut = z.infer<typeof ReadyOutSchema>;

// ---------------------------------------------------------------------------
// Error envelope (worker standard format)
// ---------------------------------------------------------------------------
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    detail: z.record(z.unknown()).default({}),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
