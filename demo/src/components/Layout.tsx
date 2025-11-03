import type { ReactNode } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">{children}</main>
      <footer className="footer-note">
        Need a refresher? Read the quickstart in <code>learning/quickstart/quickstart.md</code> or the
        full plan in <code>docs/DEMO_APP_PLAN.md</code>.
      </footer>
    </div>
  );
}

export default Layout;

