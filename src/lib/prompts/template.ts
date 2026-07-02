// Minimal mustache-lite renderer: {{key}} substitution + {{#key}}...{{/key}} sections
// (array = loop, truthy scalar = inline-if). That's all prompts/*.md actually uses.
type Context = Record<string, unknown>

export function renderTemplate(template: string, context: Context): string {
  const sectionRe = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g

  const withSections = template.replace(sectionRe, (_match, key: string, inner: string) => {
    const value = context[key]
    if (Array.isArray(value)) {
      return value
        .map((item) => renderTemplate(inner, { ...context, ...(item as Context) }))
        .join("")
    }
    return value ? renderTemplate(inner, context) : ""
  })

  return withSections.replace(/{{(\w+)}}/g, (_match, key: string) => {
    const value = context[key]
    return value === undefined || value === null ? "" : String(value)
  })
}
