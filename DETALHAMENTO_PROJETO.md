# Documentação Técnica Detalhada — Angular Kinetic Gallery

## 1. Visão Geral
O Angular Kinetic Gallery é uma aplicação web voltada para a criação e curadoria de galerias fotográficas "infinitas" que podem ser abastecidas tanto com capturas diretas da webcam quanto com imagens já existentes. A experiência gira em torno do componente raiz `AppComponent`, que orquestra estados reativos com *signals*, oferece interações por teclado e mouse e gerencia sobreposições modais para edição, captura e visualização aprofundada de conteúdo. O projeto combina animações sutis, um cursor customizado e um menu contextual rico para entregar uma navegação dinâmica.

## 2. Stack Tecnológica
| Camada | Tecnologia / Biblioteca | Detalhes de Uso |
| --- | --- | --- |
| Framework SPA | Angular 17 (standalone components e signals) | Base do projeto, com detecção de mudanças *zoneless* e componentes autônomos. |
| Linguagem | TypeScript estrito | Tipagens consistentes para componentes, serviços e integrações externas. |
| Estilização | Tailwind CSS + estilos globais dedicados | Classes utilitárias nos templates e overrides específicos em `src/styles.css`. |
| Reatividade | Angular Signals | `signal`, `computed` e `effect` distribuem estados no `AppComponent`, serviços e temas. |
| Backend-as-a-Service | Supabase REST & Storage | Persistência de galerias e imagens, autenticação de administradores e sincronização remota. |
| Autenticação | Supabase Auth | Controle de sessão para usuários administradores via `AuthService`. |
| Inteligência Artificial | Google Gemini (SDK `@google/genai`) | Preparado para geração de imagens/descrições futuras via `GeminiService`. |
| Utilidades de Imagem | Conversão para WebP | Conversão opcional de capturas para formatos mais leves em `convert-to-webp`. |
| Build e Dev Server | Angular CLI (`ng serve`, `ng build`) | Scripts expostos em `package.json` para desenvolvimento e produção. |
| PWA | Service Worker customizado | Cache offline e atualização de assets em `service-worker.js`. |

## 3. Configuração e Scripts
- **Scripts principais** (`package.json`):
  - `npm run dev`: inicia `ng serve` com recarga automática.
  - `npm run build`: gera artefatos de produção otimizados.
  - `npm run preview`: reusa o servidor do Angular em modo produção para inspeção local.
- **Variáveis de ambiente** (`src/environments/environment.ts`): valores padrão para URL do Supabase, chave `anon`, bucket de imagens e email administrador podem ser sobrescritos via `import.meta.env` (`NG_APP_SUPABASE_*`).
- **Dependências externas**: Angular 20.x, RxJS 7.8, Tailwind CSS, Supabase via chamadas REST nativas e `@google/genai` para futura integração.

## 4. Estrutura do Código-Fonte
### 4.1 Entrada e bootstrap
- `src/main.ts` aplica `bootstrapApplication` ao `AppComponent`, registra `provideZonelessChangeDetection`, expõe o `HttpClient` e registra o *service worker* após o carregamento da página.

### 4.2 Componente raiz (`AppComponent`)
- Responsável por montar a grade "cinética" de cards, fotos e galerias, alternando entre visões de fotos e coleções.
- Injeta serviços centrais: `GalleryService` (dados das galerias), `ThemeService` (paleta e *theme switching*), `AuthService` (habilitação de ações administrativas) e `InteractiveCursor` (cursor personalizado baseado em GSAP).
- Usa *signals* para estados como itens visíveis, itens expandidos, visibilidade de modais, modo de reprodução automática e coordenadas do menu contextual.
- Observa atalhos globais de teclado (`space`, `f`, `i`, `p`, setas, etc.) para capturar fotos, alternar tema, abrir diálogos e navegar.
- Coordena a renderização condicional dos componentes standalone listados abaixo.

### 4.3 Componentes standalone
- **ContextMenuComponent** (`src/components/context-menu`): menu contextual com grupos de ações configuráveis (troca de tema, tela cheia, criação/edição de galerias, captura de fotos, etc.), estilização adaptada ao tema atual e suporte a teclado.
- **WebcamCaptureComponent** (`src/components/webcam-capture`): fluxo completo de captura, incluindo pré-visualização, temporizador, contagem regressiva, troca de câmera, sobreposição de grade e conversão opcional para WebP.
- **GalleryEditorComponent** (`src/components/gallery-editor`): modal para criar ou editar metadados de uma galeria existente, com validação simples e opção de exclusão.
- **GalleryCreationDialogComponent**: assistente para criar uma galeria a partir de capturas pendentes, exibindo miniaturas e distribuindo fotos para coleções existentes.
- **InfoDialogComponent**: apresenta instruções e atalhos para o usuário final.
- **ImageGeneratorComponent**: ponto de entrada para integração com IA (utiliza o serviço Gemini quando habilitado).
- **MobileGalleryCardComponent**: card otimizado para dispositivos móveis, com destaque visual para a galeria ativa e atalhos de abertura.

### 4.4 Serviços
- **ThemeService**: mantém o modo claro/escuro, gera paletas específicas para menu contextual e diálogos, aplica classes ao `<body>` e persiste a preferência no `localStorage`.
- **InteractiveCursor**: instancia um cursor customizado que segue o mouse com interpolação linear (`lerp`), detecta elementos interativos via atributo `data-cursor-pointer` e sincroniza animações pelo `gsap.ticker`.
- **AuthService**: realiza *login* e *logout* no Supabase, persiste tokens, renova sessões próximas da expiração e expõe flags como `isAdmin` para liberar operações de gerenciamento.
- **GalleryService**: mantém as listas de galerias, imagens e capturas pendentes em *signals*, realiza CRUD local, sincroniza com Supabase (REST + Storage), controla uploads em andamento e define miniaturas automaticamente.
- **SupabaseService**: abstrai chamadas REST (coleções) e Storage (upload/delete de imagens), com tratamento de erros, formatação de datas e sanitização de URLs.
- **GeminiService**: reservado para invocar modelos generativos via `@google/genai` (atualmente sem implementação para facilitar expansão futura).

### 4.5 Tipos e interfaces
- `src/interfaces/gallery.interface.ts`: descreve a estrutura de uma galeria (id, nome, descrição, URLs das imagens, miniatura e data de criação).
- `src/types/context-menu.ts`: enumera ações válidas no menu contextual e o formato de agrupamento.
- `src/types/supabase.ts`: modela a resposta do Supabase para galerias e imagens associadas.
- `src/types/environment.d.ts` e `src/types/gsap.d.ts`: ajustes de tipagem para variáveis de ambiente e para o pacote GSAP usado pelo cursor.

### 4.6 Utilitários e helpers
- `src/utils/convert-to-webp.ts`: converte blobs para WebP no navegador (quando suportado), com *fallback* para o formato original e heurísticas para determinar a extensão adequada.

### 4.7 Estilos e assets
- `src/styles.css`: overrides globais para coerência de tema (ex.: esconder cursor padrão em *desktops*, adaptar contrastes no modo claro, neutralizar *focus outline* azul padrão em diálogos).
- `src/assets`: ícones e recursos estáticos utilizados no manifesto PWA (`manifest.webmanifest`).

## 5. Fluxos Principais
### 5.1 Inicialização
1. `main.ts` *bootstrappa* `AppComponent` com detecção de mudanças zoneless.
2. Ao montar, `AppComponent` instancia `InteractiveCursor` (em dispositivos com ponteiro fino) e solicita dados existentes via `GalleryService`, que busca Supabase quando configurado.
3. O `ThemeService` injeta classes e meta tags conforme o tema salvo previamente.

### 5.2 Gerenciamento de Galerias
- Usuários administradores (email autorizado) podem criar, editar e excluir galerias.
- Cada criação gera um `id` via `crypto.randomUUID`, data formatada `DD/MM/YYYY` e miniatura automática a partir da primeira imagem.
- Imagens podem ser adicionadas diretamente após captura ou pela atribuição de "capturas pendentes" a galerias específicas.
- Sincronização automática com Supabase garante persistência remota, incluindo upload de blobs para o Storage e limpeza de assets quando uma galeria é removida.

### 5.3 Captura e Processamento de Fotos
- O componente de webcam pede permissões de mídia, lista câmeras disponíveis e suporta alternância entre elas.
- Temporizadores configuráveis e contagem regressiva garantem capturas seguras; quando concluídas, as imagens passam pela conversão opcional para WebP antes de serem persistidas.
- Capturas podem ser mantidas em fila local até que o usuário defina a galeria de destino.

### 5.4 Interações e Navegação
- Menu contextual oferece ações rápidas, com estados visuais atualizados conforme tema e modo de reprodução automática.
- Atalhos de teclado permitem entrar/sair de tela cheia, abrir diálogos de informação, alternar tema e navegar entre itens.
- O cursor customizado melhora a percepção de interatividade em elementos marcados com `data-cursor-pointer`.

### 5.5 Tema e Acessibilidade
- Paletas contrastantes garantem legibilidade nos dois modos.
- Componentes utilizam atributos `aria` (ex.: botões nos cards móveis) e `focus` personalizados para manter acessibilidade, mesmo com cursor customizado.

## 6. Integração com Supabase
- Requisições REST autenticadas com o header `apikey` e tokens de sessão guardados pelo `AuthService`.
- Uploads utilizam `fetch` direto ao Storage, convertendo `data URLs` para `Blob` com extensão apropriada.
- Exclusões removem tanto os registros (`gallery_images`, `galleries`) quanto os arquivos físicos; operações falhas são logadas para inspeção.
- Datas retornadas pelo Supabase são normalizadas para `DD/MM/YYYY` na UI.

## 7. Integração com IA (Gemini)
- O projeto inclui dependência `@google/genai` e um `GeminiService` reservado para chamadas a modelos generativos. Apesar de ainda não possuir implementação, ele centraliza credenciais e fluxos de requisição quando a funcionalidade for ativada.

## 8. Progressive Web App
- `service-worker.js` gerencia cache de shell básico (HTML, manifesto e ícones) e atualiza ativos sob demanda.
- Durante `bootstrap`, o *service worker* é registrado após o evento `load`, garantindo compatibilidade com navegadores que suportam PWA.

## 9. Execução Local e Deploy
1. Instale as dependências com `npm install`.
2. Configure as variáveis de ambiente (`NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY`, `NG_APP_SUPABASE_BUCKET`, `NG_APP_SUPABASE_ADMIN_EMAIL`) se for utilizar Supabase próprio.
3. Rode `npm run dev` para desenvolvimento ou `npm run build` para gerar os artefatos de produção.
4. Opcionalmente utilize `npm run preview` para validar o build localmente.

## 10. Boas Práticas e Extensões Futuras
- Componentização standalone e *signals* permitem reutilização e testabilidade elevada.
- A separação entre `GalleryService` e `SupabaseService` facilita substituir o backend ou adicionar camadas de cache.
- O espaço reservado do `GeminiService` possibilita ampliar experiências com geração de imagens e descrições assistidas.
- O cursor interativo, embora visualmente marcante, é opcional e pode ser desativado em dispositivos touch para preservar desempenho.
