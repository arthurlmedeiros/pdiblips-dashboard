# Dashboard — PDI Blips

## Visão Geral

Módulo de dashboard e KPIs. Exibe indicadores consolidados da plataforma: total de colaboradores, distribuição de planos por status, resultados de testes comportamentais e composição por setor. Usa queries diretas ao Supabase (sem hooks de domínio customizados).

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Página única do módulo — todos os KPIs e gráficos |

---

## Contexto Técnico

### Por que queries diretas (sem hooks customizados)?

O dashboard realiza **agregações transversais** que cruzam múltiplos domínios (colaboradores, planos, testes, setores). Criar hooks de domínio para cada agregação seria artificial e criaria acoplamento desnecessário entre módulos.

Por isso, `Dashboard.tsx` usa `useQuery` diretamente com queries Supabase específicas para o dashboard:

```ts
// Query keys prefixadas com "dashboard_"
useQuery({
  queryKey: ['dashboard_colaboradores_count'],
  queryFn: () => supabase.from('pdi_colaboradores').select('id', { count: 'exact', head: true })
})

useQuery({
  queryKey: ['dashboard_planos_status'],
  queryFn: () => supabase.from('pdi_planos').select('status')
})
```

### Fontes de Dados

| Fonte | KPI Gerado |
|-------|-----------|
| `pdi_colaboradores` | Total de colaboradores, distribuição por setor |
| `pdi_planos` | Contagem por status (rascunho / em andamento / concluído) |
| `pdi_testes_perfil` | Distribuição de perfis comportamentais |
| `pdi_setores` | Nomes dos setores para labels dos gráficos |

### Gráficos (Recharts)

Componentes Recharts utilizados:

```tsx
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
```

- **PieChart**: distribuição de planos por status, distribuição de perfis
- **LineChart**: evolução temporal (se houver dados históricos)
- **ResponsiveContainer**: wrapper obrigatório para responsividade

### Loading States

Todos os blocos de KPI usam **Skeleton** do shadcn/ui enquanto os dados carregam:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

{isLoading ? <Skeleton className="h-32 w-full" /> : <PieChart ... />}
```

Nunca exibir dados zerados ou placeholders — usar Skeleton explicitamente.

---

## Imports

```ts
// O dashboard não exporta hooks reutilizáveis — é auto-contido
// Para consumir dados de dashboard em outros contextos, criar nova query específica
import Dashboard from '@dashboard/pages/Dashboard'
```

---

## Restrições

1. **Query keys prefixadas `dashboard_`** — nunca reutilizar query keys de outros módulos
2. **Sem hooks de domínio**: não importar `useColaboradores`, `usePlanos`, etc. — queries diretas apenas
3. **Skeleton obrigatório** em todos os estados de loading — nunca exibir `null` ou `0` enquanto carrega
4. **Sem mutações**: dashboard é somente leitura — nenhum botão de criação/edição aqui
5. **Acesso**: todos os roles autenticados veem o dashboard, mas os dados são filtrados via RLS no banco

---

## Modo Standalone vs Delegado

**Standalone**: clonar para trabalhar nos KPIs e visualizações do dashboard de forma isolada. Os dados são lidos diretamente do Supabase sem dependência de outros módulos.

**Delegado**: o orquestrador injeta este módulo ao coordenar tarefas de análise ou relatórios que precisem de visão consolidada da plataforma.
