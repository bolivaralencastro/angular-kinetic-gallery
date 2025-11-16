# Angular Kinetic Gallery

Aplicação web em Angular 20 focada em criação e curadoria de galerias fotográficas, com suporte a captura por webcam, cursor interativo e sincronização opcional com Supabase.

## Visão geral rápida
- Componentes standalone com **signals** para estados reativos (galerias, imagens, modal de edição, tema, cursor).
- Design system baseado em tokens CSS (`src/styles/tokens.css`, `base.css`, `utilities.css`) e componentes estilizados reutilizáveis.
- Integração opcional com Supabase (REST + Storage + Auth) para persistir galerias, imagens e sessão administrativa.
- PWA com service worker customizado (`service-worker.js`) e manifesto (`manifest.webmanifest`).

## Requisitos
- Node.js 20 ou superior.
- Conta Supabase apenas se desejar persistência remota (o app funciona localmente sem backend, mantendo dados em memória).

## Configuração de variáveis de ambiente
Os valores padrão em `src/environments/environment.ts` apontam para um projeto de demonstração. Para usar o seu Supabase defina as variáveis prefixadas com `NG_APP_` antes de rodar os scripts (arquivo `.env` ou export no shell):

```
NG_APP_SUPABASE_URL="https://<sua-instancia>.supabase.co"
NG_APP_SUPABASE_ANON_KEY="<sua-chave-anon>"
NG_APP_SUPABASE_BUCKET="gallery-images"
NG_APP_SUPABASE_ADMIN_EMAIL="email-autorizado@dominio.com"
```

## Como executar
1. Instale dependências: `npm install`
2. Ambiente local: `npm run dev`
3. Build de produção: `npm run build`
4. Pré-visualização do build: `npm run preview`

## Estrutura e estilo
- **Bootstrap**: `src/main.ts` usa `bootstrapApplication` com `AppComponent`, `provideHttpClient` e registro do service worker após o evento `load`.
- **Componente raiz**: `src/app/app.component.ts` concentra os fluxos principais (lista de galerias, captura, atalhos de teclado, modais e cursor interativo).
- **Serviços**: `GalleryService` (estado e CRUD local + sincronização), `SupabaseService` (REST/Storage), `AuthService` (login/logout com Supabase) e `ThemeService` (tema claro/escuro e paleta).
- **Estilização**: priorize as classes definidas em `src/styles/tokens.css`, `src/styles/base.css` e `src/styles/utilities.css` antes de criar novos estilos; componentes individuais podem ter complementos em `src/styles/components`.

## Backend (Supabase)
- **Bucket**: `gallery-images` no Supabase Storage. Uploads são feitos em `/{galleryId}/{uuid}.(png|webp)` e ficam públicos via `storage/v1/object/public`.
- **Tabelas esperadas**:
  - `public.galleries`: `id uuid primary key`, `name text`, `description text`, `thumbnail_url text`, `created_at timestamp`.
  - `public.gallery_images`: `id uuid primary key`, `gallery_id uuid references galleries(id)`, `image_url text`, `created_at timestamp default now()`.
- **Regras sugeridas**: habilite RLS conforme sua estratégia de acesso; o aplicativo usa a chave `anon` para operações públicas e requer `supabaseAdminEmail` para ações administrativas.
- **Sincronização**: `SupabaseService` faz fetch/CRUD via REST e lida com uploads/remoções no Storage, removendo imagens associadas ao deletar uma galeria.

## Padrões de contribuição
- Mantenha tipagem estrita em TypeScript; evite `any`.
- Reutilize utilitários e tokens existentes antes de criar novas classes.
- Atualize este README se novas variáveis, scripts ou passos de backend forem adicionados.
