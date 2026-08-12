import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Beyond ESLint — Rule availability",
  description:
    "A daily history of rule availability across Biome, Oxlint, RSLint, TTSC, and tracked ESLint plugins.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
