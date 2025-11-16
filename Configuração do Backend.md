# Configuração do Backend (Supabase)

Este guia descreve apenas o que é necessário para o aplicativo funcionar com um projeto Supabase próprio. Use-o em conjunto com o README principal.

## Estrutura mínima
- **Bucket**: crie um bucket público chamado `gallery-images` no Supabase Storage.
- **Tabelas** (schema `public`):
  - `galleries` com colunas `id uuid primary key`, `name text`, `description text`, `thumbnail_url text`, `created_at timestamp`.
  - `gallery_images` com colunas `id uuid primary key`, `gallery_id uuid references galleries(id) on delete cascade`, `image_url text`, `created_at timestamp default now()`.

## Política de acesso
- O app usa a **chave `anon`** para listar e inserir registros e para enviar arquivos ao Storage; habilite RLS conforme sua política de segurança.
- Para ações administrativas na UI (criar/editar/excluir), o e-mail autorizado deve corresponder a `NG_APP_SUPABASE_ADMIN_EMAIL`.
- Caso utilize RLS restritivas, garanta que a chave `anon` possa inserir/selecionar em `galleries` e `gallery_images` e fazer upload/download no bucket `gallery-images`.

## Convenções de armazenamento
- Uploads são salvos como `/{galleryId}/{uuid}.(png|webp)` no bucket `gallery-images`.
- `image_url` armazena a URL pública completa retornada pelo Storage (`.../storage/v1/object/public/gallery-images/...`).
- Ao remover uma galeria, o `SupabaseService` deleta as entradas em `gallery_images` e remove os arquivos correspondentes no Storage.

## Variáveis de ambiente
Defina antes de rodar o app (arquivo `.env` ou export no shell):

```
NG_APP_SUPABASE_URL="https://<sua-instancia>.supabase.co"
NG_APP_SUPABASE_ANON_KEY="<sua-chave-anon>"
NG_APP_SUPABASE_BUCKET="gallery-images"
NG_APP_SUPABASE_ADMIN_EMAIL="email-autorizado@dominio.com"
```

## Teste rápido
1. Suba o backend conforme acima.
2. Rode `npm run dev` e abra a aplicação.
3. Capture uma imagem ou crie uma galeria; verifique no painel do Supabase se os registros aparecem nas tabelas e se o arquivo foi enviado ao bucket.
