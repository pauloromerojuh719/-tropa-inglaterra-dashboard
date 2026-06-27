import { NextResponse } from "next/server";
import { Client, GatewayIntentBits } from "discord.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

function descobrirCargo(cargos: string[]) {
  const cargosLimpos = cargos.map((cargo) =>
    cargo.replace(/[^\p{L}\p{N}\s-]/gu, "").trim()
  );

  const prioridade = [
    { discord: "Líder", site: "Líder" },
    { discord: "Vice-Líder", site: "Vice-Líder" },
    { discord: "Gerente Geral", site: "Gerente Geral" },
    { discord: "Gerente de Farm", site: "Gerente de Farm" },
    { discord: "Gerente de Produção", site: "Gerente de Produção" },
    { discord: "Gerente de Compras", site: "Gerente de Compras" },
    { discord: "Gerente de Vendas", site: "Gerente de Vendas" },
    { discord: "Gerente de Ação", site: "Gerente de Ações" },
    { discord: "Gerente de Ações", site: "Gerente de Ações" },
    { discord: "Admin Farm", site: "Admin Farm" },
    { discord: "Elite Alfa", site: "Elite" },
    { discord: "Elite", site: "Elite" },
    { discord: "Membro", site: "Membro" },
  ];

  for (const cargo of prioridade) {
    if (cargosLimpos.includes(cargo.discord)) {
      return cargo.site;
    }
  }

  return "Membro";
}