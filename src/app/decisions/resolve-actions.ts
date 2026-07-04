"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ResolveResult = { ok: true } | { ok: false; errors: string[] };

// T35: terminal transition, callable from the decision page or any check-in
// page -- the RPC does the row-lock + multi-table write (see migration).
export async function resolveDecision(
  decisionId: string,
  status: "resolved" | "abandoned",
): Promise<ResolveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const { error } = await service.rpc("resolve_decision", {
    p_decision_id: decisionId,
    p_user_id: user.id,
    p_status: status,
  });

  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}
