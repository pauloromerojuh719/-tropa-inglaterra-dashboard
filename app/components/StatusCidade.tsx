type StatusCidadeProps = {
  plantaoAberto: boolean;
  onEntrada: () => void;
  onSaida: () => void;
};

export default function StatusCidade({
  plantaoAberto,
  onEntrada,
  onSaida,
}: StatusCidadeProps) {
  return (
    <section className="rounded-3xl border border-red-900 bg-zinc-950 p-5 text-center">
      <p className="text-sm font-black text-zinc-400">
        STATUS NA CIDADE
      </p>

      <p className="mt-3 text-2xl font-black">
        {plantaoAberto ? "🟢 Em plantão" : "⚪ Fora da cidade"}
      </p>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onEntrada}
          disabled={plantaoAberto}
          className="flex-1 rounded-xl bg-green-700 py-3 font-black hover:bg-green-600 disabled:opacity-40"
        >
          Entrada
        </button>

        <button
          onClick={onSaida}
          disabled={!plantaoAberto}
          className="flex-1 rounded-xl bg-red-700 py-3 font-black hover:bg-red-600 disabled:opacity-40"
        >
          Saída
        </button>
      </div>
    </section>
  );
}