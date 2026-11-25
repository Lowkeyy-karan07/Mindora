import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mindora — Personalized Wellbeing Coach',
  description: 'Simple, explained, feedback-aware wellbeing activities tailored to your mood.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-teal-100 selection:text-teal-900">
        {/* Navigation Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg p-1"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-sm shadow-teal-500/20 group-hover:scale-105 transition-transform duration-200 motion-reduce:transform-none">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                  <path d="M12 12 2.1 12a10.1 10.1 0 0 0 9.9 10z" />
                </svg>
              </div>
              <span className="font-semibold text-lg tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors">
                Mindora
              </span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Check In
              </Link>
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 hover:text-slate-900 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-10 flex flex-col">
          {children}
        </main>

        {/* Global Mandatory Footer */}
        <footer className="mt-auto border-t border-slate-200/70 bg-white/60 py-6 text-center text-xs text-slate-500">
          <div className="max-w-3xl mx-auto px-4 space-y-1.5">
            <p className="font-medium text-slate-600">
              Mindora is for everyday wellbeing support. It isn&apos;t a therapist, medical service, or emergency service.
            </p>
            <p className="text-slate-400">
              If you or someone you know is in immediate danger or emotional crisis, please contact your local emergency or crisis line.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
