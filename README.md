# 📱 TOP APP — Central de Tutoriais & Painel MONITOR ADMIN

Plataforma completa de autoatendimento e tutoriais passo a passo para clientes e colaboradores da empresa **TOP APP**, acompanhada do painel de controle **MONITOR ADMIN**.

Permite gerenciar **Categorias** e **Subcategorias** com suporte a:
- 📝 **Textos explicativos ricos** (com subtítulos, listas ordenadas, checklists, citações e negrito).
- 📸 **Galerias de fotos** (via upload direto ou link de imagem) com visualização em Lightbox fullscreen.
- 🎬 **Vídeos tutoriais** (upload de MP4/WebM nativo com streaming Range ou incorporação direta do YouTube, Vimeo e Loom).
- 🔍 **Busca em tempo real** com atalho `Ctrl+K` para os clientes encontrarem qualquer instrução instantaneamente.
- ⚡ **Armazenamento Híbrido**: Funciona com **Supabase Cloud** (PostgreSQL + Bucket de Mídia) com fallback automático para banco local (`data/tutorials.json`) ou `localStorage` do navegador.

---

## 🚀 Como Iniciar Localmente (Zero Dependências Externas)

O projeto foi construído em JavaScript Moderno nativo (ES Modules), dispensando compilação ou instalação pesada de pacotes:

```bash
# Iniciar o servidor com suporte a streaming de vídeo e upload
node server.mjs
```

Ou usando npm:
```bash
npm start
```

### 🔗 Links de Acesso:
- **Portal do Cliente (Público):** [http://localhost:4100](http://localhost:4100) (ou abra diretamente `index.html`)
- **Painel Administrativo:** [http://localhost:4100/admin](http://localhost:4100/admin) (ou abra diretamente `admin.html`)
- **Senha Inicial do Painel:** `admin123` *(pode ser alterada no menu "⚙ Site & Backup")*

---

## ⚡ Conectando ao Supabase Cloud

Para ter persistência em nuvem multiusuário:

1. Acesse o **SQL Editor** do seu painel no Supabase.
2. Execute o script contido em [supabase/schema.sql](supabase/schema.sql) (ele cria as tabelas `tutorial_settings`, `tutorial_categories`, `tutorial_subcategories` e o bucket `tutorial-media`).
3. No Painel Admin, clique no botão **⚡ Conexão Supabase**.
4. Insira a sua **Project URL** e a chave **Publishable (anon) Key**.
5. Clique em **Testar e Conectar**. Os dados serão sincronizados em tempo real.

---

## ☁️ Deploy na Vercel (1 Clique)

O projeto possui arquivo de configuração [vercel.json](vercel.json) pronto:

1. Importe o repositório `tutorial-Top` na Vercel.
2. Framework Preset: **Other**.
3. Root Directory: `./` (raiz).
4. Clique em **Deploy**. A rota `/` abrirá a Central de Tutoriais e `/admin` abrirá o Painel de Controle!

---

## 📂 Estrutura do Projeto

```
tutorial-Top/
├── index.html              # Interface pública para os clientes
├── admin.html              # Painel de gestão MONITOR ADMIN
├── styles.css              # Design System escuro + dourado (#080a0f, #141822, #f5b700)
├── server.mjs              # Servidor HTTP nativo com upload e streaming de vídeo
├── vercel.json             # Configuração de rotas limpas para deploy na Vercel
├── js/
│   ├── portal.js           # Lógica do catálogo público, busca e lightbox
│   ├── admin.js            # Lógica do painel admin, modals e ordenação
│   ├── store.js            # Camada universal de persistência (Supabase / Local)
│   ├── media-utils.js      # Parser de YouTube/Vimeo/Loom e Markdown
│   └── default-data.js     # Categorias padrão do TOP APP
├── supabase/
│   └── schema.sql          # DDL completo do PostgreSQL + Storage Bucket
├── uploads/                # Diretório de fotos e vídeos locais
└── tests/
    └── tutorials.test.mjs  # Testes automatizados (Node Test Runner)
```

---

## 🧪 Testes Automatizados

Para rodar os testes unitários da camada de dados e utilitários de mídia:

```bash
npm test
```
