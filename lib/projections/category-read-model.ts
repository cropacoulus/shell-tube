import type { FilmCategory } from "@/lib/contracts/admin";
import { createDefaultProjectionStore } from "@/lib/projection-store";

const CATEGORIES_KEY = "stream:projection:category:all";

export async function listCategoriesFromProjection(): Promise<FilmCategory[]> {
  const projectionStore = createDefaultProjectionStore();
  const categories =
    (await projectionStore.getJson<Record<string, FilmCategory>>(CATEGORIES_KEY)) ?? {};

  return Object.values(categories).sort((left, right) => left.name.localeCompare(right.name));
}

export async function getCategoryFromProjection(categoryId: string): Promise<FilmCategory | null> {
  const projectionStore = createDefaultProjectionStore();
  const categories =
    (await projectionStore.getJson<Record<string, FilmCategory>>(CATEGORIES_KEY)) ?? {};

  return categories[categoryId] ?? null;
}
