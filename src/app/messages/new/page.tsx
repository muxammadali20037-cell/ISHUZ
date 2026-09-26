import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import { newConversationSchema } from "@/features/chat/schema";

/**
 * /messages/new?application_id=… | ?offer_id=… → get_or_create_conversation → /messages/[id]
 * Xatoda /messages?error=<code> (toast).
 */
export default async function NewConversationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSession("/messages");
  const sp = await searchParams;
  const parsed = newConversationSchema.safeParse({
    application_id: typeof sp.application_id === "string" ? sp.application_id : undefined,
    offer_id: typeof sp.offer_id === "string" ? sp.offer_id : undefined,
  });
  if (!parsed.success) redirect("/messages?error=one_source_required");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_application_id: parsed.data.application_id,
    p_job_offer_id: parsed.data.offer_id,
  });
  if (error || !data) redirect(`/messages?error=${encodeURIComponent(error ? errorCode(error) : "not_found")}`);
  redirect(`/messages/${data}`);
}
