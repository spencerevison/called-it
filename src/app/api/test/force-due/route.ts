import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// e2e-only test hook (T36): skips the real wait.until/cron wake by forcing a
// pending checkin straight to due. Inert unless E2E_TEST_MODE is set, which
// only happens in playwright.config.ts's webServer env -- never in prod.
export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const checkinId = body?.checkinId;
  if (typeof checkinId !== "string") {
    return NextResponse.json({ error: "checkinId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const service = createServiceClient();
  const { data: checkin } = await service
    .from("checkins")
    .select("id, user_id")
    .eq("id", checkinId)
    .single();

  if (!checkin || checkin.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await service.from("checkins").update({ status: "due" }).eq("id", checkinId).eq("status", "pending");
  return NextResponse.json({ ok: true });
}
