export function logSafeError(operation: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "unknown";
  console.error(`[Partner Network] ${operation} failed (code: ${code})`);
}
