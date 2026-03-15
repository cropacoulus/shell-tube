"use client";

import { useEffect, useState } from "react";
import { AccountAddress, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  generateCommitments,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/browser";
import { buildTitleBlobName } from "@/lib/storage/blob-path";
import { resolveAppNetwork } from "@/lib/wallet/network";

type Category = {
  id: string;
  name: string;
  description?: string;
};

type Video = {
  id: string;
  title: string;
  categoryId: string;
  year: number;
  manifestBlobKey: string;
};

const emptyVideo = {
  title: "",
  synopsis: "",
  year: new Date().getFullYear(),
  maturityRating: "13+",
  durationMin: 90,
  categoryId: "",
  heroImageUrl: "",
  cardImageUrl: "",
  manifestBlobKey: "",
};

function isManifestFile(fileName: string) {
  return fileName.toLowerCase().endsWith(".m3u8");
}

function resolveUploadFolder(fileName: string) {
  return isManifestFile(fileName) ? "manifests" : "videos";
}

export default function AdminClient() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [videoForm, setVideoForm] = useState(emptyVideo);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadTitleId, setUploadTitleId] = useState("");
  const [selectedUploadName, setSelectedUploadName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const currentAddress =
    typeof account?.address === "string"
      ? account.address
      : account?.address?.toString?.() ?? null;

  async function loadData() {
    const [catRes, vidRes] = await Promise.all([
      fetch("/api/v1/admin/categories"),
      fetch("/api/v1/admin/videos"),
    ]);
    if (catRes.ok) {
      const body = (await catRes.json()) as { data: Category[] };
      setCategories(body.data);
    }
    if (vidRes.ok) {
      const body = (await vidRes.json()) as { data: Video[] };
      setVideos(body.data);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createCategory() {
    setError(null);
    const res = await fetch("/api/v1/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: catName, description: catDesc }),
    });
    if (!res.ok) {
      setError("Failed to create category.");
      return;
    }
    setCatName("");
    setCatDesc("");
    setStatus("Category created.");
    await loadData();
  }

  async function createVideo() {
    setError(null);
    const res = await fetch("/api/v1/admin/videos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(videoForm),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(body?.error?.message || "Failed to create video. Check category and field values.");
      return;
    }
    setVideoForm(emptyVideo);
    setStatus("Video created.");
    await loadData();
  }

  async function uploadStreamAsset(file: File) {
    setError(null);
    setStatus(null);
    setUploading(true);
    try {
      if (!connected || !currentAddress || !signAndSubmitTransaction) {
        throw new Error("Connect wallet first to register blob on Shelby L1.");
      }

      const normalizedTitle = videoForm.title.toLowerCase().trim().replace(/\s+/g, "-");
      const titleId = uploadTitleId || normalizedTitle;
      if (!titleId) {
        throw new Error("Set title or upload title key before uploading.");
      }

      const folder = resolveUploadFolder(file.name);
      const blobName = buildTitleBlobName({
        titleId,
        folder,
        fileName: file.name,
      });
      const blobData = new Uint8Array(await file.arrayBuffer());

      setStatus("Registering blob metadata on Shelby L1...");
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
      const form = new FormData();
      form.set("titleId", titleId);
      form.set("folder", folder);
      form.set("file", file, file.name);
      form.set(
        "contentType",
        file.type || (isManifestFile(file.name) ? "application/vnd.apple.mpegurl" : "video/mp4"),
      );

      const res = await fetch("/api/v1/storage/ingest", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message || "Stream asset upload failed.");
      }

      const body = (await res.json()) as { data: { blobKey: string } };
      setVideoForm((prev) => ({ ...prev, manifestBlobKey: body.data.blobKey }));
      setStatus(
        isManifestFile(file.name)
          ? `HLS manifest uploaded to Shelby: ${body.data.blobKey}`
          : `Video file uploaded to Shelby: ${body.data.blobKey}`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Stream asset upload failed.";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <h1 className="text-3xl font-semibold">Admin Studio Dashboard</h1>

      <section className="grid gap-4 rounded-xl border border-white/10 bg-[#10141f] p-5 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Create Category</h2>
          <input
            value={catName}
            onChange={(event) => setCatName(event.target.value)}
            placeholder="Category name"
            className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
          />
          <textarea
            value={catDesc}
            onChange={(event) => setCatDesc(event.target.value)}
            placeholder="Description"
            className="h-24 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
          />
          <button onClick={createCategory} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
            Add Category
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Existing Categories</h3>
          {categories.map((cat) => (
            <div key={cat.id} className="rounded border border-white/10 px-3 py-2">
              <p className="font-medium">{cat.name}</p>
              <p className="text-white/70">{cat.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-white/10 bg-[#10141f] p-5 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Create Video</h2>
          <input placeholder="Title" value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2" />
          <textarea placeholder="Synopsis" value={videoForm.synopsis} onChange={(e) => setVideoForm({ ...videoForm, synopsis: e.target.value })} className="h-20 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Year" value={videoForm.year} onChange={(e) => setVideoForm({ ...videoForm, year: Number(e.target.value) })} className="rounded-md border border-white/20 bg-black/30 px-3 py-2" />
            <input type="number" placeholder="Duration min" value={videoForm.durationMin} onChange={(e) => setVideoForm({ ...videoForm, durationMin: Number(e.target.value) })} className="rounded-md border border-white/20 bg-black/30 px-3 py-2" />
          </div>
          <input placeholder="Maturity rating (e.g. 16+)" value={videoForm.maturityRating} onChange={(e) => setVideoForm({ ...videoForm, maturityRating: e.target.value })} className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2" />
          <select
            value={videoForm.categoryId}
            onChange={(e) => setVideoForm({ ...videoForm, categoryId: e.target.value })}
            className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option value={cat.id} key={cat.id}>{cat.name}</option>
            ))}
          </select>
          <input placeholder="Hero image URL" value={videoForm.heroImageUrl} onChange={(e) => setVideoForm({ ...videoForm, heroImageUrl: e.target.value })} className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2" />
          <input placeholder="Card image URL" value={videoForm.cardImageUrl} onChange={(e) => setVideoForm({ ...videoForm, cardImageUrl: e.target.value })} className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2" />
          <input
            placeholder="Upload title key (optional, e.g. black-signal)"
            value={uploadTitleId}
            onChange={(e) => setUploadTitleId(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
          />
          <label className="block text-sm font-medium text-white">
            Upload Video File to Shelby (Server-Side)
            <input
              type="file"
              accept="video/*,.mp4,.webm,.mov,.m3u8"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setSelectedUploadName(file.name);
                  void uploadStreamAsset(file);
                }
              }}
              className="mt-2 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          {selectedUploadName ? (
            <p className="text-xs text-white/70">Selected: {selectedUploadName}</p>
          ) : null}
          <input
            placeholder="Uploaded stream key (auto-filled after upload)"
            value={videoForm.manifestBlobKey}
            readOnly
            className="w-full rounded-md border border-cyan-400/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200"
          />
          <details className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
            <summary className="cursor-pointer select-none text-white/80">Advanced: set stream key manually</summary>
            <input
              placeholder="titles/my-title/videos/file.mp4 or titles/my-title/manifests/master.m3u8"
              value={videoForm.manifestBlobKey}
              onChange={(e) => setVideoForm({ ...videoForm, manifestBlobKey: e.target.value })}
              className="mt-2 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
            />
          </details>
          {uploading ? <p className="text-xs text-cyan-200">Uploading to Shelby storage...</p> : null}
          <button onClick={createVideo} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
            Add Video
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Catalog Videos</h3>
          {videos.map((video) => (
            <div key={video.id} className="rounded border border-white/10 px-3 py-2">
              <p className="font-medium">{video.title}</p>
              <p className="text-white/70">{video.year} • {video.manifestBlobKey}</p>
            </div>
          ))}
        </div>
      </section>

      {status ? <p className="text-sm text-cyan-200">{status}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
