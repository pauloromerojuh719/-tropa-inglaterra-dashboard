import Link from "next/link";

type MenuProps = {
  href: string;
  texto: string;
  ativo?: boolean;
};

export default function Menu({ href, texto, ativo = false }: MenuProps) {
  return (
    <Link
      href={href}
      className={`flex items-center rounded-2xl px-4 py-3 text-sm font-black transition ${
        ativo
          ? "bg-red-700 text-white shadow-lg shadow-red-950/50"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {texto}
    </Link>
  );
}