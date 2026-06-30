type HomeHeaderProps = {
  nome: string;
  cargo: string;
  passaporte?: string;
  numeroBau?: string;
};

export default function HomeHeader({
  nome,
  cargo,
  passaporte,
  numeroBau,
}: HomeHeaderProps) {
  return (
    <section className="rounded-3xl border border-red-950 bg-black/75 p-6 shadow-xl shadow-red-950/30">
      <p className="font-black text-red-500">BEM-VINDO(A)</p>

      <h1 className="mt-1 text-4xl font-black text-white">
        {nome}
      </h1>

      <p className="mt-2 text-zinc-400">
        Passaporte: {passaporte || "Não informado"} • Baú:{" "}
        {numeroBau || "Não informado"}
      </p>

      <span className="mt-3 inline-block rounded-full border border-red-800 bg-red-950/60 px-4 py-1 text-sm font-black text-red-300">
        {cargo}
      </span>
    </section>
  );
}