import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function DataError() {
  return (
    <div className="data-error-shell">
      <div className="data-error-card">
        <div className="icon">
          <AlertTriangle size={22} />
        </div>
        <h1>Couldn&apos;t load your data</h1>
        <p>We couldn&apos;t load Partner Network data. Please try again.</p>
        <Link href="/" className="primary">
          Try again
        </Link>
      </div>
    </div>
  );
}
