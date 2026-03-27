"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountAddress, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  generateCommitments,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/browser";

import type { AdminContentItem } from "@/lib/server/admin-content-model";
import { validateCreatorContentCore } from "@/lib/creator/content-validation";
import { buildTitleBlobName } from "@/lib/storage/blob-path";
import { resolveAppNetwork } from "@/lib/wallet/network";

type Category = {
  id: string;
  name: string;
};

type CreatorForm = {
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId: string;
  publishStatus: "draft" | "published";
};

type ReleaseStage = "metadata" | "source-uploaded" | "processing" | "ready" | "live";

const emptyForm: CreatorForm = {
  title: "",
  synopsis: "",
  year: new Date().getFullYear(),
  categoryId: "",
  heroImageUrl: "",
  cardImageUrl: "",
  durationMin: 30,
  maturityRating: "13+",
  manifestBlobKey: "",
  streamAssetId: "",
  publishStatus: "draft",
};

function getReleaseStage(
  item: Pick<AdminContentItem, "streamAssetId" | "manifestBlobKey" | "publishStatus" | "processingStatus">,
): ReleaseStage {
  if (item.publishStatus === "published") return "live";
  if (item.manifestBlobKey) return "ready";
  if (item.processingStatus === "packaging_requested") return "processing";
  if (item.streamAssetId) return "source-uploaded";
  return "metadata";
}

function getReadinessLabel(
  item: Pick<AdminContentItem, "streamAssetId" | "manifestBlobKey" | "publishStatus" | "processingStatus">,
) {
  const stage = getReleaseStage(item);
  if (stage === "live") return "Live";
  if (stage === "ready") return "Ready to publish";
  if (stage === "source-uploaded") return "Source uploaded";
  if (stage === "processing") return "Processing";
  return "Metadata only";
}

function getReleaseNarrative(
  item: Pick<AdminContentItem, "streamAssetId" | "manifestBlobKey" | "publishStatus" | "processingStatus">,
) {
  const stage = getReleaseStage(item);
  switch (stage) {
    case "live":
      return {
        title: "Public and streamable",
        body: "The lesson is already live in the catalog. Move it back to draft if you need to revise assets or metadata.",
        nextStep: "Monitor performance or return the release to draft.",
      };
    case "ready":
      return {
        title: "Playback is ready",
        body: "A manifest is attached, so the player has a watch-ready artifact. This draft can go public as soon as you are happy with the metadata.",
        nextStep: "Publish when you want the course to appear in the catalog.",
      };
    case "processing":
      return {
        title: "Packaging has been requested",
        body: "Source media is attached and this release has been moved into packaging. The lesson cannot go public until a watch-ready HLS manifest is available.",
        nextStep: "Wait for packaging output or attach the `.m3u8` manifest manually when it is ready.",
      };
    case "source-uploaded":
      return {
        title: "Source uploaded",
        body: "The source asset is attached to the draft, but packaging has not been requested yet. The lesson still needs a playback manifest.",
        nextStep: "Request packaging or attach the `.m3u8` manifest manually.",
      };
    default:
      return {
        title: "Metadata shell only",
        body: "The draft exists, but no media is attached yet. This is the right time to finish the metadata and upload source or manifest files.",
        nextStep: "Upload source media or attach a ready manifest.",
      };
  }
}

export default function CreatorUploadClient() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<AdminContentItem[]>([]);
  const [form, setForm] = useState<CreatorForm>(emptyForm);
  const [editingItem, setEditingItem] = useState<AdminContentItem | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);

  const draftItems = items.filter((item) => item.publishStatus === "draft");
  const publishedItems = items.filter((item) => item.publishStatus === "published");
  const currentAddress =
    typeof account?.address === "string"
      ? account.address
      : typeof account?.address?.toString === "function"
        ? account.address.toString()
        : null;

  const loadData = useCallback(async () => {
    const [categoryRes, contentRes] = await Promise.all([
      fetch("/api/v1/admin/categories"),
      fetch("/api/v1/creator/content"),
    ]);

    if (categoryRes.ok) {
      const body = (await categoryRes.json()) as { data: Category[] };
      setCategories(body.data);
      setForm((current) =>
        !current.categoryId && body.data[0]?.id
          ? { ...current, categoryId: body.data[0]?.id ?? "" }
          : current,
      );
    }

    if (contentRes.ok) {
      const body = (await contentRes.json()) as { data: AdminContentItem[] };
      setItems(body.data);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!editingItem) return;
    const fresh = items.find((item) => item.courseId === editingItem.courseId);
    if (!fresh) return;
    if (
      fresh.manifestBlobKey !== editingItem.manifestBlobKey ||
      fresh.streamAssetId !== editingItem.streamAssetId ||
      fresh.publishStatus !== editingItem.publishStatus
    ) {
      applyItemToEditor(fresh);
    }
  }, [editingItem, items]);

  const applyItemToEditor = (item: AdminContentItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      synopsis: item.synopsis,
      year: item.year,
      categoryId: item.categoryId,
      heroImageUrl: item.heroImageUrl,
      cardImageUrl: item.cardImageUrl,
      durationMin: item.durationMin,
      maturityRating: item.maturityRating,
      manifestBlobKey: item.manifestBlobKey,
      streamAssetId: item.streamAssetId || "",
      publishStatus: item.publishStatus,
    });
  };

  async function uploadAsset(input: {
    file: File;
    folder: "manifests" | "sources";
    successLabel: string;
  }) {
    if (!editingItem) {
      setError("Save a draft first so uploads can attach to a stable lesson.");
      return;
    }

    setUploading(true);
    setError(null);
    setStatus(null);
    setUploadStage("Preparing upload...");

    try {
      if (!connected || !currentAddress || !signAndSubmitTransaction) {
        throw new Error("Connect wallet first to register blob on Shelby L1.");
      }

      const blobName = buildTitleBlobName({
        titleId: editingItem.lessonId,
        folder: input.folder,
        fileName: input.file.name,
      });
      const blobData = new Uint8Array(await input.file.arrayBuffer());

      setStatus("Registering blob metadata on Shelby L1...");
      setUploadStage("Registering on-chain metadata...");
      const provider = await createDefaultErasureCodingProvider();
      const commitment = await generateCommitments(provider, blobData);
      const chunksetSize = provider.config.erasure_k * provider.config.chunkSizeBytes;
      const expirationMicros = (Date.now() + 1000 * 60 * 60 * 24 * 30) * 1000;

      try {
        const pendingTx = await signAndSubmitTransaction({
          data: ShelbyBlobClient.createBatchRegisterBlobsPayload({
            account: AccountAddress.from(currentAddress),
            expirationMicros,
            blobs: [
              {
                blobName,
                blobSize: blobData.length,
                blobMerkleRoot: commitment.blob_merkle_root,
                numChunksets: expectedTotalChunksets(blobData.length, chunksetSize),
              },
            ],
            encoding: provider.config.enumIndex,
          }),
        });
        const aptos = new Aptos(new AptosConfig({ network: resolveAppNetwork() }));
        await aptos.waitForTransaction({
          transactionHash: pendingTx.hash,
        });
      } catch (registerError) {
        const message = registerError instanceof Error ? registerError.message : "";
        const alreadyRegistered =
          message.toLowerCase().includes("already exists") || message.toLowerCase().includes("ealready_exists");
        if (!alreadyRegistered) {
          throw registerError;
        }
      }

      setStatus("Uploading blob bytes to Shelby storage...");
      setUploadStage("Uploading blob bytes...");
      const formData = new FormData();
      formData.set("titleId", editingItem.lessonId);
      formData.set("folder", input.folder);
      formData.set("file", input.file, input.file.name);
      formData.set(
        "contentType",
        input.file.type || (input.folder === "manifests" ? "application/vnd.apple.mpegurl" : "video/mp4"),
      );

      const response = await fetch("/api/v1/storage/ingest", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || `${input.successLabel} upload failed`);
      }

      const body = (await response.json()) as {
        data: { blobKey: string; asset: { id: string } };
      };

      setForm((current) => ({
        ...current,
        ...(input.folder === "manifests" ? { manifestBlobKey: body.data.blobKey } : {}),
        streamAssetId: body.data.asset.id || current.streamAssetId,
      }));
      setStatus(
        input.folder === "manifests"
          ? "Manifest attached. This draft is now ready to publish."
          : "Source video uploaded. Finish packaging and attach an HLS manifest to unlock publish.",
      );
      setUploadStage("Upload completed.");
      await loadData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : `${input.successLabel} upload failed`);
      setUploadStage(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleManifestUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAsset({
      file,
      folder: "manifests",
      successLabel: "Manifest",
    });
    event.target.value = "";
  }

  async function handleSourceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAsset({
      file,
      folder: "sources",
      successLabel: "Source video",
    });
    event.target.value = "";
  }

  async function createDraft() {
    setError(null);
    setStatus(null);
    const validationError = validateCreatorContentCore(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    const response = await fetch("/api/v1/creator/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        publishStatus: "draft",
      }),
    });
    const body = (await response.json().catch(() => null)) as { data?: AdminContentItem; error?: { message?: string } } | null;
    if (!response.ok) {
      setError(body?.error?.message || "Failed to create creator content.");
      return;
    }
    if (!body?.data) {
      setError("Creator draft was created but response payload was missing.");
      return;
    }
    applyItemToEditor(body.data);
    setStatus("Draft created. You can now attach source media or a manifest.");
    await loadData();
  }

  async function updateDraft() {
    if (!editingItem) return;
    setError(null);
    setStatus(null);
    const response = await fetch("/api/v1/creator/content", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: editingItem.courseId,
        lessonId: editingItem.lessonId,
        ...form,
        publishStatus: editingItem.publishStatus,
      }),
    });
    const body = (await response.json().catch(() => null)) as { data?: AdminContentItem; error?: { message?: string } } | null;
    if (!response.ok) {
      setError(body?.error?.message || "Failed to update creator content.");
      return;
    }
    if (!body?.data) {
      setError("Creator content updated but response payload was missing.");
      return;
    }
    applyItemToEditor(body.data);
    setStatus("Draft updated.");
    await loadData();
  }

  async function togglePublish(item: AdminContentItem) {
    setError(null);
    setStatus(null);
    const nextStatus = item.publishStatus === "published" ? "draft" : "published";
    if (nextStatus === "published" && !item.manifestBlobKey) {
      setError("Attach a watch-ready HLS manifest before publishing this course.");
      return;
    }
    const response = await fetch("/api/v1/creator/content", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: item.courseId,
        lessonId: item.lessonId,
        publishStatus: nextStatus,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to update publish status.");
      return;
    }
    setStatus(nextStatus === "published" ? "Course is now public." : "Course moved back to draft.");
    await loadData();
  }

  async function requestPackaging(item: AdminContentItem) {
    setError(null);
    setStatus("Queueing packaging...");
    const response = await fetch("/api/v1/creator/content/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: item.courseId,
        lessonId: item.lessonId,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to request packaging.");
      setStatus(null);
      return;
    }
    setStatus("Packaging requested. Attach the manifest when the packaging output is ready.");
    await loadData();
  }

  async function deleteItem(item: AdminContentItem) {
    setError(null);
    setStatus(null);
    const response = await fetch("/api/v1/creator/content", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: item.courseId,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to delete creator content.");
      return;
    }
    if (editingItem?.courseId === item.courseId) {
      resetEditor();
    }
    setStatus("Course deleted.");
    await loadData();
  }

  function beginEdit(item: AdminContentItem) {
    applyItemToEditor(item);
    setStatus(null);
    setError(null);
    setUploadStage(null);
  }

  function resetEditor() {
    setEditingItem(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? "",
    });
    setStatus(null);
    setError(null);
    setUploadStage(null);
  }

  const editorStage = editingItem ? getReleaseStage(editingItem) : "metadata";
  const editorNarrative = editingItem
    ? getReleaseNarrative(editingItem)
    : {
        title: "Create the shell first",
        body: "A draft course gives the studio a stable lesson id, which the Shelby upload flow uses for source and manifest blobs.",
        nextStep: "Save the first draft to unlock media uploads.",
      };

  return (
    <div className="space-y-6">
      <section className="app-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">{editingItem ? "Editing draft" : "New course draft"}</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {editingItem ? "Refine the release" : "Create the course shell first"}
            </h2>
          </div>
          {editingItem ? (
            <button type="button" onClick={resetEditor} className="app-secondary-button px-4 py-2 text-sm">
              Clear editor
            </button>
          ) : null}
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
          Drafts are always private. You only publish from the draft list below, after the lesson has a watch-ready manifest.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Course title" className="form-shell text-sm" />
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="form-shell text-sm">
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input value={form.heroImageUrl} onChange={(event) => setForm({ ...form, heroImageUrl: event.target.value })} placeholder="Hero image URL" className="form-shell text-sm" />
          <input value={form.cardImageUrl} onChange={(event) => setForm({ ...form, cardImageUrl: event.target.value })} placeholder="Card image URL" className="form-shell text-sm" />
          <input type="number" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} placeholder="Release year" className="form-shell text-sm" />
          <input type="number" value={form.durationMin} onChange={(event) => setForm({ ...form, durationMin: Number(event.target.value) })} placeholder="Lesson duration in minutes" className="form-shell text-sm" />
          <input value={form.maturityRating} onChange={(event) => setForm({ ...form, maturityRating: event.target.value })} placeholder="Audience rating" className="form-shell text-sm" />
        </div>

        <textarea value={form.synopsis} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} placeholder="Public synopsis" className="form-shell mt-3 min-h-32 text-sm" />

        <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/12 bg-black/20 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">{editingItem ? getReadinessLabel(editingItem) : "Draft not saved yet"}</span>
            {form.streamAssetId ? <span className="status-pill">Source attached</span> : null}
            {form.manifestBlobKey ? <span className="status-pill">Manifest attached</span> : null}
          </div>
          <p className="mt-3 text-sm font-medium">{editorNarrative.title}</p>
          <p className="mt-1 text-sm leading-7 text-white/60">{editorNarrative.body}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-white/55">Source video</span>
              <input
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm"
                disabled={!editingItem || uploading}
                onChange={(event) => void handleSourceUpload(event)}
                className="mt-2 block w-full text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black disabled:opacity-50"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-white/55">HLS manifest</span>
              <input
                type="file"
                accept=".m3u8,application/vnd.apple.mpegurl"
                disabled={!editingItem || uploading}
                onChange={(event) => void handleManifestUpload(event)}
                className="mt-2 block w-full text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black disabled:opacity-50"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="app-panel-soft rounded-2xl p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Draft state</p>
              <p className="mt-2 text-sm text-white/75">{editingItem ? "Ready for uploads" : "Save a draft to unlock uploads"}</p>
            </div>
            <div className="app-panel-soft rounded-2xl p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Media pipeline</p>
              <p className="mt-2 text-sm text-white/75">
                {uploadStage
                  ? uploadStage
                  : editorStage === "processing"
                    ? "Source is attached. Packaging still needs a manifest."
                    : editorStage === "source-uploaded"
                      ? "Source is attached. Packaging has not been requested yet."
                    : form.streamAssetId
                      ? "Source is attached to this draft."
                      : "No source media yet."}
              </p>
            </div>
            <div className="app-panel-soft rounded-2xl p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Next step</p>
              <p className="mt-2 text-sm text-white/75">{editorNarrative.nextStep}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void (editingItem ? updateDraft() : createDraft())} className="app-primary-button px-5 py-3 text-sm">
            {editingItem ? "Save changes" : "Create draft"}
          </button>
          {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </section>

      <section className="app-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Private workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">Drafts</h2>
          </div>
          <span className="status-pill">{draftItems.length} active</span>
        </div>
        <div className="mt-4 space-y-3">
          {draftItems.length > 0 ? draftItems.map((item) => (
            <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <span className="status-pill">{getReadinessLabel(item)}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">{item.categoryId}</p>
                  <p className="mt-2 text-sm leading-7 text-white/60">{getReleaseNarrative(item).nextStep}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => beginEdit(item)} className="app-secondary-button px-3 py-2 text-xs">
                    Edit
                  </button>
                  {getReleaseStage(item) === "source-uploaded" ? (
                    <button
                      type="button"
                      onClick={() => void requestPackaging(item)}
                      className="app-secondary-button px-3 py-2 text-xs"
                    >
                      Request packaging
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void togglePublish(item)}
                    disabled={!item.manifestBlobKey}
                    title={!item.manifestBlobKey ? "Attach an HLS manifest first." : "Publish this course"}
                    className="app-primary-button px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Publish
                  </button>
                  <button type="button" onClick={() => void deleteItem(item)} className="app-secondary-button px-3 py-2 text-xs">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-sm text-white/70">No drafts yet. Create the first one above.</p>
          )}
        </div>
      </section>

      <section className="app-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Public catalog</p>
            <h2 className="mt-2 text-2xl font-semibold">Published</h2>
          </div>
          <span className="status-pill">{publishedItems.length} live</span>
        </div>
        <div className="mt-4 space-y-3">
          {publishedItems.length > 0 ? publishedItems.map((item) => (
            <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <span className="status-pill">Live</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">{item.categoryId}</p>
                  <p className="mt-2 text-sm leading-7 text-white/60">{getReleaseNarrative(item).nextStep}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => beginEdit(item)} className="app-secondary-button px-3 py-2 text-xs">
                    Edit
                  </button>
                  <button type="button" onClick={() => void togglePublish(item)} className="app-secondary-button px-3 py-2 text-xs">
                    Return to draft
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-sm text-white/70">Nothing is public yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
