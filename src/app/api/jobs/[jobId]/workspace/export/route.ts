import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET_NAME = "onboarding-files";

function sanitizePathPart(value: string | null | undefined, fallback: string) {
  const cleaned = (value || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

function makeUniquePath(path: string, usedPaths: Set<string>) {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const lastSlash = path.lastIndexOf("/");
  const directory = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "";
  const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";

  let counter = 2;
  let candidate = `${directory}${base} (${counter})${ext}`;
  while (usedPaths.has(candidate)) {
    counter += 1;
    candidate = `${directory}${base} (${counter})${ext}`;
  }

  usedPaths.add(candidate);
  return candidate;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDosTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { dosTime, dosDate };
}

function writeUInt16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function writeUInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function createZip(files: { path: string; data: Buffer; modifiedAt?: Date }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const fileNameBuffer = Buffer.from(file.path, "utf8");
    const checksum = crc32(file.data);
    const { dosTime, dosDate } = dateToDosTime(file.modifiedAt);

    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(file.data.length),
      writeUInt32(file.data.length),
      writeUInt16(fileNameBuffer.length),
      writeUInt16(0),
      fileNameBuffer,
    ]);

    localParts.push(localHeader, file.data);

    const centralHeader = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(file.data.length),
      writeUInt32(file.data.length),
      writeUInt16(fileNameBuffer.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      fileNameBuffer,
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(files.length),
    writeUInt16(files.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { jobId } = params;

    const { data: job, error: jobError } = await supabase
      .from("onboarding_jobs")
      .select("id, property_url, status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { data: spaces, error: spacesError } = await supabase
      .from("spaces")
      .select("id, name, description, sort_order")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true });

    if (spacesError) throw spacesError;

    const { data: documents, error: documentsError } = await supabase
      .from("space_documents")
      .select("id, space_id, name, file_name, file_type, file_size, storage_path, processing_status, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (documentsError) throw documentsError;

    const spaceById = new Map((spaces || []).map((space: any) => [space.id, space]));
    const zipFiles: { path: string; data: Buffer; modifiedAt?: Date }[] = [];
    const usedPaths = new Set<string>();
    const manifestDocuments: any[] = [];
    const skippedDocuments: any[] = [];

    for (const document of documents || []) {
      const space = spaceById.get(document.space_id) as any;
      const spaceName = sanitizePathPart(space?.name, "Uncategorized");
      const fileName = sanitizePathPart(document.file_name || document.name, `document-${document.id}`);
      const zipPath = makeUniquePath(`${spaceName}/${fileName}`, usedPaths);

      if (!document.storage_path) {
        skippedDocuments.push({ ...document, reason: "Missing storage path" });
        continue;
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(document.storage_path);

      if (downloadError || !blob) {
        skippedDocuments.push({
          id: document.id,
          name: document.name,
          file_name: document.file_name,
          storage_path: document.storage_path,
          reason: downloadError?.message || "File could not be downloaded",
        });
        continue;
      }

      const data = Buffer.from(await blob.arrayBuffer());
      zipFiles.push({
        path: zipPath,
        data,
        modifiedAt: document.created_at ? new Date(document.created_at) : undefined,
      });

      manifestDocuments.push({
        id: document.id,
        space_id: document.space_id,
        space_name: space?.name || "Uncategorized",
        name: document.name,
        file_name: document.file_name,
        file_type: document.file_type,
        file_size: document.file_size,
        processing_status: document.processing_status,
        storage_path: document.storage_path,
        zip_path: zipPath,
        created_at: document.created_at,
      });
    }

    const manifest = {
      exported_at: new Date().toISOString(),
      job_id: jobId,
      property_url: job.property_url,
      job_status: job.status,
      spaces: spaces || [],
      document_count: manifestDocuments.length,
      skipped_count: skippedDocuments.length,
      documents: manifestDocuments,
      skipped_documents: skippedDocuments,
    };

    zipFiles.push({
      path: makeUniquePath("manifest.json", usedPaths),
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      modifiedAt: new Date(),
    });

    if (manifestDocuments.length === 0) {
      zipFiles.push({
        path: makeUniquePath("README.txt", usedPaths),
        data: Buffer.from(
          "No workspace documents were available to export for this project. See manifest.json for details.\n",
          "utf8"
        ),
        modifiedAt: new Date(),
      });
    }

    const zip = createZip(zipFiles);
    const propertySlug = sanitizePathPart(
      (job.property_url || "workspace")
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9.-]+/g, "-"),
      "workspace"
    ).slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `callstream-workspace-docs-${propertySlug}-${date}.zip`;

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.length),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Workspace ZIP export failed:", err);
    return NextResponse.json(
      { error: err.message || "Workspace export failed" },
      { status: 500 }
    );
  }
}
