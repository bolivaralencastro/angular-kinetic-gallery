README - Configuração do Backend
Abaixo está o conteúdo completo do arquivo Markdown que descreve a configuração atual do backend do projeto, incluindo Storage, tabelas relacionadas a galerias, autenticação e observações operacionais. Você pediu a opção B (texto para copiar/colar). Copie este conteúdo para um arquivo README.md onde preferir.

Backend — Visão Geral e Configuração
Este documento descreve a configuração atual do backend do projeto, com foco em Storage (Supabase Storage), estruturas de dados para galerias e imagens, autenticação e pontos operacionais importantes.

Sumário
Visão geral
Estruturas principais (buckets e tabelas)
Como imagens e galerias estão vinculadas
Observações sobre metadados e sizing
Recomendações operacionais e de manutenção
Como reproduzir/estender
Visão geral
O backend usa Supabase (Postgres + Storage + Auth + Realtime). As principais responsabilidades são:

Armazenamento de imagens e outros objetos em um bucket do Supabase Storage.
Tabelas no schema public para representar galerias e as imagens dentro delas.
Autenticação gerenciada pelo schema auth (Supabase Auth).
Possibilidade de notificações em tempo real usando o schema realtime, embora não haja triggers públicos configurados para isso neste momento.
Buckets e objetos (Supabase Storage)
Bucket principal identificado: gallery-images (1 bucket no projeto).
Tabela storage.objects contém os objetos armazenados no bucket (45 objetos atualmente).
Cada objeto tem campos relevantes:
id (uuid)
bucket_id (text)
name (text) — caminho relativo dentro do bucket (ex.: /.png)
metadata / user_metadata (jsonb) — podem conter informações adicionais, inclusive um campo size
created_at, updated_at
Observações:

Os nomes dos objetos incluem subpastas (por exemplo: /.png).
Muitos objetos possuem extensão .png e têm tamanhos entre ~170 KB e ~430 KB conforme metadados disponíveis.
Tabelas de domínio
public.galleries

colunas: id (uuid), name (text), description (text), thumbnail_url (text), created_at
Registra as galerias criadas (4 galerias no momento).
public.gallery_images

colunas: id (uuid), gallery_id (uuid), image_url (text), created_at
Armazena referências a imagens relacionadas a cada galeria (23 registros).
Observação importante: image_url parece conter um valor que não bate exatamente com storage.objects.name (possivelmente é uma URL completa ou um caminho diferente), o que dificulta joins diretos entre tabela e objetos do Storage.
Autenticação e controle de acesso
Auth: tabela auth.users existe e contém os usuários do sistema (supabase auth padrão).
RLS: storage e public podem ter políticas RLS ativas (padrão do Supabase). Verifique políticas se precisar de acesso via conta anon/cliente.
Para operações administrativas (ex.: listar/editar objetos via SQL), utilize a service_role ou funções/Edge Functions com as credenciais apropriadas.
Observações sobre correspondência entre imagens e registros
Durante a análise foi observado:

storage.objects contém 45 objetos com nomes terminando em .png.
public.gallery_images contém 23 registros referenciando imagens.
A consulta inicial não encontrou correspondências exatas entre storage.objects.name e gallery_images.image_url por causa de diferenças de formato (p.ex.: image_url pode incluir domínio completo ou caminho absoluto, enquanto objects.name usa apenas o caminho relativo).
Recomenda-se padronizar o armazenamento de referência (por exemplo, salvar apenas o caminho relativo ou separar bucket + path) para facilitar joins, limpeza de arquivos órfãos e integridade referencial.
Tamanhos e estimativas
Média de tamanho observada (quando metadata.size está presente): ~230 KB por objeto.
Soma total dos objetos com size conhecido: ~9,9 MB.
Com essa média, estimativas aproximadas:
~4.300 imagens por GB (usando 230 KB média e base decimal),
Ajuste conforme a média real das suas imagens (ex.: fotos em alta resolução terão média maior).
Observação: o Supabase não expõe uma quota de armazenamento via banco por padrão. Para estimar quantas imagens ainda cabem, informe o espaço disponível em GB ou confirme uma suposição (ex.: 5 GB).

Recomendações e boas práticas
Normalizar referências de imagens:
Armazenar em public.gallery_images: bucket_id + object_name (em colunas separadas) em vez de usar uma URL completa em image_url. Isso facilita joins e operações de manutenção.
Criar constraints ou funções de verificação:
Triggers ou jobs que garantam que, ao apagar um registro em gallery_images, o objeto no Storage seja removido (ou vice-versa — política de soft-delete).
Limpeza de arquivos órfãos:
Rodar periodicamente uma rotina que identifique objetos do bucket que não estejam referenciados e remover ou arquivar.
Indexes e RLS:
Indexar colunas usadas em políticas RLS (por exemplo, gallery_id) e nas queries frequentes.
Revisar políticas RLS para garantir que apenas usuários autorizados acessem/editem galeries e imagens.
Metadados:
Armazenar size em metadata/user_metadata de forma consistente ao fazer upload (para permitir análises sem precisar baixar o objeto).
Monitoramento:
Habilitar logs e/ou auditoria para uploads e deleções importantes.
Ações sugeridas imediatas
Corrigir a lógica de correspondência entre public.gallery_images.image_url e storage.objects.name:
Rodar uma correção que compare apenas o final do path (basename) ou normalize removendo domínio/host.
Gerar relatório de objetos órfãos completo e tomar decisão de deleção/arquivamento.
Atualizar o schema de gallery_images para separar bucket e path (migrar os valores existentes).
Automatizar rotina de limpeza com uma Edge Function ou job no banco.
Como reproduzir a análise (consultas úteis)
Exemplos que podem ser usados para diagnóstico:

Listar objetos no bucket: SELECT * FROM storage.objects WHERE bucket_id = 'gallery-images' ORDER BY name;
Listar registros de imagens: SELECT * FROM public.gallery_images ORDER BY created_at;
Comparação permissiva (suffix match) entre objects.name e gallery_images.image_url: SELECT o.*, g.image_url FROM storage.objects o LEFT JOIN public.gallery_images g ON g.image_url LIKE '%' || o.name OR o.name LIKE '%' || g.image_url;
Média de tamanho a partir dos metadados: SELECT AVG((user_metadata->>'size')::bigint) FROM storage.objects WHERE user_metadata ? 'size';*
Ajuste as queries conforme suas convenções de path/URL.
