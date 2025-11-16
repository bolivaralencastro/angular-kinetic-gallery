# Documentação Técnica Detalhada — Angular Kinetic Gallery

## 1. Visão Geral
Aplicação SPA em Angular 20 que organiza galerias fotográficas com captura por webcam, animações leves e menu contextual avançado. O `AppComponent` orquestra estados com signals, atalhos globais e modais para captura, edição e navegação.

## 2. Stack Tecnológica
| Camada | Tecnologia / Biblioteca | Detalhes de Uso |
| --- | --- | --- |
| Framework SPA | Angular 20 (standalone components e signals) | `bootstrapApplication`, detecção de mudanças zoneless e componentes autônomos. |
| Linguagem | TypeScript estrito | Tipagens para componentes, serviços e integrações externas. |
| Estilização | Design system em CSS (tokens/base/utilities) | Tokens em `src/styles/tokens.css`, resets e padrões em `base.css` e utilitários em `utilities.css`. |
| Reatividade | Angular Signals | `signal`, `computed` e `effect` em componentes e serviços. |
| Backend-as-a-Service | Supabase REST & Storage | Persistência opcional de galerias e imagens, autenticação de administradores. |
| Autenticação | Supabase Auth | Controle de sessão e verificação de e-mail autorizado. |
| PWA | Service worker customizado | Cache básico e atualização de assets em `service-worker.js`. |

## 3. Configuração e Scripts
- **Scripts** (`package.json`): `npm run dev`, `npm run build`, `npm run preview`.
- **Variáveis** (`NG_APP_SUPABASE_*`): URL, chave anon, bucket e e-mail admin; valores padrão definidos em `src/environments/environment.ts` podem ser sobrescritos via `.env` ou variáveis de shell.
- **Dependências principais**: Angular 20.3.x, RxJS 7.8, TypeScript 5.8, builder Angular CLI.

## 4. Estrutura do Código-Fonte
### 4.1 Entrada e bootstrap
- `src/main.ts` registra `provideHttpClient`, `provideZonelessChangeDetection` e o service worker após o carregamento.

### 4.2 Componente raiz (`AppComponent`)
- Monta grade de cards e fotos, alternando visões de galerias e imagens individuais.
- Injeta `GalleryService`, `ThemeService`, `AuthService` e `InteractiveCursor`.
- Signals controlam itens visíveis, itens expandidos, modais, reprodução automática e menu contextual.
- Atalhos de teclado para captura, troca de tema, tela cheia, info e navegação.

### 4.3 Componentes standalone
- **ContextMenuComponent**: menu contextual com grupos de ações configuráveis.
- **WebcamCaptureComponent**: captura com preview, temporizador, troca de câmera e conversão opcional para WebP.
- **GalleryEditorComponent**: modal para criar/editar galerias e excluir registros.
- **GalleryCreationDialogComponent**: assistente para distribuir capturas pendentes em galerias.
- **InfoDialogComponent**: atalhos e instruções rápidas.
- **MobileGalleryCardComponent**: card otimizado para dispositivos móveis.

### 4.4 Serviços
- **ThemeService**: controla tema claro/escuro e paletas derivadas.
- **InteractiveCursor**: cursor customizado com animação via GSAP.
- **AuthService**: login/logout no Supabase e flags de autorização.
- **GalleryService**: CRUD local, sincronização com Supabase, upload/remoção de arquivos e definição de miniaturas.
- **SupabaseService**: chamadas REST (`galleries`, `gallery_images`) e operações no Storage.

### 4.5 Tipos e utilitários
- Interfaces de galeria em `src/interfaces/gallery.interface.ts`.
- Tipos de menu (`src/types/context-menu.ts`) e Supabase (`src/types/supabase.ts`).
- Utilitário de conversão para WebP em `src/utils/convert-to-webp.ts`.

### 4.6 Estilos e assets
- Overrides globais em `src/styles.css` (tema, cursor e ajustes de foco).
- Recursos estáticos em `src/assets` e manifesto PWA em `manifest.webmanifest`.

## 5. Fluxos Principais
- **Inicialização**: `main.ts` inicializa o app; `AppComponent` ativa cursor (quando aplicável), busca dados via `GalleryService` e aplica tema salvo.
- **Gerenciamento de Galerias**: admins podem criar/editar/excluir; IDs via `crypto.randomUUID`; miniaturas automáticas a partir da primeira imagem; sincronização com Supabase quando configurado.
- **Captura de Fotos**: webcam com permissão de mídia, contagem regressiva e conversão opcional para WebP; capturas podem ser associadas a galerias ou permanecer pendentes.
- **Interações**: menu contextual, atalhos de teclado (tema, tela cheia, info, navegação), cursor customizado em elementos com `data-cursor-pointer`.
- **Tema e Acessibilidade**: paletas contrastantes, atributos ARIA em botões e ajustes de foco para manter acessibilidade mesmo com cursor customizado.

## 6. Integração com Supabase
- Requisições REST autenticadas com `apikey` e tokens de sessão (`AuthService`).
- Uploads via `fetch` para o bucket definido; `image_url` armazena a URL pública completa.
- Exclusão de galerias remove registros em `gallery_images` e arquivos no Storage.
- Datas normalizadas para `DD/MM/YYYY` na UI.

## 7. Execução Local e Deploy
1. `npm install`
2. Defina as variáveis `NG_APP_SUPABASE_*` se usar backend próprio.
3. `npm run dev` para desenvolvimento, `npm run build` para produção e `npm run preview` para inspecionar o build.

## 8. Boas Práticas
- Prefira signals e componentes standalone.
- Reutilize tokens e utilitários de estilo existentes.
- Mantenha URLs e caminhos de Storage padronizados para facilitar limpeza e auditoria.
