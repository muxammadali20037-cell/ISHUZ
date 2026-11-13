/** /jobs/[slug]?korinish=izlovchi — e'lon egasi o'z e'lonini ish izlovchi ko'zi bilan ko'radi (boshqalar uchun oddiy sahifa) */
export const SEEKER_PREVIEW_PARAM = "korinish";
export const SEEKER_PREVIEW_VALUE = "izlovchi";

export const seekerPreviewHref = (slug: string) => `/jobs/${slug}?${SEEKER_PREVIEW_PARAM}=${SEEKER_PREVIEW_VALUE}`;
