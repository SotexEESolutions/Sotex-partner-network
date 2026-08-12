import { logSafeError } from "@/lib/safe-error";

export type CreateJobsResult = { jobs: Array<{ id: string; status: string }> } | { error: string };

export async function createDiscoveryJobs(markets: string[], categories: string[], idempotencyKey: string): Promise<CreateJobsResult> {
  try {
    const response = await fetch("/api/discovery/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markets, categories, idempotencyKey }),
    });
    if (!response.ok) {
      logSafeError("createDiscoveryJobs", { code: response.status });
      if (response.status === 429) return { error: "The daily discovery request limit has been reached. Try again tomorrow." };
      if (response.status === 401) return { error: "You must be signed in to start discovery." };
      return { error: "Discovery could not be started. Please try again." };
    }
    const data = await response.json().catch(() => null);
    if (!data || !Array.isArray(data.jobs)) {
      logSafeError("createDiscoveryJobs", { code: "invalid-response" });
      return { error: "Discovery could not be started. Please try again." };
    }
    return { jobs: data.jobs };
  } catch (error) {
    logSafeError("createDiscoveryJobs", error);
    return { error: "Discovery could not be started. Please try again." };
  }
}

export type TickResult = { jobId: string; status: string; staged?: number; duplicates?: number; flagged?: number } | { error: string };

export async function tickDiscoveryJob(jobId: string): Promise<TickResult> {
  try {
    const response = await fetch(`/api/discovery/jobs/${jobId}/tick`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (response.ok || response.status === 409) {
      if (data && typeof data.status === "string") return data as TickResult;
      logSafeError("tickDiscoveryJob", { code: "invalid-response" });
      return { error: "Discovery could not continue. Please try resuming again." };
    }
    logSafeError("tickDiscoveryJob", { code: response.status });
    if (response.status === 429) return { error: "The daily discovery request limit has been reached. Try again tomorrow." };
    if (response.status === 404) return { error: "This job could not be found or is not available to resume." };
    if (response.status === 401) return { error: "You must be signed in to resume discovery." };
    return { error: "Discovery could not continue. Please try resuming again." };
  } catch (error) {
    logSafeError("tickDiscoveryJob", error);
    return { error: "Discovery could not continue. Please try resuming again." };
  }
}
