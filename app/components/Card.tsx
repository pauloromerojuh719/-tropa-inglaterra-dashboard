type CardProps = {
  titulo: string;
  valor: string;
  desc: string;
  destaque?: boolean;
};

export default function Card({
  titulo,
  valor,
  desc,
  destaque = false,
}: CardProps) {
  return (
    <div
      className={`rounded-3xl border p-5 text-center ${
        destaque
          ? "border-red-900 bg-black/80 shadow-lg shadow-red-950/30"
          : "border-red-950 bg-black/70"
      }`}
    >
      <p className="text-sm font-bold text-zinc-400">{titulo}</p>
      <h3 className="mt-2 text-3xl font-black text-white">{valor}</h3>
      <p className="mt-2 text-xs font-bold text-zinc-500">{desc}</p>
    </div>
  );
}