// Minimal root layout — this is a pure API backend, no UI pages
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

export const metadata = {
  title: "Heal Backend API",
  description: "Blockchain prescription fraud prevention backend",
};
