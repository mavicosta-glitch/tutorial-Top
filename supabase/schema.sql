-- ============================================================================
-- CENTRAL DE TUTORIAIS (TOP APP / MONITOR ADMIN) — SUPABASE DDL + SEED COMPLETO
-- ============================================================================
-- Projeto: https://qroemyfnpproahzfsuxt.supabase.co
-- Como aplicar:
-- 1. Acesse https://supabase.com/dashboard/project/qroemyfnpproahzfsuxt/sql
-- 2. Cole este script completo e clique em "Run"
-- 3. Pronto! Todas as tabelas, permissões, bucket de mídia e dados iniciais
--    estarão configurados e sincronizados com o site e painel admin.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Configurações Gerais da Plataforma de Tutoriais
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutorial_settings (
  id text PRIMARY KEY DEFAULT 'default',
  brand_name text NOT NULL DEFAULT 'TOP',
  brand_badge text NOT NULL DEFAULT 'APP',
  hero_title text NOT NULL DEFAULT 'Plataforma',
  hero_subtitle text NOT NULL DEFAULT 'Guias passo a passo e tutoriais completos com textos, fotos e vídeos explicativos para clientes e operadores.',
  whatsapp_url text NOT NULL DEFAULT 'https://wa.me/5571999999999',
  whatsapp_label text NOT NULL DEFAULT 'Fale Conosco no WhatsApp',
  admin_password text NOT NULL DEFAULT 'admin123',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tutorial_settings (id, brand_name, brand_badge, hero_title, hero_subtitle, whatsapp_url, whatsapp_label, admin_password)
VALUES (
  'default',
  'TOP',
  'APP',
  'Plataforma',
  'Guias passo a passo e tutoriais completos com textos, fotos e vídeos explicativos para clientes e operadores.',
  'https://wa.me/5571999999999',
  'Fale Conosco no WhatsApp',
  'admin123'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Categorias de Tutoriais (com textos ricos, galerias de fotos e vídeos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutorial_categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT '📁',
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutorial_categories_order
  ON public.tutorial_categories (display_order ASC, created_at ASC);

-- ----------------------------------------------------------------------------
-- 3. Subcategorias / Tutoriais Passo a Passo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutorial_subcategories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id text NOT NULL REFERENCES public.tutorial_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tutorial_subcategories_cat_order
  ON public.tutorial_subcategories (category_id, display_order ASC, created_at ASC);

-- ----------------------------------------------------------------------------
-- 4. Triggers automáticos para atualização de timestamp (updated_at)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tutorial_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutorial_settings_updated_at ON public.tutorial_settings;
CREATE TRIGGER trg_tutorial_settings_updated_at
  BEFORE UPDATE ON public.tutorial_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_tutorial_updated_at();

DROP TRIGGER IF EXISTS trg_tutorial_categories_updated_at ON public.tutorial_categories;
CREATE TRIGGER trg_tutorial_categories_updated_at
  BEFORE UPDATE ON public.tutorial_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_tutorial_updated_at();

DROP TRIGGER IF EXISTS trg_tutorial_subcategories_updated_at ON public.tutorial_subcategories;
CREATE TRIGGER trg_tutorial_subcategories_updated_at
  BEFORE UPDATE ON public.tutorial_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.set_tutorial_updated_at();

-- ----------------------------------------------------------------------------
-- 5. RLS (Row Level Security) — Permissões de Leitura e Edição
-- ----------------------------------------------------------------------------
ALTER TABLE public.tutorial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutorial_settings_all" ON public.tutorial_settings;
CREATE POLICY "tutorial_settings_all"
  ON public.tutorial_settings FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tutorial_categories_all" ON public.tutorial_categories;
CREATE POLICY "tutorial_categories_all"
  ON public.tutorial_categories FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tutorial_subcategories_all" ON public.tutorial_subcategories;
CREATE POLICY "tutorial_subcategories_all"
  ON public.tutorial_subcategories FOR ALL
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. Storage Bucket Público para Fotos e Vídeos (tutorial-media)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-media',
  'tutorial-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/ogg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 52428800;

DROP POLICY IF EXISTS "tutorial_media_public_read" ON storage.objects;
CREATE POLICY "tutorial_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutorial-media');

DROP POLICY IF EXISTS "tutorial_media_public_insert" ON storage.objects;
CREATE POLICY "tutorial_media_public_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tutorial-media');

DROP POLICY IF EXISTS "tutorial_media_public_update" ON storage.objects;
CREATE POLICY "tutorial_media_public_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tutorial-media');

DROP POLICY IF EXISTS "tutorial_media_public_delete" ON storage.objects;
CREATE POLICY "tutorial_media_public_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tutorial-media');

-- ----------------------------------------------------------------------------
-- 7. Carga Inicial de Categorias (TOP APP)
-- ----------------------------------------------------------------------------
INSERT INTO public.tutorial_categories (id, name, slug, icon, summary, content, display_order, is_published)
VALUES
(
  'cat-dashboard',
  '(Dashboard)',
  'dashboard',
  '📊',
  'Visão geral dos indicadores, filtros rápidos e monitoramento em tempo real.',
  '## Como usar o Painel Inicial
Nesta seção você aprende a ler os principais números da operação em tempo real e navegar entre os relatórios.

1. Acesse o menu lateral esquerdo e clique em **Dashboard**.
2. Utilize o seletor de datas no topo para filtrar hoje, semana ou mês.
3. Clique em qualquer cartão de métrica para abrir o detalhamento.

> Dica: Você pode editar este texto, adicionar fotos e vídeos explicativos diretamente pelo Painel Admin.',
  1,
  true
),
(
  'cat-usuarios',
  'Gestão de Usuários',
  'gestao-de-usuarios',
  '👥',
  'Cadastro, permissões, bloqueio e aprovação de contas na plataforma.',
  '## Gerenciamento de Perfis e Acessos
Controle quem pode acessar cada área do sistema com segurança e rastreabilidade.

- Aprovação de novos cadastros e documentos.
- Redefinição de senha e suporte ao cliente.
- Histórico completo de atividades.',
  2,
  true
),
(
  'cat-operacao',
  'Operação e Viagens',
  'operacao-e-viagens',
  '🚗',
  'Acompanhamento de solicitações, mapas ao vivo e tratativa de ocorrências.',
  '## Acompanhamento Operacional
Aprenda a monitorar o fluxo diário, despachar atendimentos e resolver imprevistos com agilidade.',
  3,
  true
),
(
  'cat-financeiro',
  'Taxas e Financeiro',
  'taxas-e-financeiro',
  '💰',
  'Configuração de tarifas, repasses, cupons e fechamento financeiro.',
  '## Controle Financeiro
Configure tarifas dinâmicas, acompanhe repasses e emita demonstrativos com transparência.',
  4,
  true
),
(
  'cat-comunicacao',
  'Comunicação & Relatórios',
  'comunicacao-relatorios',
  '💬',
  'Envio de notificações push, avisos em massa e exportação de planilhas.',
  '## Notificações e Exportações
Comunique novidades aos clientes e baixe relatórios em Excel ou PDF em poucos cliques.',
  5,
  true
),
(
  'cat-avancadas',
  'Avançadas e Sistema',
  'avancadas-e-sistema',
  '⚙️',
  'Integrações, chaves de API, personalização visual e backups.',
  '## Configurações Avançadas
Ajuste regras globais do sistema, integrações externas e preferências da sua empresa.',
  6,
  true
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    display_order = EXCLUDED.display_order;

-- ----------------------------------------------------------------------------
-- 8. Carga Inicial de Subcategorias / Tutoriais
-- ----------------------------------------------------------------------------
INSERT INTO public.tutorial_subcategories (id, category_id, title, slug, summary, content, display_order, is_published)
VALUES
(
  'sub-visao-geral',
  'cat-dashboard',
  'Visão geral da operação',
  'visao-geral-da-operacao',
  'Entenda cada indicador exibido na tela inicial assim que você faz login.',
  '## Passo a passo inicial
Ao acessar a plataforma, o primeiro bloco mostra o resumo operacional do dia.

1. Confira o total de atendimentos ativos no canto superior esquerdo.
2. Verifique o gráfico de evolução horária para identificar horários de pico.
3. Use o botão **Atualizar** para sincronizar os números instantaneamente.

> Dica: Você pode anexar prints da sua tela e vídeos explicativos gravados no Loom ou YouTube pelo Painel Admin.',
  1,
  true
),
(
  'sub-tipos-motorista',
  'cat-dashboard',
  'Tipos de motorista',
  'tipos-de-motorista',
  'Como diferenciar categorias de parceiros e configurar regras específicas.',
  '## Classificação de categorias
Separe seus parceiros por perfil de atendimento para aplicar regras e tarifas corretas.

- **Padrão:** atendimento regular com tarifa base.
- **Executivo:** veículos premium e prioridade na fila.
- **Entregas:** habilitado para encomendas e pacotes.',
  2,
  true
),
(
  'sub-clientes',
  'cat-dashboard',
  'Clientes',
  'clientes',
  'Como localizar clientes, ver histórico e prestar suporte rápido.',
  '## Consulta de clientes
1. Abra a aba **Clientes** no painel.
2. Pesquise por nome, telefone ou e-mail.
3. Clique no perfil para visualizar histórico de solicitações e avaliações.',
  3,
  true
),
(
  'sub-movimentacao',
  'cat-dashboard',
  'Movimentação de viagens',
  'movimentacao-de-viagens',
  'Acompanhe entradas, viagens finalizadas, cancelamentos e motivos.',
  '## Análise de movimentação
Compare viagens concluídas e canceladas por período para melhorar o tempo de resposta da equipe.',
  4,
  true
),
(
  'sub-rankings',
  'cat-dashboard',
  'Rankings',
  'rankings',
  'Veja os melhores desempenhos, notas e volume de atendimentos.',
  '## Ranking de desempenho
Acompanhe quem teve melhor avaliação e maior volume de atendimentos concluídos no período.',
  5,
  true
),
(
  'sub-cadastro-usuario',
  'cat-usuarios',
  'Como cadastrar um novo operador',
  'como-cadastrar-novo-operador',
  'Crie contas para sua equipe definindo permissões sob medida.',
  '## Criando um acesso
1. Vá em **Gestão de Usuários > Novo Operador**.
2. Preencha nome completo, e-mail corporativo e perfil de permissão.
3. Clique em **Salvar e Enviar Convite**.',
  1,
  true
),
(
  'sub-permissoes',
  'cat-usuarios',
  'Níveis de permissão e segurança',
  'niveis-de-permissao',
  'Entenda a diferença entre Administrador, Operador e Visualizador.',
  '## Perfis disponíveis
- **Administrador:** acesso total a tarifas, relatórios e equipe.
- **Operador:** gerencia rotina diária sem alterar configurações sensíveis.
- **Visualizador:** apenas consulta de painéis e relatórios.',
  2,
  true
),
(
  'sub-mapa-vivo',
  'cat-operacao',
  'Monitoramento no mapa ao vivo',
  'monitoramento-mapa-ao-vivo',
  'Visualize posições em tempo real e filtre por status de atendimento.',
  '## Usando o mapa ao vivo
Utilize os filtros no topo do mapa para ver apenas unidades disponíveis, em atendimento ou offline.',
  1,
  true
),
(
  'sub-taxas-config',
  'cat-financeiro',
  'Como configurar taxas e comissões',
  'configurar-taxas-comissoes',
  'Defina percentual por categoria, valor mínimo e horários especiais.',
  '## Ajustando tarifas
1. Acesse **Taxas e Financeiro**.
2. Selecione a categoria desejada.
3. Defina tarifa base, valor por km/minuto e salve as alterações.',
  1,
  true
),
(
  'sub-notificacoes',
  'cat-comunicacao',
  'Enviar aviso para todos os clientes',
  'enviar-aviso-clientes',
  'Dispare comunicados importantes direto no aplicativo dos usuários.',
  '## Disparo de comunicados
Escreva um título curto, redija a mensagem e escolha o público-alvo antes de confirmar o envio.',
  1,
  true
),
(
  'sub-integracoes',
  'cat-avancadas',
  'Configurar WhatsApp e suporte',
  'configurar-whatsapp-suporte',
  'Personalize o link de atendimento direto exibido no topo da plataforma.',
  '## Link de atendimento
No Painel Admin, clique em **Configurações do Site** e atualize o link `https://wa.me/...` do seu suporte.',
  1,
  true
)
ON CONFLICT (category_id, slug) DO UPDATE
SET title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    display_order = EXCLUDED.display_order;
