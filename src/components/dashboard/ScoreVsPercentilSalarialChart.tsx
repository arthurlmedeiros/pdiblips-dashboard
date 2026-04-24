import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@core/integrations/supabase/client";
import { percentilSalarial } from "@testes/utils/scoreCalculation";

interface Point {
  x: number;
  y: number;
  cargo: string;
}

export default function ScoreVsPercentilSalarialChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard_score_vs_percentil_salarial"],
    queryFn: async (): Promise<Point[]> => {
      const { data: scores, error: sErr } = await supabase
        .from("pdi_score_consolidado" as any)
        .select("colaborador_id, score_display, cargo_id, created_at")
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
        .select("id, salario, cargo_id, cargo_rel:pdi_cargos(nome)" as any)
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
          return {
            x: score.score_display,
            y: percentilSalarial(Number(c.salario), {
              p25: Number(ref.p25),
              p50: Number(ref.p50),
              p75: Number(ref.p75),
            }),
            cargo: c.cargo_rel?.nome ?? "—",
          } as Point;
        })
        .filter(Boolean) as Point[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Score × Percentil Salarial</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem dados — é necessário score calculado, salário e pesquisa salarial do mesmo cargo.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Score"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  label={{
                    value: "Score (display)",
                    position: "insideBottom",
                    offset: -5,
                    fontSize: 12,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Percentil Salarial"
                  domain={[0, 120]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  label={{
                    value: "Percentil salarial",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0]?.payload ? (
                      <div className="rounded-md border bg-card p-2 text-xs shadow-md">
                        <p>
                          <strong>{(payload[0].payload as Point).cargo}</strong>
                        </p>
                        <p>Score: {(payload[0].payload as Point).x}</p>
                        <p>Percentil salarial: {(payload[0].payload as Point).y}</p>
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                  ]}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                />
                <ReferenceLine x={39} stroke="#f59e0b" strokeDasharray="2 2" />
                <ReferenceLine x={75} stroke="#10b981" strokeDasharray="2 2" />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="2 2" />
                <ReferenceLine y={75} stroke="#10b981" strokeDasharray="2 2" />
                <Scatter data={data} fill="hsl(var(--primary))" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Pontos próximos da diagonal indicam alinhamento score × compensação. Acima da diagonal: bem pagos em relação ao score. Abaixo: potencial sub-pago.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
