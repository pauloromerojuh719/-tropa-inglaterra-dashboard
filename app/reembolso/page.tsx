"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  cargo: string;
  status: string;
};

type Reembolso = {
  id: string;
  passaporte: string;
  nome: string;
  item: string;
  quantidade: number;
  valor: number;
  foto?: string;
  solicitadoPor: string;
  status: "pendente" | "pago";
  criadoEm: any;
  pagoEm?: any;
};

export default function ReembolsoPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [podePagar, setPodePagar] = useState(false);
  const [membroLogado, setMembroLogado] = useState<Membro | null>(null);

  const [passaporte, setPassaporte] = useState("");
  const [nome, setNome] = useState("");
  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [foto, setFoto] = useState("");

  const [reembolsos, setReembolsos] = useState<Reembolso[]>([]);

  function nomeExibicao() {
    return (
      membroLogado?.nomeRP ||
      membroLogado?.nomeDiscord ||
      membroLogado?.nome ||
      session?.user?.name ||
      "Sem nome"
    );
  }

  function formatarDinheiro(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: any) {
    if (!data?.toDate) return "Sem data";
    return data.toDate().toLocaleString("pt-BR");
  }

  function converterFoto(arquivo: File) {
    const reader = new FileReader();

    reader.onloadend = () => {
      setFoto(reader.result as string);
    };

    reader.readAsDataURL(arquivo);
  }

  async function enviarLogReembolso(tipo: string, dados: {
    passaporte: string;
    nome: string;
    item: string;
    quantidade: number;
    valor: number;
    responsavel: string;
  }) {
    try {
      await fetch("/api/discord/log-reembolsos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo,
          ...dados,
        }),
      });
    } catch (error) {
      console.error("Erro ao enviar log de reembolso:", error);
    }
  }

  async function carregarReembolsos() {
    const snapshot = await getDocs(collection(db, "reembolsos"));

    const lista = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<Reembolso, "id">),
    })) as Reembolso[];

    lista.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
      return dataB - dataA;
    });

    setReembolsos(lista);
  }

  async function solicitarReembolso() {
    if (!session?.user) return;

    if (!passaporte || !nome || !item || !quantidade || !valor || !foto) {
      alert("Preencha todos os campos e envie a foto do produto produzido.");
      return;
    }

    const dadosLog = {
      passaporte,
      nome,
      item,
      quantidade: Number(quantidade),
      valor: Number(valor),
      responsavel: nomeExibicao(),
    };

    await addDoc(collection(db, "reembolsos"), {
      passaporte,
      nome,
      item,
      quantidade: Number(quantidade),
      valor: Number(valor),
      foto,
      solicitadoPor: nomeExibicao(),
      status: "pendente",
      criadoEm: Timestamp.now(),
    });

    await enviarLogReembolso("solicitado", dadosLog);

    setPassaporte("");
    setNome("");
    setItem("");
    setQuantidade("");
    setValor("");
    setFoto("");

    await carregarReembolsos();

    alert("Reembolso solicitado!");
  }

  async function marcarComoPago(reembolso: Reembolso) {
    await updateDoc(doc(db, "reembolsos", reembolso.id), {
      status: "pago",
      pagoEm: Timestamp.now(),
    });

    await enviarLogReembolso("pago", {
      passaporte: reembolso.passaporte,
      nome: reembolso.nome,
      item: reembolso.item,
      quantidade: reembolso.quantidade,
      valor: reembolso.valor,
      responsavel: nomeExibicao(),
    });

    await carregarReembolsos();

    alert("Reembolso marcado como pago!");
  }

  useEffect(() => {
    async function verificarPermissao() {
      if (!session?.user) {
        setCarregando(false);
        return;
      }

      const discordId = (session.user as any).id;

      if (!discordId) {
        setCarregando(false);
        return;
      }

      const membroSnap = await getDoc(doc(db, "membros", discordId));

      if (!membroSnap.exists()) {
        setTemPermissao(false);
        setCarregando(false);
        return;
      }

      const membro = membroSnap.data() as Membro;
      setMembroLogado(membro);

      const cargo = membro.cargo?.trim() || "";
      const status = membro.status?.trim() || "";

      const cargosLiberados =
        cargo === "Líder" ||
        cargo === "Vice-Líder" ||
        cargo.includes("Gerente");

      const cargosQuePodemPagar =
        cargo === "Líder" ||
        cargo === "Vice-Líder" ||
        cargo.includes("Gerente");

      if (status === "aprovado" && cargosLiberados) {
        setTemPermissao(true);
        setPodePagar(cargosQuePodemPagar);
        await carregarReembolsos();
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);

  const reembolsosPendentes = reembolsos.filter(
    (r) => r.status === "pendente"
  );

  const reembolsosPagos = reembolsos.filter((r) => r.status === "pago");

  const totalPendente = reembolsosPendentes.reduce(
    (total, r) => total + r.valor,
    0
  );

  const totalPago = reembolsosPagos.reduce((total, r) => total + r.valor, 0);

  if (carregando) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Carregando...
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        <button
          onClick={() => signIn("discord")}
          className="rounded bg-red-700 px-6 py-3 font-bold"
        >
          Entrar com Discord
        </button>
      </main>
    );
  }

  if (!temPermissao) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        ❌ Sem permissão
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">💸 REEMBOLSO</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Total pendente</p>
          <h2 className="text-3xl font-black text-yellow-400">
            {formatarDinheiro(totalPendente)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Total pago</p>
          <h2 className="text-3xl font-black text-green-400">
            {formatarDinheiro(totalPago)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Solicitações</p>
          <h2 className="text-3xl font-black">{reembolsos.length}</h2>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Solicitar Reembolso</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={passaporte}
            onChange={(e) => setPassaporte(e.target.value)}
            placeholder="Passaporte"
            className="rounded bg-black p-4"
          />

          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            className="rounded bg-black p-4"
          />

          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Item Produzido"
            className="rounded bg-black p-4"
          />

          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Quantidade"
            type="number"
            className="rounded bg-black p-4"
          />

          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor Pago"
            type="number"
            className="rounded bg-black p-4"
          />

          <input
            type="file"
            accept="image/*"
            className="rounded bg-black p-4"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) converterFoto(arquivo);
            }}
          />
        </div>

        {foto && (
          <div className="mt-5 w-full max-w-xl rounded border border-zinc-700 bg-black p-2">
            <p className="mb-2 text-sm text-zinc-400">Preview da foto:</p>

            <img
              src={foto}
              alt="Preview do reembolso"
              className="max-h-80 w-full rounded object-contain"
            />
          </div>
        )}

        <button
          onClick={solicitarReembolso}
          className="mt-6 rounded bg-red-700 px-6 py-3 font-bold"
        >
          Solicitar Reembolso
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-yellow-700 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold text-yellow-400">
          ⏳ Reembolsos Pendentes
        </h2>

        <div className="grid gap-4">
          {reembolsosPendentes.length === 0 && (
            <p className="text-zinc-400">Nenhum reembolso pendente.</p>
          )}

          {reembolsosPendentes.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <h3 className="text-xl font-bold">
                {r.nome} - Passaporte {r.passaporte}
              </h3>

              <p>Item: {r.item}</p>
              <p>Quantidade: {r.quantidade}</p>
              <p>Valor: {formatarDinheiro(r.valor)}</p>
              <p>Solicitado por: {r.solicitadoPor}</p>
              <p>Data: {formatarData(r.criadoEm)}</p>
              <p className="mt-2 font-bold text-yellow-400">Status: Pendente</p>

              {r.foto && (
                <img
                  src={r.foto}
                  alt="Produto"
                  className="mt-3 h-40 rounded-lg border border-zinc-700"
                />
              )}

              {podePagar && (
                <button
                  onClick={() => marcarComoPago(r)}
                  className="mt-4 rounded bg-green-700 px-4 py-2 font-bold"
                >
                  Marcar como Pago
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-green-700 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold text-green-400">
          ✅ Histórico de Pagos
        </h2>

        <div className="grid gap-4">
          {reembolsosPagos.length === 0 && (
            <p className="text-zinc-400">Nenhum reembolso pago ainda.</p>
          )}

          {reembolsosPagos.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <h3 className="text-xl font-bold">
                {r.nome} - Passaporte {r.passaporte}
              </h3>

              <p>Item: {r.item}</p>
              <p>Quantidade: {r.quantidade}</p>
              <p>Valor: {formatarDinheiro(r.valor)}</p>
              <p>Solicitado por: {r.solicitadoPor}</p>
              <p>Solicitado em: {formatarData(r.criadoEm)}</p>
              <p>Pago em: {formatarData(r.pagoEm)}</p>
              <p className="mt-2 font-bold text-green-400">Status: Pago</p>

              {r.foto && (
                <img
                  src={r.foto}
                  alt="Produto"
                  className="mt-3 h-40 rounded-lg border border-zinc-700"
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}