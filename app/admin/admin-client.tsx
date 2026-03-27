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
import { buildAdminContentItem, type AdminContentItem } from "@/lib/server/admin-content-model";
import { buildTitleBlobName } from "@/lib/storage/blob-path";
import { resolveAppNetwork } from "@/lib/wallet/network";

type Category = {
  id: string;
  name: string;
  description?: string;
};

type CourseRecord = {
  id: string;
  creatorProfileId?: string;
  title: string;
  categoryId: string;
  year: number;
  synopsis?: string;
  heroImageUrl?: string;
  cardImageUrl?: string;
  publishStatus: "draft" | "published";
  createdAt?: string;
};

type LessonRecord = {
  id: string;
  courseId: string;
  title: string;
  synopsis?: string;
  durationMin?: number;
  maturityRating?: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: "draft" | "published";
  createdAt?: string;
};

type DeleteTarget =
  | { type: "category"; id: string; label: string }
  | { type: "course"; id: string; label: string }
  | null;

type VideoForm = {
  title: string;
  synopsis: string;
  year: number;
  maturityRating: string;
  durationMin: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
  streamAssetId: string;
  publishStatus: "draft" | "published";
};

const emptyVideo: VideoForm = {
  title: "",
  synopsis: "",
  year: new Date().getFullYear(),
  maturityRating: "13+",
  durationMin: 90,
  categoryId: "",
  heroImageUrl: "",
  cardImageUrl: "",
  manifestBlobKey: "",
  streamAssetId: "",
  publishStatus: "draft" as const,
};

function isManifestFile(fileName: string) {
  return fileName.toLowerCase().endsWith(".m3u8");
}

function resolveUploadFolder(fileName: string) {
  return isManifestFile(fileName) ? "manifests" : "videos";
}

function normalizeTitleKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function AdminClient() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [videoForm, setVideoForm] = useState(emptyVideo);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadTitleId, setUploadTitleId] = useState("");
  const [selectedUploadName, setSelectedUploadName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [videoQuery, setVideoQuery] = useState("");
  const [videoCategoryFilter, setVideoCategoryFilter] = useState<string>("all");
  const [videoSort, setVideoSort] = useState<"newest" | "title" | "year">("newest");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingVideo, setEditingVideo] = useState<AdminContentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const currentAddress =
    typeof account?.address === "string"
      ? account.address
      : account?.address?.toString?.() ?? null;

  async function loadData() {
    const [catRes, courseRes, lessonRes] = await Promise.all([
      fetch("/api/v1/admin/categories"),
      fetch("/api/v1/admin/courses"),
      fetch("/api/v1/admin/lessons"),
    ]);
    if (catRes.ok) {
      const body = (await catRes.json()) as { data: Category[] };
      setCategories(body.data);
    }
    if (courseRes.ok) {
      const body = (await courseRes.json()) as { data: CourseRecord[] };
      setCourses(body.data);
    }
    if (lessonRes.ok) {
      const body = (await lessonRes.json()) as { data: LessonRecord[] };
      setLessons(body.data);
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

  async function patchCategory(input: { id: string; name: string; description?: string }) {
    setError(null);
    const res = await fetch("/api/v1/admin/categories", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to update category.");
      return false;
    }
    setStatus("Category updated.");
    await loadData();
    return true;
  }

  async function patchVideo(input: AdminContentItem) {
    setError(null);
    const validationError = validateVideoPayload({
      title: input.title || "",
      synopsis: input.synopsis || "",
      year: input.year,
      maturityRating: input.maturityRating || "",
      durationMin: input.durationMin || 0,
      categoryId: input.categoryId || "",
      heroImageUrl: input.heroImageUrl || "",
      cardImageUrl: input.cardImageUrl || "",
      manifestBlobKey: input.manifestBlobKey || "",
      streamAssetId: input.streamAssetId || "",
      publishStatus: input.publishStatus,
    });
    if (validationError) {
      setError(validationError);
      return false;
    }

    const [courseRes, lessonRes] = await Promise.all([
      fetch("/api/v1/admin/courses", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: input.courseId,
          creatorProfileId: input.creatorProfileId,
          title: input.title,
          synopsis: input.synopsis || "",
          year: input.year,
          categoryId: input.categoryId,
          heroImageUrl: input.heroImageUrl || "",
          cardImageUrl: input.cardImageUrl || "",
          publishStatus: input.publishStatus,
        }),
      }),
      fetch("/api/v1/admin/lessons", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: input.lessonId,
          title: `${input.title} • Main Lesson`,
          synopsis: input.synopsis || "",
          durationMin: input.durationMin || 0,
          maturityRating: input.maturityRating || "",
          manifestBlobKey: input.manifestBlobKey,
          streamAssetId: input.streamAssetId || "",
          publishStatus: input.publishStatus,
        }),
      }),
    ]);
    if (!courseRes.ok || !lessonRes.ok) {
      const body = (await lessonRes.json().catch(async () => courseRes.json().catch(() => null))) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message || "Failed to update content.");
      return false;
    }
    setStatus("Content updated.");
    await loadData();
    return true;
  }

  async function createCourseAndLesson(payload = videoForm, successMessage = "Course created.") {
    setError(null);
    const validationError = validateVideoPayload(payload);
    if (validationError) {
      setError(validationError);
      return false;
    }

    const courseRes = await fetch("/api/v1/admin/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        synopsis: payload.synopsis || "",
        year: payload.year,
        categoryId: payload.categoryId,
        heroImageUrl: payload.heroImageUrl || "",
        cardImageUrl: payload.cardImageUrl || "",
        publishStatus: payload.publishStatus,
      }),
    });
    if (!courseRes.ok) {
      const body = (await courseRes.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to create course.");
      return false;
    }
    const courseBody = (await courseRes.json()) as { data: CourseRecord };

    const lessonRes = await fetch("/api/v1/admin/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId: courseBody.data.id,
        title: `${payload.title} • Main Lesson`,
        synopsis: payload.synopsis || "",
        durationMin: payload.durationMin || 0,
        maturityRating: payload.maturityRating || "",
        manifestBlobKey: payload.manifestBlobKey,
        streamAssetId: payload.streamAssetId || "",
        publishStatus: payload.publishStatus,
      }),
    });
    if (!lessonRes.ok) {
      const body = (await lessonRes.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to create lesson.");
      return false;
    }
    setVideoForm(emptyVideo);
    setSelectedUploadName(null);
    setStatus(successMessage);
    await loadData();
    return true;
  }

  async function deleteCategoryById(id: string) {
    setError(null);
    const res = await fetch("/api/v1/admin/categories", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to delete category.");
      return false;
    }
    setStatus("Category deleted.");
    await loadData();
    return true;
  }

  async function deleteVideoById(id: string) {
    setError(null);
    const res = await fetch("/api/v1/admin/courses", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to delete course.");
      return false;
    }
    setStatus("Course deleted.");
    await loadData();
    return true;
  }

  function validateVideoPayload(payload: VideoForm) {
    if (!payload.title.trim()) return "Course title is required.";
    if (!payload.synopsis.trim()) return "Course synopsis is required.";
    if (!payload.categoryId.trim()) return "Category is required.";
    if (!payload.manifestBlobKey.trim()) return "Upload lesson stream to Shelby first.";
    if (!payload.heroImageUrl.trim() || !payload.cardImageUrl.trim()) {
      return "Hero and card image URL are required.";
    }
    return null;
  }

  async function uploadStreamAsset(file: File) {
    setError(null);
    setStatus(null);
    setUploadStage("Preparing upload...");
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

      const body = (await res.json()) as { data: { blobKey: string; asset?: { id: string } } };
      const streamAssetId = body.data.asset?.id || "";
      setVideoForm((prev) => ({
        ...prev,
        manifestBlobKey: body.data.blobKey,
        streamAssetId: streamAssetId || prev.streamAssetId,
      }));
      setUploadStage("Upload completed.");
      setStatus(
        isManifestFile(file.name)
          ? `HLS manifest uploaded to Shelby: ${body.data.blobKey}`
          : `Video file uploaded to Shelby: ${body.data.blobKey}`,
      );
      return { blobKey: body.data.blobKey, streamAssetId };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Stream asset upload failed.";
      setError(message);
      setUploadStage(null);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function uploadAndCreateVideo(file: File) {
    const formSnapshot = { ...videoForm };
    const uploadedAsset = await uploadStreamAsset(file);
    if (!uploadedAsset) return;
    setUploadStage("Creating catalog entry...");
    const payload = {
      ...formSnapshot,
      manifestBlobKey: uploadedAsset.blobKey,
      streamAssetId: uploadedAsset.streamAssetId,
    };
    const created = await createCourseAndLesson(payload, "Upload completed and course added.");
    if (!created) return;
    setUploadStage("Done.");
  }

  const categoryById = new Map(categories.map((item) => [item.id, item.name]));
  const contentItems: AdminContentItem[] = courses
    .map((course) => {
      const lesson = lessons.find((item) => item.courseId === course.id);
      if (!lesson) return null;
      return buildAdminContentItem(
        {
          ...course,
          synopsis: course.synopsis || lesson.synopsis || "",
          heroImageUrl: course.heroImageUrl || "",
          cardImageUrl: course.cardImageUrl || "",
          createdAt: course.createdAt || lesson.createdAt || new Date().toISOString(),
        },
        {
          ...lesson,
          durationMin: lesson.durationMin || 0,
          maturityRating: lesson.maturityRating || "",
          synopsis: lesson.synopsis || course.synopsis || "",
          createdAt: lesson.createdAt || course.createdAt || new Date().toISOString(),
        },
      );
    })
    .filter((item): item is AdminContentItem => Boolean(item));
  const filteredVideos = contentItems
    .filter((item) => {
      const query = videoQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.manifestBlobKey.toLowerCase().includes(query)
      );
    })
    .filter((item) => (videoCategoryFilter === "all" ? true : item.categoryId === videoCategoryFilter))
    .sort((a, b) => {
      if (videoSort === "title") return a.title.localeCompare(b.title);
      if (videoSort === "year") return b.year - a.year;
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });

  const stats = {
    totalCategories: categories.length,
    totalVideos: courses.length,
    withStreamKey: lessons.filter((item) => item.manifestBlobKey.trim()).length,
    releasedThisYear: courses.filter((item) => item.year === new Date().getFullYear()).length,
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="app-panel rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="app-kicker">Admin studio</p>
            <h1 className="mt-3 text-2xl font-semibold md:text-4xl">Keep the platform catalog and creator intake under control.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68">Manage categories, operate the catalog, and keep publishing state clean without exposing this control layer to creators.</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="app-secondary-button px-4 py-2 text-sm"
          >
            Refresh data
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Categories</p>
            <p className="mt-1 text-2xl font-semibold">{stats.totalCategories}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Courses</p>
            <p className="mt-1 text-2xl font-semibold">{stats.totalVideos}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Stream ready</p>
            <p className="mt-1 text-2xl font-semibold">{stats.withStreamKey}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Released this year</p>
            <p className="mt-1 text-2xl font-semibold">{stats.releasedThisYear}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="app-panel space-y-4 rounded-[2rem] p-6 lg:col-span-1">
          <div>
            <p className="app-kicker">Taxonomy</p>
            <h2 className="mt-2 text-2xl font-semibold">Category manager</h2>
          </div>
          <input
            value={catName}
            onChange={(event) => setCatName(event.target.value)}
            placeholder="Category name"
            className="form-shell"
          />
          <textarea
            value={catDesc}
            onChange={(event) => setCatDesc(event.target.value)}
            placeholder="Description"
            className="form-shell h-24"
          />
          <button onClick={createCategory} className="app-primary-button w-full px-4 py-3 text-sm">
            Add category
          </button>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Existing categories</p>
            {categories.length === 0 ? <p className="text-white/60">No categories yet.</p> : null}
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-[1.25rem] border border-white/10 bg-white/4 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{cat.name}</p>
                    <p className="line-clamp-2 text-white/70">{cat.description || "-"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(cat)}
                      className="app-secondary-button px-3 py-1.5 text-[10px]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ type: "category", id: cat.id, label: cat.name })}
                      className="app-danger-button px-3 py-1.5 text-[10px]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel space-y-4 rounded-[2rem] p-6 lg:col-span-2">
          <div>
            <p className="app-kicker">Catalog operations</p>
            <h2 className="mt-2 text-2xl font-semibold">Course publisher</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Title"
              value={videoForm.title}
              onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
              className="form-shell w-full sm:col-span-2"
            />
            <textarea
              placeholder="Synopsis"
              value={videoForm.synopsis}
              onChange={(e) => setVideoForm({ ...videoForm, synopsis: e.target.value })}
              className="form-shell h-24 w-full sm:col-span-2"
            />
            <input
              type="number"
              placeholder="Year"
              value={videoForm.year}
              onChange={(e) => setVideoForm({ ...videoForm, year: Number(e.target.value) })}
              className="form-shell"
            />
            <input
              type="number"
              placeholder="Duration min"
              value={videoForm.durationMin}
              onChange={(e) => setVideoForm({ ...videoForm, durationMin: Number(e.target.value) })}
              className="form-shell"
            />
            <input
              placeholder="Maturity rating (e.g. 16+)"
              value={videoForm.maturityRating}
              onChange={(e) => setVideoForm({ ...videoForm, maturityRating: e.target.value })}
              className="form-shell"
            />
            <select
              value={videoForm.categoryId}
              onChange={(e) => setVideoForm({ ...videoForm, categoryId: e.target.value })}
              className="form-shell"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option value={cat.id} key={cat.id}>{cat.name}</option>
              ))}
            </select>
            <input
              placeholder="Hero image URL"
              value={videoForm.heroImageUrl}
              onChange={(e) => setVideoForm({ ...videoForm, heroImageUrl: e.target.value })}
              className="form-shell"
            />
            <input
              placeholder="Card image URL"
              value={videoForm.cardImageUrl}
              onChange={(e) => setVideoForm({ ...videoForm, cardImageUrl: e.target.value })}
              className="form-shell"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-panel-soft rounded-[1.35rem] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Hero preview</p>
              {videoForm.heroImageUrl.trim() ? (
                <img
                  src={videoForm.heroImageUrl}
                  alt="Hero preview"
                  className="h-28 w-full rounded-md object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-white/20 text-xs text-white/50">
                  Enter hero image URL
                </div>
              )}
            </div>
            <div className="app-panel-soft rounded-[1.35rem] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Card preview</p>
              {videoForm.cardImageUrl.trim() ? (
                <img
                  src={videoForm.cardImageUrl}
                  alt="Card preview"
                  className="h-28 w-full rounded-md object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-white/20 text-xs text-white/50">
                  Enter card image URL
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Upload Key</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                placeholder="Upload title key (e.g. black-signal)"
                value={uploadTitleId}
                onChange={(e) => setUploadTitleId(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setUploadTitleId(normalizeTitleKey(videoForm.title))}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
              >
                Generate From Title
              </button>
            </div>
          </div>

          <label className="block text-sm font-medium text-white">
            Upload Lesson Stream to Shelby + Auto Create Course
            <input
              type="file"
              accept="video/*,.mp4,.webm,.mov,.m3u8"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setSelectedUploadName(file.name);
                  void uploadAndCreateVideo(file);
                }
              }}
              className="mt-2 block w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
          </label>

          {selectedUploadName ? (
            <p className="text-xs text-white/70">Selected file: {selectedUploadName}</p>
          ) : null}
          {uploading || uploadStage ? (
            <p className="text-xs text-cyan-200">{uploadStage || "Uploading to Shelby storage..."}</p>
          ) : null}

          <input
            placeholder="Uploaded lesson stream key (auto-filled after upload)"
            value={videoForm.manifestBlobKey}
            readOnly
            className="w-full rounded-lg border border-cyan-400/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => { void createCourseAndLesson(); }}
              className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Add Course + Lesson
            </button>
            <button
              onClick={() => setVideoForm(emptyVideo)}
              className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-black/20"
            >
              Reset Form
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Catalog Courses</h3>
          <p className="text-xs text-white/60">{filteredVideos.length} / {contentItems.length} shown</p>
        </div>
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <input
            value={videoQuery}
            onChange={(event) => setVideoQuery(event.target.value)}
            placeholder="Search by title or blob key..."
            className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={videoCategoryFilter}
            onChange={(event) => setVideoCategoryFilter(event.target.value)}
            className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={videoSort}
            onChange={(event) => setVideoSort(event.target.value as "newest" | "title" | "year")}
            className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
          >
            <option value="newest">Sort: Newest</option>
            <option value="title">Sort: Title A-Z</option>
            <option value="year">Sort: Year Desc</option>
          </select>
        </div>

        {filteredVideos.length === 0 ? <p className="text-sm text-white/60">No courses match current filter.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {filteredVideos.map((video) => (
            <article key={video.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{video.title}</p>
                  <p className="text-xs text-white/60">
                  {video.year} • {video.durationMin ?? "-"} min • {video.maturityRating ?? "-"}
                  </p>
                  <p className="text-xs text-cyan-200">{categoryById.get(video.categoryId) ?? "Unknown Category"}</p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-white/70">
                  {video.id}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  video.publishStatus === "published"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-amber-500/15 text-amber-200"
                }`}>
                  {video.publishStatus}
                </span>
                {video.streamAssetId ? (
                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                    asset {video.streamAssetId}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-white/70">{video.synopsis || "-"}</p>
              <div className="mt-3 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white/70">
                {video.manifestBlobKey}
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(video.manifestBlobKey).then(() => {
                    setStatus(`Copied stream key for ${video.title}`);
                  }).catch(() => {
                    setError("Failed to copy stream key.");
                  });
                }}
                className="mt-2 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
              >
                Copy Stream Key
              </button>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void patchVideo({
                      ...video,
                      publishStatus: video.publishStatus === "published" ? "draft" : "published",
                    });
                  }}
                  className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                >
                  {video.publishStatus === "published" ? "Move to Draft" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingVideo(video)}
                  className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
                >
                  Edit Video
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ type: "course", id: video.id, label: video.title })}
                  className="rounded-md border border-red-300/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                >
                  Delete Course
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {status ? <p className="text-sm text-cyan-200">{status}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {editingCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border border-white/15 bg-[#0f1524] p-4">
            <h4 className="text-lg font-semibold">Edit Category</h4>
            <input
              value={editingCategory.name}
              onChange={(event) => setEditingCategory({ ...editingCategory, name: event.target.value })}
              className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2"
            />
            <textarea
              value={editingCategory.description || ""}
              onChange={(event) => setEditingCategory({ ...editingCategory, description: event.target.value })}
              className="h-24 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingCategory(null)} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Cancel</button>
              <button
                onClick={() => {
                  void patchCategory({
                    id: editingCategory.id,
                    name: editingCategory.name,
                    description: editingCategory.description || "",
                  }).then((ok) => {
                    if (ok) setEditingCategory(null);
                  });
                }}
                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl space-y-3 rounded-xl border border-white/15 bg-[#0f1524] p-4">
            <h4 className="text-lg font-semibold">Edit Course</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={editingVideo.title}
                onChange={(event) => setEditingVideo({ ...editingVideo, title: event.target.value })}
                placeholder="Title"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 sm:col-span-2"
              />
              <textarea
                value={editingVideo.synopsis || ""}
                onChange={(event) => setEditingVideo({ ...editingVideo, synopsis: event.target.value })}
                placeholder="Synopsis"
                className="h-20 rounded-lg border border-white/20 bg-black/30 px-3 py-2 sm:col-span-2"
              />
              <input
                type="number"
                value={editingVideo.year}
                onChange={(event) => setEditingVideo({ ...editingVideo, year: Number(event.target.value) })}
                placeholder="Year"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <input
                type="number"
                value={editingVideo.durationMin || 0}
                onChange={(event) => setEditingVideo({ ...editingVideo, durationMin: Number(event.target.value) })}
                placeholder="Duration"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <input
                value={editingVideo.maturityRating || ""}
                onChange={(event) => setEditingVideo({ ...editingVideo, maturityRating: event.target.value })}
                placeholder="Maturity"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <select
                value={editingVideo.categoryId}
                onChange={(event) => setEditingVideo({ ...editingVideo, categoryId: event.target.value })}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <input
                value={editingVideo.heroImageUrl || ""}
                onChange={(event) => setEditingVideo({ ...editingVideo, heroImageUrl: event.target.value })}
                placeholder="Hero image URL"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <input
                value={editingVideo.cardImageUrl || ""}
                onChange={(event) => setEditingVideo({ ...editingVideo, cardImageUrl: event.target.value })}
                placeholder="Card image URL"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <input
                value={editingVideo.manifestBlobKey}
                onChange={(event) => setEditingVideo({ ...editingVideo, manifestBlobKey: event.target.value })}
                placeholder="Stream key"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 sm:col-span-2"
              />
              <input
                value={editingVideo.streamAssetId || ""}
                onChange={(event) => setEditingVideo({ ...editingVideo, streamAssetId: event.target.value })}
                placeholder="Stream asset id"
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              />
              <select
                value={editingVideo.publishStatus}
                onChange={(event) => setEditingVideo({ ...editingVideo, publishStatus: event.target.value as "draft" | "published" })}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingVideo(null)} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Cancel</button>
              <button
                onClick={() => {
                  void patchVideo(editingVideo).then((ok) => {
                    if (ok) setEditingVideo(null);
                  });
                }}
                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border border-red-300/25 bg-[#170f16] p-4">
            <h4 className="text-lg font-semibold text-red-100">Confirm Delete</h4>
            <p className="text-sm text-red-100/80">
              Delete {deleteTarget.type} <span className="font-semibold">{deleteTarget.label}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Cancel</button>
              <button
                onClick={() => {
                  const target = deleteTarget;
                  if (!target) return;
                  const action = target.type === "category"
                    ? deleteCategoryById(target.id)
                    : deleteVideoById(target.id);
                  void action.then((ok) => {
                    if (ok) setDeleteTarget(null);
                  });
                }}
                className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
