export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background text-foreground">
      <main className="flex flex-col items-center gap-2 px-6 py-32 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Called It</h1>
        <p className="max-w-md text-muted-foreground">
          A decision journal that scores your process, not just the outcome.
        </p>
      </main>
    </div>
  );
}
