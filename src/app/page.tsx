import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">Called It</h1>
      <Link href="/decisions" className="text-sm text-accent">
        View decisions
      </Link>
    </main>
  );
}
