import Link from "next/link";
import "./globals.css";

export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <body className="grid min-h-dvh place-items-center p-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Page introuvable · Page not found</h1>
          <p className="mt-4"><Link className="text-primary underline" href="/fr">Accueil</Link> · <Link className="text-primary underline" href="/en">Home</Link></p>
        </div>
      </body>
    </html>
  );
}
