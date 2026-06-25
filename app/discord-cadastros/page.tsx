"use client";

import { useEffect, useState } from "react";

type Pendente = {
  discordId: string;
  nomeDiscord: string;
  username: string;
};

type Resultado = {
  sucesso: boolean;
  totalDiscord: number;
  totalCadastrados: number;
  totalPendentes: number;
  pendentes: Pendente[];
};

export default function DiscordCadastrosPage() {
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    sincronizar();
  }, []);

  async function sincronizar() {
    setCarregando(true);

    const resposta = await fetch("/api/discord/sync");
    const dados = await resposta.json();

    setResultado(dados);
    setCarregando(false);
  }

  function copiarPendentes() {
    if (!resultado) return;

    const texto =
      `🚨 PENDENTES DE CADASTRO\n\n` +
      `Os membros abaixo ainda não fizeram o cadastro no painel:\n\n` +
      resultado.pendentes.map((m) => `• ${m.nomeDiscord}`).join("\n") +
      `\n\nAcesse o site e faça o cadastro o quanto antes.`;

    navigator.clipboard.writeText(texto);
    alert("Lista copiada!");
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">👥 Cadastros Discord</h1>
          <p className="text-zinc-400">
            Veja quem está no Discord mas ainda não fez cadastro no painel.
          </p>
        </div>

        <button
          onClick={sincronizar}
          disabled={carregando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-3 rounded-xl font-bold"
        >
          {carregando ? "Sincronizando..." : "🔄 Sincronizar Discord"}
        </button>

        {resultado && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-zinc-400">Discord</p>
                <p className="text-3xl font-bold">{resultado.totalDiscord}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-zinc-400">Cadastrados</p>
                <p className="text-3xl font-bold text-green-400">
                  {resultado.totalCadastrados}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-zinc-400">Pendentes</p>
                <p className="text-3xl font-bold text-red-400">
                  {resultado.totalPendentes}
                </p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">❌ Pendentes de cadastro</h2>

                <button
                  onClick={copiarPendentes}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-bold"
                >
                  📋 Copiar lista
                </button>
              </div>

              {resultado.pendentes.length === 0 ? (
                <p className="text-green-400 font-bold">
                  Todos já fizeram cadastro.
                </p>
              ) : (
                <div className="space-y-3">
                  {resultado.pendentes.map((membro) => (
                    <div
                      key={membro.discordId}
                      className="bg-black border border-zinc-800 rounded-lg p-4"
                    >
                      <p className="font-bold">{membro.nomeDiscord}</p>
                      <p className="text-zinc-400 text-sm">
                        @{membro.username}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        ID: {membro.discordId}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}