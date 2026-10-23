import { NextRequest, NextResponse } from "next/server";
import { requireProject, accessResponse, AccessError } from "@/lib/access";
import { claim, finish } from "@/lib/property-operations";
import { sourceInventory, readKnowledgeSources } from "@/lib/knowledge/sources";
import {
  splitSources,
  extractKnowledgeChunk,
  consolidateKnowledge,
} from "@/lib/knowledge/generate";
import { validateQA, toCSV, type QA } from "@/lib/knowledge/format";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    const { db } = await requireProject(params.jobId);
    const { data, error } = await db
      .from("knowledge_versions")
      .select("*")
      .eq("job_id", params.jobId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (req.nextUrl.searchParams.get("format") === "csv") {
      const version = data?.find(
        (v) => v.id === req.nextUrl.searchParams.get("version"),
      );
      if (!version) throw new AccessError("Version not found.", 404);
      return new Response(toCSV(version.qa), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="property-knowledge.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    const inventory = await sourceInventory(db, params.jobId);
    return NextResponse.json(
      {
        versions: (data || []).map(
          ({ provider_id, provider_name, error_message, ...version }) => ({
            ...version,
            canRefresh: !!provider_id,
            error_message: error_message
              ? "This version needs attention. Check publishing status or contact your Call Stream team."
              : null,
          }),
        ),
        sourceHash: inventory.hash,
        sourceCount: inventory.manifest.length,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return accessResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { db, user, job } = await requireProject(params.jobId);
    const {
      action,
      versionId,
      acknowledgeWarnings,
      qa: editedQA,
      baseQA,
    } = await req.json();
    if (action === "generate") {
      const inventory = await sourceInventory(db, params.jobId);
      const op = await claim(
        db,
        params.jobId,
        "knowledge",
        inventory.hash,
        true,
      );
      if (op.cached) return NextResponse.json({ ...op.result, skipped: true });
      release = () =>
        finish(db, params.jobId, op.token, inventory.hash, {}, false);
      const { data: existing } = await db
        .from("knowledge_versions")
        .select("id")
        .eq("job_id", params.jobId)
        .eq("source_hash", inventory.hash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await finish(db, params.jobId, op.token, inventory.hash, {
          versionId: existing.id,
        });
        release = undefined;
        return NextResponse.json({ versionId: existing.id, skipped: true });
      }
      const saved = await db
        .from("knowledge_builds")
        .select("*")
        .eq("job_id", params.jobId)
        .eq("source_hash", inventory.hash)
        .maybeSingle();
      if (saved.error) throw saved.error;
      let build = saved.data;
      if (!build) {
        const { sources, warnings } = await readKnowledgeSources(
          db,
          params.jobId,
          inventory,
        );
        if (!sources.length)
          throw new AccessError(
            "No readable property sources are available. The website may be blocking access. Upload searchable property documents or retry the scrape.",
            422,
          );
        const chunks = splitSources(sources);
        const created = await db
          .from("knowledge_builds")
          .insert({
            job_id: params.jobId,
            source_hash: inventory.hash,
            chunks,
            warnings,
          })
          .select()
          .single();
        if (created.error) throw created.error;
        build = created.data;
      }
      if (build.cursor < build.chunks.length) {
        const section = await extractKnowledgeChunk(build.chunks[build.cursor]);
        const updated = await db
          .from("knowledge_builds")
          .update({
            cursor: build.cursor + 1,
            qa: [...build.qa, ...section.qa],
            warnings: [...build.warnings, ...section.warnings],
          })
          .eq("job_id", params.jobId)
          .eq("source_hash", inventory.hash);
        if (updated.error) throw updated.error;
        await finish(db, params.jobId, op.token, inventory.hash, {}, false);
        release = undefined;
        return NextResponse.json({
          pending: true,
          completed: build.cursor + 1,
          total: build.chunks.length,
        });
      }
      const result = await consolidateKnowledge(
        build.qa,
        new Set(build.chunks.map((s: { id: string }) => s.id)),
      );
      const warnings = build.warnings;
      const current = await sourceInventory(db, params.jobId);
      if (current.hash !== inventory.hash)
        throw new AccessError(
          "Files changed during processing. Please process the updated source set again.",
          409,
        );
      const { data: version, error } = await db
        .from("knowledge_versions")
        .insert({
          job_id: params.jobId,
          source_hash: inventory.hash,
          source_manifest: inventory.manifest,
          qa: result.qa,
          warnings: [...warnings, ...result.warnings],
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const jobUpdate = await db
        .from("onboarding_jobs")
        .update({ status: "review_pending" })
        .eq("id", params.jobId);
      if (jobUpdate.error) throw jobUpdate.error;
      await db
        .from("project_milestones")
        .update({ status: "in_progress" })
        .eq("job_id", params.jobId)
        .eq("name", "Knowledge review");
      await finish(db, params.jobId, op.token, inventory.hash, {
        versionId: version.id,
      });
      release = undefined;
      return NextResponse.json({ versionId: version.id });
    }
    if (!["publish", "refresh", "reconcile", "save", "revise"].includes(action))
      throw new AccessError("Choose a valid knowledge action.", 400);
    const { data: version, error } = await db
      .from("knowledge_versions")
      .select("*")
      .eq("job_id", params.jobId)
      .eq("id", versionId)
      .single();
    if (error || !version) throw new AccessError("Version not found.", 404);
    if (action === "revise") {
      if (!["published", "failed"].includes(version.status))
        throw new AccessError(
          "Wait for publishing to finish before creating a revision.",
          409,
        );
      const inventory = await sourceInventory(db, params.jobId);
      if (inventory.hash !== version.source_hash)
        throw new AccessError(
          "Sources have changed. Prepare a new draft first.",
          409,
        );
      const existing = await db
        .from("knowledge_versions")
        .select("id")
        .eq("job_id", params.jobId)
        .eq("source_hash", version.source_hash)
        .eq("status", "draft")
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data)
        return NextResponse.json({ versionId: existing.data.id });
      const revision = await db
        .from("knowledge_versions")
        .insert({
          job_id: params.jobId,
          source_hash: version.source_hash,
          source_manifest: version.source_manifest,
          qa: version.qa,
          warnings: version.warnings,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (revision.error?.code === "23505")
        throw new AccessError(
          "Another draft was just created. Reload to edit it.",
          409,
        );
      if (revision.error) throw revision.error;
      return NextResponse.json({ versionId: revision.data.id });
    }
    if (action === "save") {
      if (version.status !== "draft")
        throw new AccessError("Only unpublished drafts can be edited.", 409);
      if (JSON.stringify(baseQA) !== JSON.stringify(version.qa))
        throw new AccessError(
          "This draft changed while you were editing. Reload before saving.",
          409,
        );
      let qa: QA[];
      try {
        qa = validateQA(
          editedQA,
          new Set(version.source_manifest.map((s: { id: string }) => s.id)),
        );
      } catch {
        throw new AccessError(
          "Every answer needs a question, an answer, and a supporting source.",
          422,
        );
      }
      if (JSON.stringify(qa).length > 1000000)
        throw new AccessError("This draft is too large.", 422);
      const saved = await db
        .from("knowledge_versions")
        .update({ qa })
        .eq("id", version.id)
        .eq("status", "draft")
        .eq("qa", JSON.stringify(version.qa))
        .select("id")
        .maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data)
        throw new AccessError(
          "This version changed while you were editing. Reload it before continuing.",
          409,
        );
      return NextResponse.json({ saved: true });
    }
    const apiKey = process.env.BLAND_API_KEY;
    if (!apiKey)
      throw new AccessError(
        "Knowledge publishing is not configured. Contact your administrator.",
        503,
      );
    if (action === "reconcile") {
      if (version.provider_id)
        return NextResponse.json({ status: version.status });
      if (!version.provider_name)
        throw new AccessError(
          "No delivery has been attempted for this version.",
          400,
        );
      let found: any = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const response = await fetch(
          `https://api.bland.ai/v1/knowledge?page=${page}&limit=100`,
          {
            headers: { Authorization: apiKey },
            signal: AbortSignal.timeout(15000),
            cache: "no-store",
          },
        );
        if (!response.ok)
          throw new AccessError(
            "Could not reconcile delivery. Please try again later.",
            502,
          );
        const data = (await response.json()).data;
        const matches = (data?.kbs || []).filter(
          (item: any) => item.name === version.provider_name,
        );
        if (matches.length > 1)
          throw new AccessError(
            "Multiple matching versions were found. Your administrator must review them before continuing.",
            409,
          );
        found = matches[0];
        if ((data?.kbs || []).length < 100) break;
      }
      if (!found)
        throw new AccessError(
          "Delivery is still unconfirmed. Contact your Call Stream team before attempting another publish.",
          409,
        );
      const status =
        found.status === "COMPLETED"
          ? "published"
          : found.status === "FAILED"
            ? "failed"
            : "processing";
      const save = await db
        .from("knowledge_versions")
        .update({ provider_id: found.id, status, error_message: null })
        .eq("id", version.id);
      if (save.error) throw save.error;
      return NextResponse.json({ status });
    }
    if (action === "refresh") {
      if (!version.provider_id)
        throw new AccessError("This version has not been sent yet.", 400);
      const response = await fetch(
        `https://api.bland.ai/v1/knowledge/${encodeURIComponent(version.provider_id)}`,
        {
          headers: { Authorization: apiKey },
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new AccessError(
          "Could not check processing status. Please try again.",
          502,
        );
      const result = await response.json();
      const state = result.data?.status;
      const status =
        state === "COMPLETED"
          ? "published"
          : state === "FAILED" || state === "DELETED"
            ? "failed"
            : "processing";
      const { error: saveError } = await db
        .from("knowledge_versions")
        .update({
          status,
          published_at:
            status === "published" ? new Date().toISOString() : null,
          error_message:
            status === "failed"
              ? "The knowledge service could not process this version."
              : null,
        })
        .eq("id", version.id);
      if (saveError) throw saveError;
      return NextResponse.json({ status });
    }
    if (version.provider_id)
      return NextResponse.json({ status: version.status, skipped: true });
    if (version.warnings?.length && !acknowledgeWarnings)
      throw new AccessError(
        "Review and acknowledge the draft warnings before publishing.",
        422,
      );
    const inventory = await sourceInventory(db, params.jobId);
    if (inventory.hash !== version.source_hash)
      throw new AccessError(
        "Sources have changed. Generate a new draft before publishing.",
        409,
      );
    const csv = toCSV(version.qa as QA[]);
    if (Buffer.byteLength(csv, "utf8") > 1000000)
      throw new AccessError(
        "This knowledge version exceeds the publishing size limit.",
        422,
      );
    // Compare-and-set prevents duplicate publishes. Unknown network outcomes cannot be blindly retried.
    const { data: claimed, error: claimError } = await db
      .from("knowledge_versions")
      .update({ status: "publishing", error_message: null })
      .eq("id", version.id)
      .eq("status", "draft")
      .eq("qa", JSON.stringify(version.qa))
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed)
      throw new AccessError(
        "This version has already been submitted. Check its status before publishing again.",
        409,
      );
    const name = `${job.property_name || "Property"} — ${new Date(version.created_at).toISOString().slice(0, 16)} — ${version.id.slice(0, 8)}`;
    await db
      .from("knowledge_versions")
      .update({ provider_name: name })
      .eq("id", version.id);
    try {
      const form = new FormData();
      form.set("type", "file");
      form.set("name", name);
      form.set(
        "description",
        "Property questions and answers prepared by Call Stream AI.",
      );
      form.set(
        "file",
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `property-knowledge-${version.id}.csv`,
      );
      const response = await fetch("https://api.bland.ai/v1/knowledge/learn", {
        method: "POST",
        headers: { Authorization: apiKey },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const definite = response.status >= 400 && response.status < 500;
        await db
          .from("knowledge_versions")
          .update({
            status: definite ? "draft" : "uncertain",
            error_message: definite
              ? "Publishing was rejected. Check account configuration before retrying."
              : "Delivery could not be confirmed. Reconcile the version before retrying.",
          })
          .eq("id", version.id);
        throw new AccessError(
          "The knowledge service could not accept this version. Check its status before trying again.",
          502,
        );
      }
      const result = await response.json();
      if (!result.data?.id) throw new Error("Missing item identifier");
      const status =
        result.data.status === "COMPLETED"
          ? "published"
          : result.data.status === "FAILED"
            ? "failed"
            : "processing";
      const { error: saveError } = await db
        .from("knowledge_versions")
        .update({
          provider_id: result.data.id,
          status,
          published_at:
            status === "published" ? new Date().toISOString() : null,
        })
        .eq("id", version.id);
      if (saveError) throw saveError;
      return NextResponse.json({ status });
    } catch (error) {
      if (!(error instanceof AccessError))
        await db
          .from("knowledge_versions")
          .update({
            status: "uncertain",
            error_message:
              "Delivery could not be confirmed. Contact your Call Stream team before retrying.",
          })
          .eq("id", version.id);
      throw error;
    }
  } catch (error) {
    if (release) await release().catch(() => {});
    return accessResponse(error);
  }
}
