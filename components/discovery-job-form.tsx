"use client";
import { useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { DISCOVERY_CATEGORIES, DISCOVERY_MARKETS } from "@/lib/discovery/markets";
import { createDiscoveryJobs } from "@/lib/discovery/api";

type Props = { creating: boolean; onCreating: (creating: boolean) => void; onCreated: (jobs: Array<{ id: string; status: string }>) => void };

export function DiscoveryJobForm({ creating, onCreating, onCreated }: Props) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");

  const toggleMarket = (key: string) => setMarkets(m => m.includes(key) ? m.filter(x => x !== key) : [...m, key]);
  const toggleCategory = (category: string) => setCategories(c => c.includes(category) ? c.filter(x => x !== category) : [...c, category]);
  const plannedRequests = markets.length * categories.length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setError("");
    if (markets.length === 0 || categories.length === 0) {
      setError("Select at least one market and one search category.");
      return;
    }
    onCreating(true);
    const idempotencyKey = crypto.randomUUID();
    const result = await createDiscoveryJobs(markets, categories, idempotencyKey);
    if ("error" in result) {
      setError(result.error);
      onCreating(false);
      return;
    }
    onCreated(result.jobs);
    setMarkets([]);
    setCategories([]);
    onCreating(false);
  };

  return (
    <form onSubmit={handleSubmit} className="panel discovery-job-form">
      <div className="panel-head"><div><h2>New discovery job</h2><p>Stages candidates in the review queue — nothing is added to Firms directly.</p></div></div>
      <div className="discovery-job-form-body">
        <div>
          <span className="discovery-job-form-label">Markets</span>
          <div className="check-grid">
            {DISCOVERY_MARKETS.map(market => (
              <label key={market.key}>
                <input type="checkbox" checked={markets.includes(market.key)} onChange={() => toggleMarket(market.key)} />
                {market.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="discovery-job-form-label">Search categories</span>
          <div className="check-grid">
            {DISCOVERY_CATEGORIES.map(category => (
              <label key={category}>
                <input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} />
                {category}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="discovery-job-form-footer">
        <span className="discovery-job-form-estimate">{plannedRequests > 0 ? `~${plannedRequests} first-page request${plannedRequests === 1 ? "" : "s"} planned` : "Select markets and categories to see planned requests"}</span>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="primary" disabled={creating || markets.length === 0 || categories.length === 0}>
          <Play size={16} />{creating ? "Starting…" : "Start discovery"}
        </button>
      </div>
    </form>
  );
}
