-- ============================================================================
-- CENTRAL DE TUTORIAIS — SCHEMA COMPLETO PARA SUPABASE (PostgreSQL + Storage)
-- ============================================================================
-- Como usar:
-- 1. Abra o Supabase Dashboard -> SQL Editor -> New Query
-- 2. Cole todo este script e clique em "Run"
-- 3. No Painel Admin -> clique em "Conexão Supabase" e informe sua Project URL
--    e Publishable / Anon Key.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Configurações Gerais do Site de Tutoriais
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutorial_settings (
  id text PRIMARY KEY DEFAULT 'default',
  brand_name text NOT NULL DEFAULT 'TOP',
  brand_badge text NOT NULL DEFAULT 'APP',
  hero_title text NOT NULL DEFAULT 'Plataforma',
  hero_subtitle text NOT NULL DEFAULT 'Guias passo a passo e tutoriais completos com textos, fotos e vídeos explicativos para seus clientes.',
  whatsapp_url text NOT NULL DEFAULT 'https://wa.me/5571999999999',
  whatsapp_label text NOT NULL DEFAULT 'Fale Conosco no WhatsApp',
  admin_password text NOT NULL DEFAULT 'admin123',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tutorial_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Categorias de Tutoriais (com texto, fotos e vídeos próprios)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutorial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 3. Subcategorias / Tutoriais (com texto, fotos e vídeos próprios)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutorial_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.tutorial_categories(id) ON DELETE CASCADE,
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
-- 4. Trigger automático para updated_at
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
-- 5. RLS (Row Level Security) — Leitura pública e gestão pelo painel
-- Observação: para restringir escrita somente a usuários logados no Supabase
-- Auth, substitua `true` nas políticas de escrita por `auth.role() = 'authenticated'`.
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
-- 6. Storage Bucket público para upload de fotos e vídeos explicativos
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

