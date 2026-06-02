import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@core/integrations/supabase/client";
import { percentilSalarial, BANDA_COLORS } from "@testes/utils/scoreCalculation";

type Banda = "Percentil 25°" | "Percentil 50°" | "Percentil 75°";

interface Point {
  nome: string;
  cargo: string;
  salario: number; // eixo X
  score: number; // eixo Y (score_display)
  banda: Banda;
  p25: number;
  p50: number;
  p75: number;
  percentilSal: number; // posição salarial vs mercado (0–120)
}

const GAP_LIMIAR = 15;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export default function SalarioVsScoreChart() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard_salario_vs_score"],
    queryFn: async (): Promise<Point[]> => {
      const { data: scores, error: sErr } = await supabase
        .from("pdi_score_consolidado" as any)
        .select("colaborador_id, score_display, banda, cargo_id, created_at")
        .order("created_at", { ascending: false });
      if (sErr) throw sErr;

      const latest: Record<string, any> = {};
      for (const s of scores as any[]) {
        const k = s.colaborador_id;
        if (!k) continue;
        if (!latest[k] || new Date(s.created_at) > new Date(latest[k].created_at)) latest[k] = s;
      }
      const ids = Object.keys(latest);
      if (ids.length === 0) return [];

      const { data: colabs, error: cErr } = await supabase
        .from("pdi_colaboradores")
        .select("id, nome, salario, cargo_id, cargo_rel:pdi_cargos(nome)" as any)
        .in("id", ids);
      if (cErr) throw cErr;

      const { data: pesquisa, error: pErr } = await supabase
        .from("pdi_salarios_pesquisa" as any)
        .select("cargo_id, ano, p25, p50, p75")
        .not("cargo_id", "is", null)
        .order("ano", { ascending: false });
      if (pErr) throw pErr;

      const refByCargo = (pesquisa as any[]).reduce(
        (acc, p) => {
          if (!acc[p.cargo_id] || (p.ano ?? 0) > (acc[p.cargo_id].ano ?? 0)) {
            acc[p.cargo_id] = p;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      return (colabs as any[])
        .map((c) => {
          const score = latest[c.id];
          const ref = refByCargo[c.cargo_id];
          if (!c.salario || !ref || !ref.p25 || !ref.p50 || !ref.p75) return null;
          const salario = Number(c.salario);
          const refNums = {
            p25: Number(ref.p25),
            p50: Number(ref.p50),
            p75: Number(ref.p75),
          };
          return {
            nome: c.nome ?? "—",
            cargo: c.cargo_rel?.nome ?? "—",
            salario,
            score: score.score_display,
            banda: score.banda as Banda,
            p25: refNums.p25,
            p50: refNums.p50,
            p75: refNums.p75,
            percentilSal: percentilSalarial(salario, refNums),
          } as Point;
        })
        .filter(Boolean) as Point[];
    },
  });

  const pts = data ?? [];
  const acimaMercado = pts
    .filter((p) => p.percentilSal - p.score > GAP_LIMIAR)
    .sort((a, b) => b.percentilSal - b.score - (a.percentilSal - a.score));
  const subvalorizados = pts
    .filter((p) => p.score - p.percentilSal > GAP_LIMIAR)
    .sort((a, b) => b.score - b.percentilSal - (a.score - a.percentilSal));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="font-display text-lg">Salário Pago × Score</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={pts.length === 0}>
              Gerar relatório
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Relatório de remuneração × desempenho</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 text-sm">
              <section>
                <h3 className="mb-2 font-semibold text-red-700">
                  Acima do mercado — candidatos a ajuste
                </h3>
                {acimaMercado.length === 0 ? (
                  <p className="text-muted-foreground">Ninguém significativamente acima da entrega.</p>
                ) : (
                  <ul className="space-y-1">
                    {acimaMercado.map((p) => (
                      <li key={p.nome} className="rounded-md border border-red-200 bg-red-50 px-2 py-1">
                        <span className="font-medium">{p.nome}</span>
                        <span className="text-muted-foreground"> — {p.cargo}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {brl(p.salario)} · percentil salarial {p.percentilSal}° · score {p.score}
                          {p.salario > p.p75 ? " · acima do P75 de mercado" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-emerald-700">
                  Subvalorizados — candidatos a aumento
                </h3>
                {subvalorizados.length === 0 ? (
                  <p className="text-muted-foreground">Ninguém significativamente subvalorizado.</p>
                ) : (
                  <ul className="space-y-1">
                    {subvalorizados.map((p) => (
                      <li
                        key={p.nome}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1"
                      >
                        <span className="font-medium">{p.nome}</span>
                        <span className="text-muted-foreground"> — {p.cargo}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {brl(p.salario)} · percentil salarial {p.percentilSal}° · score {p.score}
                          {p.salario < p.p50 && p.banda === "Percentil 75°"
                            ? " · alto desempenho abaixo da mediana"
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : pts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem dados — é necessário score calculado, salário e pesquisa salarial do mesmo cargo.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="salario"
                name="Salário pago"
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                label={{
                  value: "Salário pago (R$)",
                  position: "insideBottom",
                  offset: -5,
                  fontSize: 12,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <YAxis
                type="number"
                dataKey="score"
                name="Score"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "Score",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 12,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0]?.payload ? (
                    (() => {
                      const p = payload[0].payload as Point;
                      return (
                        <div className="rounded-md border bg-card p-2 text-xs shadow-md">
                          <p>
                            <strong>{p.nome}</strong> — {p.cargo}
                          </p>
                          <p>Salário pago: {brl(p.salario)}</p>
                          <p>P25 mercado: {brl(p.p25)}</p>
                          <p>P50 mercado: {brl(p.p50)}</p>
                          <p>P75 mercado: {brl(p.p75)}</p>
                          <p>Score: {p.score}</p>
                        </div>
                      );
                    })()
                  ) : null
                }
              />
              {/* 3 percentis no eixo Y (bandas de score) */}
              <ReferenceLine y={39} stroke="#f59e0b" strokeDasharray="2 2" />
              <ReferenceLine y={75} stroke="#10b981" strokeDasharray="2 2" />
              <Scatter data={pts}>
                {pts.map((p, i) => (
                  <Cell key={i} fill={BANDA_COLORS[p.banda].hex} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
