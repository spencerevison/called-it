// T41 fix — lets plain `node` resolve the `@/` tsconfig alias and extensionless
// relative .ts imports that eval-judge.mjs's src/ import chain relies on.
// Node's type-stripping handles the syntax; this hook only fixes resolution.
import { register } from "node:module";
import path from "node:path";

register(import.meta.url, import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const rewritten = specifier.startsWith("@/")
    ? new URL(`../src/${specifier.slice(2)}`, import.meta.url).href
    : specifier;

  try {
    return await nextResolve(rewritten, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && !path.extname(rewritten)) {
      return await nextResolve(`${rewritten}.ts`, context);
    }
    throw err;
  }
}
