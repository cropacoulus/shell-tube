import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

import type { FilmCategory, FilmVideo } from "@/lib/contracts/admin";
import type { UserProfile } from "@/lib/contracts/profile";

type DataState = {
  profiles: Record<string, UserProfile>;
  categories: FilmCategory[];
  videos: FilmVideo[];
};

const DATA_FILE = `${process.cwd()}/data/app-data.json`;

const initialState: DataState = {
  profiles: {},
  categories: [],
  videos: [],
};

async function ensureDataFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(initialState, null, 2), "utf8");
  }
}

async function loadState(): Promise<DataState> {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as DataState;
    return {
      profiles: parsed.profiles ?? {},
      categories: parsed.categories ?? [],
      videos: parsed.videos ?? [],
    };
  } catch {
    return initialState;
  }
}

async function saveState(state: DataState) {
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const state = await loadState();
  return state.profiles[userId] ?? null;
}

export async function upsertProfile(profile: UserProfile): Promise<UserProfile> {
  const state = await loadState();
  state.profiles[profile.userId] = profile;
  await saveState(state);
  return profile;
}

export async function listCategories(): Promise<FilmCategory[]> {
  const state = await loadState();
  return state.categories;
}

export async function addCategory(input: Omit<FilmCategory, "id" | "createdAt">): Promise<FilmCategory> {
  const state = await loadState();
  const category: FilmCategory = {
    id: `cat_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.categories.push(category);
  await saveState(state);
  return category;
}

export async function listVideos(): Promise<FilmVideo[]> {
  const state = await loadState();
  return state.videos;
}

export async function addVideo(input: Omit<FilmVideo, "id" | "createdAt">): Promise<FilmVideo> {
  const state = await loadState();
  const video: FilmVideo = {
    id: `vid_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.videos.push(video);
  await saveState(state);
  return video;
}
