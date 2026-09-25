import { ArrowLeft, CircleAlert, Home } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-mark"><CircleAlert size={24} /></div>
      <span className="eyebrow">Route not found / 404</span>
      <h1>This page is<br /><em>out of scope.</em></h1>
      <p>The wallet console only has one working surface. Head back to the overview to continue your assessment.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="app-button app-button-primary" data-testid="link-back-dashboard"><Home size={16} />Back to overview</Link>
        <button className="app-button app-button-quiet" onClick={() => window.history.back()} data-testid="button-go-back"><ArrowLeft size={16} />Go back</button>
      </div>
    </main>
  );
}