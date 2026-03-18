import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, TrendingUp, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@core/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PERFIL_ANIMAL_NAME } from "@testes/components/testes/TestePerfilResultado";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from "recharts";

const ANIMAL_DASHBOARD_CONFIG: Record<
  string,
  { animal: string; emoji: string; color: string; label: string }
> = {
  idealista: {
    animal: "Águia",
    emoji: "🦅",
    color: "hsl(43 96% 56%)", // amber
    label: "Águia (Idealista)",
  },
  focado: {
    animal: "Tubarão",
    emoji: "🦈",
    color: "hsl(0 84% 60%)", // red
    label: "Tubarão (Focado)",
  },
  afetivo: {
    animal: "Gato",
    emoji: "🐱",
    color: "hsl(330 81% 60%)", // pink
    label: "Gato (Afetivo)",
  },
  organizado: {
    animal: "Lobo",
    emoji: "🐺",
    color: "hsl(217 91% 60%)", // blue
    label: "Lobo (Organizado)",
  },
};

const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value,
    percent,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 14} textAnchor="middle" fill="hsl(var(--foreground))" className="text-lg font-bold">
        {payload.emoji} {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-sm">
        {value} colaborador{value !== 1 ? "es" : ""} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 14}
        outerRadius={outerRadius + 18}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const Dashboard = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ["dashboard_colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdi_colaboradores")
        .select("id, cargo, funcao")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["dashboard_planos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdi_planos")
        .select("progresso, updated_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: testesPerfil = [], isLoading: loadingTestes } = useQuery({
    queryKey: ["dashboard_testes_perfil"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdi_testes_perfil")
        .select("colaborador_id, perfil_dominante, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingColabs || loadingPlanos || loadingTestes;

  const totalColaboradores = colaboradores.length;

  const gerentes = useMemo(
    () =>
      colaboradores.filter((c) => {
        const cargo = (c.cargo || "").toLowerCase();
        const funcao = (c.funcao || "").toLowerCase();
        return cargo.includes("gerente") || funcao.includes("gerente");
      }).length,
    [colaboradores]
  );

  const diretores = useMemo(
    () =>
      colaboradores.filter((c) => {
        const cargo = (c.cargo || "").toLowerCase();
        const funcao = (c.funcao || "").toLowerCase();
        return cargo.includes("diretor") || funcao.includes("diretor");
      }).length,
    [colaboradores]
  );

  const mediaPDI = useMemo(() => {
    if (!planos.length) return 0;
    const soma = planos.reduce((acc, p) => acc + Number(p.progresso || 0), 0);
    return Math.round(soma / planos.length);
  }, [planos]);

  const lineData = useMemo(() => {
    if (!planos.length) return [];
    const byMonth: Record<string, { sum: number; count: number }> = {};
    planos.forEach((p) => {
      const key = format(new Date(p.updated_at), "yyyy-MM");
      if (!byMonth[key]) byMonth[key] = { sum: 0, count: 0 };
      byMonth[key].sum += Number(p.progresso || 0);
      byMonth[key].count += 1;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, v]) => ({
        mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
        media: Math.round(v.sum / v.count),
      }));
  }, [planos]);

  const pieData = useMemo(() => {
    if (!testesPerfil.length) return [];
    const latest: Record<string, string> = {};
    testesPerfil.forEach((t) => {
      if (!latest[t.colaborador_id]) {
        latest[t.colaborador_id] = t.perfil_dominante;
      }
    });
    const counts: Record<string, number> = {};
    Object.values(latest).forEach((perfil) => {
      counts[perfil] = (counts[perfil] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts).map(([key, value]) => {
      const config = ANIMAL_DASHBOARD_CONFIG[key];
      return {
        key,
        name: config?.animal || PERFIL_ANIMAL_NAME[key] || key,
        emoji: config?.emoji || "❓",
        color: config?.color || "hsl(var(--muted))",
        label: config?.label || key,
        value,
        pct: Math.round((value / total) * 100),
      };
    });
  }, [testesPerfil]);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const kpis = [
    { title: "Total Colaboradores", value: String(totalColaboradores), icon: Users },
    { title: "Gerentes", value: String(gerentes), icon: UserCheck },
    { title: "Diretores", value: String(diretores), icon: BarChart3 },
    { title: "Evolução PDI", value: `${mediaPDI}%`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral das métricas da plataforma
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="text-3xl font-display font-bold text-foreground">
                  {kpi.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Evolução PDI - full width */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Evolução Média do PDI</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPlanos ? (
            <div className="h-64 space-y-3 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : lineData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum plano PDI cadastrado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value}%`, "Média"]}
                />
                <Line
                  type="monotone"
                  dataKey="media"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Distribuição de Perfis - full width */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Distribuição de Perfis Comportamentais</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTestes ? (
            <div className="h-80 flex items-center justify-center">
              <Skeleton className="h-52 w-52 rounded-full" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum teste de perfil realizado
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pie Chart */}
              <ResponsiveContainer width="100%" height={280} className="md:!h-[320px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    activeIndex={activeIndex ?? undefined}
                    activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                        style={{
                          opacity: activeIndex !== null && activeIndex !== i ? 0.4 : 1,
                          transition: "opacity 0.2s ease",
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [`${value} colaborador${value !== 1 ? "es" : ""}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {pieData.map((entry, i) => {
                  const isActive = activeIndex === i;
                  const maxVal = Math.max(...pieData.map((d) => d.value), 1);
                  const barPct = (entry.value / maxVal) * 100;
                  return (
                    <div
                      key={entry.key}
                      className={`rounded-xl p-4 text-center cursor-pointer border-2 transition-all duration-200 ${
                        isActive
                          ? "shadow-lg scale-105 border-foreground/30"
                          : "border-border hover:border-foreground/20 hover:shadow-md"
                      }`}
                      style={{
                        backgroundColor: isActive ? `${entry.color}15` : undefined,
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      <span className="text-3xl md:text-4xl block">{entry.emoji}</span>
                      <p className="font-bold text-xs md:text-sm mt-1 md:mt-2 text-foreground truncate">{entry.name}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">{entry.label.replace(entry.name + " ", "")}</p>
                      <p className="text-xl md:text-2xl font-display font-bold mt-1" style={{ color: entry.color }}>
                        {entry.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.pct}%</p>
                      <div className="mt-2 h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: entry.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
