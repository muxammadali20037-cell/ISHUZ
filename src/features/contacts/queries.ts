import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface IncomingContactRequest {
  id: string;
  name: string;
  person: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/** Menga kelgan, javob kutayotgan telefon so'rovlari */
export async function getIncomingContactRequests(): Promise<IncomingContactRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_contact_requests");
  if (error) {
    console.error("[contacts] requests", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, person: r.person, avatarUrl: r.avatar_url, createdAt: r.created_at }));
}
