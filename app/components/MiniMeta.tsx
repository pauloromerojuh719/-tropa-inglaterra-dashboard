type MiniMetaProps = {
  nome: string;
  atual: number;
  meta: number;
};

export default function MiniMeta({
  nome,
  atual,
  meta,
}: MiniMetaProps) {
  const porcentagem = Math.min(
    100,
    Math.floor((atual / meta) * 100)
  );

  return (
    <div className="rounded-2xl border border-red-950 bg-zinc-950 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-black text-zinc-300">
          {nome}
        </p>

        <p className="text-sm font-black text-red-500">
          {porcentagem}%
        </p>
      </div>

      <p className="text-xl font-black text-white">
        {atual} / {meta}
      </p>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-3 rounded-full bg-red-600 transition-all"
          style={{
            width: `${porcentagem}%`,
          }}
        />
      </div>
    </div>
  );
}