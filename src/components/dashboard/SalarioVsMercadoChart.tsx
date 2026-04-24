import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@core/integrations/supabase/client";

interface Row {
  cargo: string;
  empresa: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  headcount: number;
}

export default function SalarioVsMercadoChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard_salario_vs_mercado"],
    queryFn: async (): Promise<Row[]> => {
      // 1. Colaboradores com cargo_id + salário
      const { data: colabs, error: cErr } = await supabase
        .from("pdi_colaboradores")
        .select("cargo_id, salario, cargo_rel:pdi_cargos(id, nome)" as any)
        .eq("ativo", true)
        .not("cargo_id", "is", null);
      if (cErr) throw cErr;

      // 2. Última pesquisa por cargo
      const { data: pesquisa, error: pErr } = await supabase
        .from("pdi_salarios_pesquisa" as any)
        .select("cargo_id, ano, p25, p50, p75")
        .not("cargo_id", "is", null)
        .order("ano", { ascending: false });
      if (pErr) throw pErr;

      const latestByCargo = (pesquisa as any[]).reduce(
        (acc, p) => {
          if (!acc[p.cargo_id] || (p.ano ?? 0) > (acc[p.cargo_id].ano ?? 0)) {
            acc[p.cargo_id] = p;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      const agg: Record<string, { cargo: string; salarios: number[]; headcount: number }> = {};
      for (const c of colabs as any[]) {
        if (!c.cargo_id) continue;
        const nome = c.cargo_rel?.nome ?? "Sem cargo";
        if (!agg[c.cargo_id]) agg[c.cargo_id] = { cargo: nome, salarios: [], headcount: 0 };
        agg[c.cargo_id].headcount += 1;
        if (c.salario) agg[c.cargo_id].salarios.push(Number(c.salario));
      }

      return Object.entries(agg)
        .map(([id, a]): Row => {
          const empresa =
            a.salarios.length > 0
              ? Math.round(a.salarios.reduce((x, y) => x + y, 0) / a.salarios.length)
              : null;
          const p = latestByCargo[id];
          return {
            cargo: a.cargo,
            empresa,
            p25: p?.p25 ? Number(p.p25) : null,
            p50: p?.p50 ? Number(p.p50) : null,
            p75: p?.p75 ? Number(p.p75) : null,
            headcount: a.headcount,
          };
        })
        .filter((r) => r.empresa !== null && r.p50 !== null)
        .sort((a, b) => (b.p50 ?? 0) - (a.p50 ?? 0));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Salário Pago × Mercado</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem dados cruzáveis — vincule salários aos colaboradores e mantenha a pesquisa atualizada.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ left: 60, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <YAxis
                type="category"
                dataKey="cargo"
                width={150}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) =>
                  v.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="p25" fill="#fca5a5" name="P25 Mercado" />
              <Bar dataKey="p50" fill="#fcd34d" name="P50 Mercado" />
              <Bar dataKey="p75" fill="#86efac" name="P75 Mercado" />
              <Bar dataKey="empresa" fill="hsl(var(--primary))" name="Média Blips" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
