/** Kasblar daraxti tuguni (UI uchun) */
export interface ProfessionNode {
  id: string;
  parent_id: string | null;
  category_id: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
  icon: string | null;
  selectable: boolean;
  is_popular: boolean;
  has_children: boolean;
}

/** Yo'l elementi (breadcrumb) */
export interface TrailItem {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
}

/** Qidiruv natijasi: tugun + ildizdan unga qadar yo'l */
export interface ProfessionSearchHit extends Omit<ProfessionNode, "is_popular"> {
  trail: TrailItem[];
}

/** Tanlangan kasb (formalar uchun) */
export interface PickedProfession {
  id: string;
  categoryId: string;
  /** ildizdan tanlangan tugungacha (tanlangan tugun ham) */
  trail: TrailItem[];
}
