import type { Metadata, Viewport } from "next";
import { Source_Sans_3, STIX_Two_Text } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// next/font downloads these at build time and serves them from this site, so
// the browser never contacts Google.
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});
const stix = STIX_Two_Text({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-stix",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "FilBio · Paternity index calculator", template: "%s · FilBio" },
  description:
    "Paternity and maternity index and probability from STR profiles, with the reference population of your choice. Profiles never leave your browser. También en español.",
  applicationName: "FilBio",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a18" },
  ],
};

/**
 * The page may load its own files and nothing else: no third-party scripts, no
 * requests to other origins, no form posts. Genetic profiles typed here have
 * nowhere to go. Development needs eval and a websocket for hot reload, so the
 * policy is applied to production builds only.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

// Runs before first paint so a dark-theme user never sees a white flash.
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("filbio:v1")||"{}"),t=(s.state&&s.state.settings&&s.state.settings.theme)||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${stix.variable}`} suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" && (
          <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
        )}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
