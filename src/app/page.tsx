// Root page — redirects to health check for API-only backend
import { redirect } from "next/navigation";

export default function Page() {
  return (
    <div>
      <h1>Heal Backend Running ✅</h1>
      <p>API is live</p>
    </div>
  );
}