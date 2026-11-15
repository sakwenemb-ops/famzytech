// The real root layout is app/[locale]/layout.tsx; this one only lets
// app/not-found.tsx render for paths outside any locale.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
