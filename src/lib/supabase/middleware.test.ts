import { describe, expect, it } from "vitest"
import { isPublicPath } from "./middleware"

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true)
  })

  it("treats /auth/confirm as public", () => {
    expect(isPublicPath("/auth/confirm")).toBe(true)
  })

  it("treats the app root as protected", () => {
    expect(isPublicPath("/")).toBe(false)
  })

  it("treats other app routes as protected", () => {
    expect(isPublicPath("/decisions")).toBe(false)
  })

  it("does not treat /login-ish paths as public via prefix match", () => {
    expect(isPublicPath("/loginer")).toBe(false)
  })
})
