import type { RenderProject } from "@/types/render-project";

const PREVIEW_SNAPSHOT_VERSION = 1;
const PREVIEW_SNAPSHOT_STORAGE_KEY_PREFIX = "videotool.preview.snapshot.";
const PREVIEW_SNAPSHOT_LATEST_ID_KEY = "videotool.preview.latest-id";

export type PreviewSnapshot = {
  version: typeof PREVIEW_SNAPSHOT_VERSION;
  snapshotId: string;
  createdAt: string;
  renderSessionSeed: string;
  renderProject: RenderProject;
};

type ReadPreviewSnapshotResult =
  | {
      ok: true;
      snapshot: PreviewSnapshot;
    }
  | {
      ok: false;
      errorCode: "NOT_FOUND" | "INVALID_JSON" | "INVALID_SHAPE" | "UNSUPPORTED_VERSION";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createSnapshotId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRenderSessionSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPreviewSnapshot(input: {
  renderProject: RenderProject;
  renderSessionSeed: string;
}): PreviewSnapshot {
  return {
    version: PREVIEW_SNAPSHOT_VERSION,
    snapshotId: createSnapshotId(),
    createdAt: new Date().toISOString(),
    renderSessionSeed: input.renderSessionSeed,
    renderProject: input.renderProject,
  };
}

export function persistPreviewSnapshot(storage: Storage, snapshot: PreviewSnapshot) {
  const snapshotKey = `${PREVIEW_SNAPSHOT_STORAGE_KEY_PREFIX}${snapshot.snapshotId}`;
  storage.setItem(snapshotKey, JSON.stringify(snapshot));
  storage.setItem(PREVIEW_SNAPSHOT_LATEST_ID_KEY, snapshot.snapshotId);
}

function parsePreviewSnapshot(rawValue: string): ReadPreviewSnapshotResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue) as unknown;
  } catch {
    return { ok: false, errorCode: "INVALID_JSON" };
  }

  if (!isRecord(parsed)) {
    return { ok: false, errorCode: "INVALID_SHAPE" };
  }

  if (parsed.version !== PREVIEW_SNAPSHOT_VERSION) {
    return { ok: false, errorCode: "UNSUPPORTED_VERSION" };
  }

  if (
    typeof parsed.snapshotId !== "string" ||
    typeof parsed.createdAt !== "string" ||
    typeof parsed.renderSessionSeed !== "string" ||
    !isRecord(parsed.renderProject)
  ) {
    return { ok: false, errorCode: "INVALID_SHAPE" };
  }

  return {
    ok: true,
    snapshot: parsed as PreviewSnapshot,
  };
}

export function readPreviewSnapshot(storage: Storage, snapshotId?: string): ReadPreviewSnapshotResult {
  const resolvedSnapshotId =
    typeof snapshotId === "string" && snapshotId.trim()
      ? snapshotId.trim()
      : storage.getItem(PREVIEW_SNAPSHOT_LATEST_ID_KEY) || "";

  if (!resolvedSnapshotId) {
    return { ok: false, errorCode: "NOT_FOUND" };
  }

  const snapshotKey = `${PREVIEW_SNAPSHOT_STORAGE_KEY_PREFIX}${resolvedSnapshotId}`;
  const rawValue = storage.getItem(snapshotKey);
  if (!rawValue) {
    return { ok: false, errorCode: "NOT_FOUND" };
  }

  return parsePreviewSnapshot(rawValue);
}
