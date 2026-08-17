import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET_NAME = "onboarding-files";

type ZipSource = {
  path: string;
  modifiedAt?: Date;
} & (
  | { kind: "buffer"; data: Buffer }
  | { kind: "storage"; storagePath: string }
);

type CentralDirectoryEntry = {
  path: string;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
  dosTime: number;
  dosDate: number;
};

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

function updateCrc32(crc: number, chunk: Uint8Array) {
  let next = crc;
  for (let i = 0; i < chunk.length; i += 1) {
    next ^= chunk[i];
    for (let j = 0; j < 8; j += 1) {
      next = (next >>> 1) ^ (next & 1 ? 0xedb88320 : 0);
    }
  }
  return next >>> 0;
}

function crc32(buffer: Buffer) {
  return (updateCrc32(0xffffffff, buffer) ^ 0xffffffff) >>> 0;
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

function localHeader(fileNameBuffer: Buffer, dosTime: number, dosDate: number) {
  return Buffer.concat([
    writeUInt32(0x04034b50),
    writeUInt16(20),
    writeUInt16(0x0808), // UTF-8 + data descriptor follows file bytes
    writeUInt16(0), // store, no compression
    writeUInt16(dosTime),
    writeUInt16(dosDate),
    writeUInt32(0),
    writeUInt32(0),
    writeUInt32(0),
    writeUInt16(fileNameBuffer.length),
    writeUInt16(0),
    fileNameBuffer,
  ]);
}

function dataDescriptor(crc: number, size: number) {
  return Buffer.concat([
    writeUInt32(0x08074b50),
    writeUInt32(crc),
    writeUInt32(size),
    writeUInt32(size),
  ]);
}

function centralHeader(entry: CentralDirectoryEntry) {
  const fileNameBuffer = Buffer.from(entry.path, "utf8");
  return Buffer.concat([
    writeUInt32(0x02014b50),
    writeUInt16(20),
    writeUInt16(20),
    writeUInt16(0x0808),
    writeUInt16(0),
    writeUInt16(entry.dosTime),
    writeUInt16(entry.dosDate),
    writeUInt32(entry.crc),
    writeUInt32(entry.compressedSize),
    writeUInt32(entry.uncompressedSize),
    writeUInt16(fileNameBuffer.length),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(0),
    writeUInt32(entry.offset),
    fileNameBuffer,
  ]);
}

function endOfCentralDirectory(entryCount: number, centralDirectoryLength: number, centralDirectoryOffset: number) {
  return Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entryCount),
    writeUInt16(entryCount),
    writeUInt32(centralDirectoryLength),
    writeUInt32(centralDirectoryOffset),
    writeUInt16(0),
  ]);
}

function createZipStream(sources: ZipSource[], supabase: ReturnType<typeof createServiceClient>) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const centralDirectory: CentralDirectoryEntry[] = [];
      let offset = 0;

      const enqueue = (chunk: Buffer | Uint8Array) => {
        controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
        offset += chunk.byteLength;
      };

      try {
        for (const source of sources) {
          const fileNameBuffer = Buffer.from(source.path, "utf8");
          const { dosTime, dosDate } = dateToDosTime(source.modifiedAt);
          const header = localHeader(fileNameBuffer, dosTime, dosDate);
          const entryOffset = offset;
          enqueue(header);

          let crc = 0xffffffff;
          let size = 0;

          if (source.kind === "buffer") {
            crc = updateCrc32(crc, source.data);
            size += source.data.length;
            enqueue(source.data);
          } else {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(source.storagePath, 60 * 10);

            if (signedUrlError || !signedUrlData?.signedUrl) {
              const errorText = encoder.encode(`Could not create signed URL for ${source.storagePath}: ${signedUrlError?.message || "unknown error"}\n`);
              crc = updateCrc32(crc, errorText);
              size += errorText.byteLength;
              enqueue(errorText);
            } else {
              const response = await fetch(signedUrlData.signedUrl);
              if (!response.ok || !response.body) {
                const errorText = encoder.encode(`Could not download ${source.storagePath}: HTTP ${response.status}\n`);
                crc = updateCrc32(crc, errorText);
                size += errorText.byteLength;
                enqueue(errorText);
              } else {
                const reader = response.body.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  if (!value) continue;
                  crc = updateCrc32(crc, value);
                  size += value.byteLength;
                  enqueue(value);
                }
              }
            }
          }

          const finalizedCrc = (crc ^ 0xffffffff) >>> 0;
          const descriptor = dataDescriptor(finalizedCrc, size);
          enqueue(descriptor);

          centralDirectory.push({
            path: source.path,
            crc: finalizedCrc,
            compressedSize: size,
            uncompressedSize: size,
            offset: entryOffset,
            dosTime,
            dosDate,
          });
        }

        const centralDirectoryOffset = offset;
        const centralParts = centralDirectory.map(centralHeader);
        const centralBuffer = Buffer.concat(centralParts);
        enqueue(centralBuffer);
        enqueue(endOfCentralDirectory(centralDirectory.length, centralBuffer.length, centralDirectoryOffset));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
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

    const { data: uploadedFiles, error: uploadedFilesError } = await supabase
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size, storage_path, processing_status, source_provenance, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (uploadedFilesError) throw uploadedFilesError;

    const { data: links, error: linksError } = await supabase
      .from("space_links")
      .select("id, space_id, job_id, title, url, description, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (linksError) throw linksError;

    const spaceById = new Map((spaces || []).map((space: any) => [space.id, space]));
    const zipSources: ZipSource[] = [];
    const usedPaths = new Set<string>();
    const exportedStoragePaths = new Set<string>();
    const manifestDocuments: any[] = [];
    const skippedDocuments: any[] = [];
    const manifestLinks = (links || []).map((link: any) => {
      const space = spaceById.get(link.space_id) as any;
      return {
        id: link.id,
        space_id: link.space_id,
        space_name: space?.name || "Uncategorized",
        title: link.title,
        url: link.url,
        description: link.description,
        created_at: link.created_at,
      };
    });

    const addStoredFile = ({
      record,
      zipDirectory,
      fileName,
      source,
      spaceName,
    }: {
      record: any;
      zipDirectory: string;
      fileName: string;
      source: "space_documents" | "uploaded_files";
      spaceName?: string;
    }) => {
      if (!record.storage_path) {
        skippedDocuments.push({ ...record, source, reason: "Missing storage path" });
        return;
      }

      if (exportedStoragePaths.has(record.storage_path)) {
        return;
      }
      exportedStoragePaths.add(record.storage_path);

      const safeDirectory = sanitizePathPart(zipDirectory, "Uploaded Files");
      const safeFileName = sanitizePathPart(fileName, `document-${record.id}`);
      const zipPath = makeUniquePath(`${safeDirectory}/${safeFileName}`, usedPaths);

      zipSources.push({
        kind: "storage",
        path: zipPath,
        storagePath: record.storage_path,
        modifiedAt: record.created_at ? new Date(record.created_at) : undefined,
      });

      manifestDocuments.push({
        id: record.id,
        source,
        space_name: spaceName || null,
        name: record.name || record.file_name,
        file_name: record.file_name,
        file_type: record.file_type,
        file_size: record.file_size,
        processing_status: record.processing_status,
        source_provenance: record.source_provenance || null,
        storage_path: record.storage_path,
        zip_path: zipPath,
        created_at: record.created_at,
      });
    };

    for (const document of documents || []) {
      const space = spaceById.get(document.space_id) as any;
      const spaceName = space?.name || "Uncategorized";
      addStoredFile({
        record: document,
        zipDirectory: spaceName,
        fileName: document.file_name || document.name,
        source: "space_documents",
        spaceName,
      });
    }

    for (const uploadedFile of uploadedFiles || []) {
      addStoredFile({
        record: uploadedFile,
        zipDirectory: "Uploaded Files",
        fileName: uploadedFile.file_name,
        source: "uploaded_files",
      });
    }

    if (manifestLinks.length > 0) {
      const linksMarkdown = [
        "# Workspace Links",
        "",
        ...manifestLinks.flatMap((link: any) => [
          `## ${link.space_name}`,
          `- [${link.title || link.url}](${link.url})${link.description ? ` — ${link.description}` : ""}`,
          "",
        ]),
      ].join("\n");

      zipSources.push({
        kind: "buffer",
        path: makeUniquePath("Links/links.md", usedPaths),
        data: Buffer.from(linksMarkdown, "utf8"),
        modifiedAt: new Date(),
      });
      zipSources.push({
        kind: "buffer",
        path: makeUniquePath("Links/links.json", usedPaths),
        data: Buffer.from(JSON.stringify(manifestLinks, null, 2), "utf8"),
        modifiedAt: new Date(),
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
      link_count: manifestLinks.length,
      documents: manifestDocuments,
      skipped_documents: skippedDocuments,
      links: manifestLinks,
      note: "ZIP file contents are streamed to avoid server memory limits.",
    };

    zipSources.push({
      kind: "buffer",
      path: makeUniquePath("manifest.json", usedPaths),
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      modifiedAt: new Date(),
    });

    if (manifestDocuments.length === 0 && manifestLinks.length === 0) {
      zipSources.push({
        kind: "buffer",
        path: makeUniquePath("README.txt", usedPaths),
        data: Buffer.from(
          "No workspace documents or links were available to export for this project. See manifest.json for details.\n",
          "utf8"
        ),
        modifiedAt: new Date(),
      });
    }

    const propertySlug = sanitizePathPart(
      (job.property_url || "workspace")
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9.-]+/g, "-"),
      "workspace"
    ).slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `callstream-workspace-docs-${propertySlug}-${date}.zip`;

    return new NextResponse(createZipStream(zipSources, supabase), {
      headers: {
        "Content-Type": "application/zip",
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
