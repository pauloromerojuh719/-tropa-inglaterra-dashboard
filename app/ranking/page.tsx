export default function RankingPage() {
  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="mb-8 text-5xl font-black text-red-600">
        🏆 RANKING
      </h1>

      <section className="rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">
          ⏱️ Ranking de Horas na Cidade
        </h2>

        <div className="rounded-xl border border-zinc-800 bg-black p-5">
          <p className="text-xl font-bold">Nenhuma hora registrada ainda.</p>
          <p className="mt-2 text-zinc-400">
            Quando integrarmos com a cidade, o ranking vai aparecer aqui.
          </p>
        </div>
      </section>
    </main>
  );
}