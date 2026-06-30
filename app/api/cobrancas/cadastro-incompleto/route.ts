import { NextResponse } from "next/server";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

function dataFirebase(data: any) {
  if (!data) return null;
  if (data.toDate) return data.toDate();
  return new Date(data);
}

export async function GET() {
  try {
    const inicio = new Date("2026-06-22T00:00:00-03:00");
    const fim = new Date("2026-06-28T23:59:59-03:00");

    const membrosSnap = await getDocs(collection(db, "membros"));
    const farmSnap = await getDocs(collection(db, "farm"));

    const membros = membrosSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }))
      .filter((m: any) => {
        const cargo = String(m.cargo || "").trim();
        return (
          m.status === "aprovado" &&
          cargo !== "Elite" &&
          cargo !== "Gerente de Ações"
        );
      });

    const resumo = new Map();

    membros.forEach((m: any) => {
      resumo.set(m.id, {
        nome: m.nomeRP || m.nome || m.nomeDiscord || "Sem nome",
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
      });
    });

    farmSnap.docs.forEach((doc) => {
      const f = doc.data() as any;

      if (f.status !== "aprovado") return;

      const data = dataFirebase(f.criadoEm);
      if (!data) return;

      if (data < inicio || data > fim) return;

      const membroId = f.membroId || f.discordId || f.usuarioId;
      const item = resumo.get(membroId);

      if (!item) return;

      item.folhas += Number(f.folhas || 0);
      item.opios += Number(f.opios || 0);
      item.seringas += Number(f.seringas || 0);
      item.agulhas += Number(f.agulhas || 0);
    });

    const lista = Array.from(resumo.values()).map((m: any) => {
      const bateu =
        m.folhas >= META_FOLHAS &&
        m.opios >= META_OPIOS &&
        m.seringas >= META_SERINGAS &&
        m.agulhas >= META_AGULHAS;

      return {
        ...m,
        bateu,
      };
    });

    const bateram = lista.filter((m) => m.bateu);
    const naoBateram = lista.filter((m) => !m.bateu);

    return NextResponse.json({
      status: "OK",
      semana: "22/06/2026 até 28/06/2026",
      totalMembros: lista.length,
      bateramTotal: bateram.length,
      naoBateramTotal: naoBateram.length,
      bateram,
      naoBateram,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        status: "ERRO",
        erro: String(erro),
      },
      { status: 500 }
    );
  }
}