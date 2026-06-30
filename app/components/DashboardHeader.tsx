type DashboardHeaderProps = {
  nome: string;
  cargo: string;
  passaporte?: string;
  numeroBau?: string;
};

export default function DashboardHeader({
  nome,
  cargo,
  passaporte,
  numeroBau,
}: DashboardHeaderProps) {
  return (
    <section className="rounded-3xl border border-red-900 bg-gradient-to-r from-zinc-950 to-black p-6 shadow-xl shadow-red-950/20">
      <p className="text-sm font-black uppercase tracking-widest text-red-500">
        Bem-vindo
      </p>

      <h1 className="mt-2 text-4xl font-black text-white">
        {nome}
      </h1>

      <div className="mt-4 flex flex-wrap gap-3">
        <span className="rounded-full border border-red-700 bg-red-950/50 px-4 py-2 text-sm font-bold">
          👤 {cargo}
        </span>

        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm">
          🪪 Passaporte: {passaporte || "Não informado"}
        </span>

        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm">
          📦 Baú: {numeroBau || "Não informado"}
        </span>
      </div>
    </section>
  );
}