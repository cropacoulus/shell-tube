export type FilmCategory = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type FilmVideo = {
  id: string;
  title: string;
  synopsis: string;
  year: number;
  maturityRating: string;
  durationMin: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
  createdAt: string;
};
