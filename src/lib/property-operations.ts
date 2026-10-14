import { createHash } from "node:crypto";
import { AccessError } from "@/lib/access";
import type { createServiceClient } from "@/lib/supabase/server";
type DB = ReturnType<typeof createServiceClient>;
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function claim(
  db: DB,
  jobId: string,
  kind: string,
  key: string,
  force = false,
) {
  const { data, error } = await db.rpc("claim_property_operation", {
    p_job: jobId,
    p_kind: kind,
    p_key: key,
    p_force: force,
  });
  if (error)
    throw new AccessError(
      error.code === "55P03"
        ? "This property is already being processed. Wait for it to finish before trying again."
        : "Could not start processing.",
      error.code === "55P03" ? 409 : 500,
    );
  return data as { token: string; cached: boolean; result?: any };
}
export async function finish(
  db: DB,
  jobId: string,
  token: string,
  key: string,
  result: unknown,
  success = true,
) {
  const { error } = await db.rpc("finish_property_operation", {
    p_job: jobId,
    p_token: token,
    p_key: key,
    p_result: result,
    p_success: success,
  });
  if (error) throw error;
}
