"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type Stakes = Database["public"]["Enums"]["stakes_level"];
type Reversibility = Database["public"]["Enums"]["reversibility"];

const STAKES: Stakes[] = ["low", "medium", "high"];
const REVERSIBILITY: Reversibility[] = ["one_way", "two_way"];

export type DecisionFormResult = { ok: true; id: string } | { ok: false; errors: string[] };

type ParsedFields = {
  title: string;
  context: string;
  rationale: string | null;
  options: string[];
  chosenOption: string | null;
  stakes: Stakes;
  reversibility: Reversibility;
};

function parseFields(formData: FormData): { fields: ParsedFields | null; errors: string[] } {
  const errors: string[] = [];

  const title = String(formData.get("title") ?? "").trim();
  if (!title) errors.push("Title is required.");

  const context = String(formData.get("context") ?? "").trim();
  if (!context) errors.push("Context is required.");

  const rationaleRaw = String(formData.get("rationale") ?? "").trim();
  const rationale = rationaleRaw ? rationaleRaw : null;

  const options = formData
    .getAll("options")
    .map((o) => String(o).trim())
    .filter((o) => o.length > 0);
  if (options.length < 1) errors.push("At least one option is required.");

  const chosenOptionRaw = String(formData.get("chosen_option") ?? "").trim();
  const chosenOption = chosenOptionRaw ? chosenOptionRaw : null;
  if (chosenOption && !options.includes(chosenOption)) {
    errors.push("Chosen option must be one of the listed options.");
  }

  const stakesRaw = String(formData.get("stakes") ?? "medium");
  const stakes = STAKES.includes(stakesRaw as Stakes) ? (stakesRaw as Stakes) : null;
  if (!stakes) errors.push("Stakes must be low, medium, or high.");

  const reversibilityRaw = String(formData.get("reversibility") ?? "two_way");
  const reversibility = REVERSIBILITY.includes(reversibilityRaw as Reversibility)
    ? (reversibilityRaw as Reversibility)
    : null;
  if (!reversibility) errors.push("Reversibility must be one-way or two-way.");

  if (errors.length > 0 || !stakes || !reversibility) {
    return { fields: null, errors };
  }

  return {
    fields: { title, context, rationale, options, chosenOption, stakes, reversibility },
    errors: [],
  };
}

export async function createDecision(formData: FormData): Promise<DecisionFormResult> {
  const { fields, errors } = parseFields(formData);
  if (!fields) return { ok: false, errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const { data, error } = await service
    .from("decisions")
    .insert({
      user_id: user.id,
      title: fields.title,
      context: fields.context,
      rationale: fields.rationale,
      options_considered: fields.options,
      chosen_option: fields.chosenOption,
      stakes: fields.stakes,
      reversibility: fields.reversibility,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, errors: [error?.message ?? "Failed to save decision."] };
  }
  return { ok: true, id: data.id };
}

export async function updateDecision(id: string, formData: FormData): Promise<DecisionFormResult> {
  const { fields, errors } = parseFields(formData);
  if (!fields) return { ok: false, errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  // fetch via service role so a not-found and a not-owned draft look identical to the caller
  const { data: existing, error: fetchError } = await service
    .from("decisions")
    .select("user_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !existing || existing.user_id !== user.id) {
    return { ok: false, errors: ["Decision not found."] };
  }
  if (existing.status !== "draft") {
    return { ok: false, errors: ["Only draft decisions can be edited."] };
  }

  const { error } = await service
    .from("decisions")
    .update({
      title: fields.title,
      context: fields.context,
      rationale: fields.rationale,
      options_considered: fields.options,
      chosen_option: fields.chosenOption,
      stakes: fields.stakes,
      reversibility: fields.reversibility,
    })
    .eq("id", id);

  if (error) return { ok: false, errors: [error.message] };
  return { ok: true, id };
}
