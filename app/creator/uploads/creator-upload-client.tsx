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

  function applyItemToEditor(item: AdminContentItem) {
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
  }

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
      setStatus(`${input.successLabel} uploaded.`);
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
    const response = await fetch("/api/v1/creator/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
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
    setStatus("Creator draft created. Upload source video or manifest to continue.");
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
    setStatus("Creator draft updated.");
    await loadData();
  }

  async function togglePublish(item: AdminContentItem) {
    setError(null);
    setStatus(null);
    const nextStatus = item.publishStatus === "published" ? "draft" : "published";
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
    setStatus(nextStatus === "published" ? "Creator content published." : "Creator content moved to draft.");
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
    setStatus("Creator content deleted.");
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
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {editingItem ? "Edit Creator Draft" : "Create Draft Lesson"}
          </h2>
          {editingItem ? (
            <button
              type="button"
              onClick={resetEditor}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Course title" className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input value={form.heroImageUrl} onChange={(event) => setForm({ ...form, heroImageUrl: event.target.value })} placeholder="Hero image URL" className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <input value={form.cardImageUrl} onChange={(event) => setForm({ ...form, cardImageUrl: event.target.value })} placeholder="Card image URL" className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <input type="number" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} placeholder="Year" className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <input type="number" value={form.durationMin} onChange={(event) => setForm({ ...form, durationMin: Number(event.target.value) })} placeholder="Duration (min)" className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <input value={form.maturityRating} onChange={(event) => setForm({ ...form, maturityRating: event.target.value })} placeholder="Maturity rating" className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <select value={form.publishStatus} onChange={(event) => setForm({ ...form, publishStatus: event.target.value as CreatorForm["publishStatus"] })} className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <textarea value={form.synopsis} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} placeholder="Synopsis" className="mt-3 min-h-28 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium">Asset Uploads</p>
          <p className="mt-1 text-xs text-white/55">
            Save the draft first, then attach a source video and upload a manifest when you are ready to publish.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs text-white/65">Source Video</span>
              <input
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm"
                disabled={!editingItem || uploading}
                onChange={(event) => void handleSourceUpload(event)}
                className="mt-2 block w-full text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black disabled:opacity-50"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-white/65">HLS Manifest</span>
              <input
                type="file"
                accept=".m3u8,application/vnd.apple.mpegurl"
                disabled={!editingItem || uploading}
                onChange={(event) => void handleManifestUpload(event)}
                className="mt-2 block w-full text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-3 space-y-1 text-xs text-white/60">
            <p>{editingItem ? `Lesson ID: ${editingItem.lessonId}` : "Save a draft first to unlock uploads."}</p>
            <p>{uploadStage ? `Upload Stage: ${uploadStage}` : form.streamAssetId ? `Latest Asset: ${form.streamAssetId}` : "No uploaded asset attached yet."}</p>
            <p>{form.manifestBlobKey ? `Manifest: ${form.manifestBlobKey}` : "Manifest not uploaded yet. Drafts can be saved without one."}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void (editingItem ? updateDraft() : createDraft())}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            {editingItem ? "Save Changes" : "Save Creator Draft"}
          </button>
          {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
        <h2 className="text-lg font-semibold">Drafts</h2>
        <div className="mt-3 space-y-2">
          {draftItems.length > 0 ? draftItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-white/55">{item.lessonId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(item)}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void togglePublish(item)}
                    className="rounded-md border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item)}
                    className="rounded-md border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                  <span className="rounded-full border border-white/15 px-2 py-1 text-xs capitalize">{item.publishStatus}</span>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-sm text-white/70">No drafts yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
        <h2 className="text-lg font-semibold">Published</h2>
        <div className="mt-3 space-y-2">
          {publishedItems.length > 0 ? publishedItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-white/55">{item.lessonId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(item)}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void togglePublish(item)}
                    className="rounded-md border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 hover:bg-amber-500/20"
                  >
                    Move to Draft
                  </button>
                  <span className="rounded-full border border-white/15 px-2 py-1 text-xs capitalize">{item.publishStatus}</span>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-sm text-white/70">No published content yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
