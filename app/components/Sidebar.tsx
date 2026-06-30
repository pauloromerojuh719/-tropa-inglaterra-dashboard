"use client";

import Image from "next/image";
import Menu from "./Menu";

type SidebarProps = {
  podeVerAdmin: boolean;
  onLogout: () => void;
};

export default function Sidebar({
  podeVerAdmin,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="w-full rounded-3xl border border-red-950 bg-zinc-950/90 p-6 shadow-2xl shadow-red-950/30">

      <div className="mb-8 text-center">
        <Image
          src="/logo.png"
          alt="Logo Inglaterra"
          width={110}
          height={110}
          className="mx-auto rounded-full border border-red-800"
        />

        <h2 className="mt-4 text-xl font-black text-red-500">
          TROPA DA INGLATERRA
        </h2>

        <p className="text-xs text-zinc-500">
          Painel de Gestão
        </p>
      </div>

      <nav className="space-y-2">

        <Menu href="/" texto="🏠 Início" ativo />

        <Menu href="/metas" texto="🎯 Metas" />

        <Menu href="/farm" texto="📦 Farm" />

        <Menu href="/ranking" texto="🏆 Ranking" />

        <Menu href="/membros" texto="👥 Membros" />

        {podeVerAdmin && (
          <>
            <Menu href="/controle-farm" texto="🌿 Controle Farm" />

            <Menu href="/compras" texto="🛒 Compras" />

            <Menu href="/vendas" texto="💰 Vendas" />

            <Menu href="/producao" texto="🏭 Produção" />

            <Menu href="/acoes" texto="🎯 Ações" />

            <Menu href="/reembolso" texto="💸 Reembolso" />

            <Menu href="/relatorio" texto="📊 Relatórios" />

            <Menu href="/admin" texto="⚙️ Administração" />
          </>
        )}
      </nav>

      <button
        onClick={onLogout}
        className="mt-8 w-full rounded-2xl bg-red-700 py-3 font-black transition hover:bg-red-600"
      >
        Sair
      </button>
    </aside>
  );
}