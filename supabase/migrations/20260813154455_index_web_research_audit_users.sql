create index candidate_research_runs_requested_by_idx on public.candidate_research_runs(requested_by) where requested_by is not null;
create index candidate_research_findings_reviewed_by_idx on public.candidate_research_findings(reviewed_by) where reviewed_by is not null;
