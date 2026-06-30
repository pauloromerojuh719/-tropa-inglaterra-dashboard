"use client";

import Image from "next/image";
import Sidebar from "./Sidebar";

type PanelShellProps = {
  children: React.ReactNode;
  podeVerAdmin: boolean;
  onLogout: () => void;
};

export default function PanelShell({
  children,
  podeVerAdmin,
  onLogout,
}: PanelShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#3b0505_0%,#050505_35%,#000_100%)] p-5 text-white">
      <section className="mx-auto max-w-7xl">
        <Image
          src="/banner.png"
          alt="Tropa da Inglaterra"
          width={1400}
          height={700}
          className="mb-5 w-full rounded-3xl border border-red-900 shadow-2xl shadow-red-950/50"
          priority
        />

        <section className="grid gap-5 md:grid-cols-[290px_1fr]">
          <Sidebar podeVerAdmin={podeVerAdmin} onLogout={onLogout} />

          <div className="space-y-5">{children}</div>
        </section>
      </section>
    </main>
  );
}