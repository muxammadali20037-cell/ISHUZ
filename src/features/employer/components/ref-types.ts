/** Client komponentlarga uzatiladigan ma'lumotnoma (serializable) */
export interface RefOption {
  id: string;
  name_uz: string;
  name_ru: string;
}

export interface DistrictOption extends RefOption {
  region_id: string;
}

export interface ReferenceLists {
  regions: RefOption[];
  districts: DistrictOption[];
  categories: RefOption[];
}
