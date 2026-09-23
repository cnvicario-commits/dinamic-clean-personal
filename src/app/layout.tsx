import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { createClient } from "@/utils/supabase/server";
import type { Rol } from "@/utils/permisos";

export const metadata: Metadata = {
  title: "Dinamic Clean",
  description: "Gestión de personal de limpieza",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Se resuelve acá (no en NavBar) porque NavBar es un client component: el
  // rol tiene que llegarle ya resuelto por prop, no puede pedirlo él mismo
  // sin un round-trip extra que parpadearía el menú completo antes de filtrar.
  const supabase = await createClient();
  // getSession() lee de la cookie sin ir a la red (mismo criterio que el
  // resto de la app, ver proxy.ts) — acá solo se usa para saber el rol a
  // mostrar en el menú, no para proteger nada (eso ya lo hace proxy.ts).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let rol: Rol | null = null;
  if (session) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", session.user.id)
      .single();
    rol = (perfil?.rol as Rol) ?? null;
  }

  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col md:flex-row">
        <NavBar rol={rol} />
        <main className="flex-1 min-w-0 w-full">{children}</main>
      </body>
    </html>
  );
}
