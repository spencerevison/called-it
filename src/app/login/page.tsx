import { headers } from "next/headers";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <main className="flex flex-1 items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Sign in to Called It</h1>
        <LoginForm origin={origin} next={next ?? null} />
      </div>
    </main>
  );
}
