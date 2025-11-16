# Plano de refatoração do `AppComponent`

## Objetivos
- Reduzir responsabilidades concentradas em `AppComponent`, permitindo extração incremental para componentes/serviços especializados sem quebrar a UI atual.
- Preservar os fluxos críticos (atalhos de teclado, fullscreen, diálogos e transições mobile/desktop) durante a refatoração.
- Mapear dependências e pontos de acoplamento para priorizar uma divisão em etapas curtas e reversíveis.

## Riscos e pontos de atenção
- Regressões em atalhos de teclado que afetam criação de galerias, navegação e zoom (`handleSpacebar`, `handleQuitGalleryKey`, `handleZoomKeys`, `handleArrowNavigation`). Referências: `src/app.component.ts` linhas 85-206 e 486-538.
- Alterações no ciclo de fullscreen (`toggleFullscreenKey`, `toggleFullscreen`, `onFullscreenChange`) podem desalinhar estados internos e o overlay de navegação automática. Referências: linhas 133-146 e 1877-1891.
- Diálogos de login/criação/edição/infos dependem de sinais compartilhados (`isLoginDialogVisible`, `isGalleryCreationDialogVisible`, `isGalleryEditorVisible`, `isInfoDialogVisible`). Referências: linhas 547-551 e 663-668.
- Layout móvel usa sinais e timers próprios para painéis e rolagem (`isMobileLayout`, `mobileCommandPanelVisible`, `scheduleMobilePanelReveal`, `resetMobileScrollPosition`). Referências: linhas 590-620 e 1070-1145.

## Fluxos impactados
- **Atalhos de teclado**: criação de galeria, abertura de webcam, alternância de autoplay e navegação/zoom via setas e `+`/`-`. Ver `handleSpacebar`, `handlePKey`, `handleArrowNavigation`, `handleZoomKeys` nas linhas 85-206 e 486-538.
- **Fullscreen**: alternância via tecla `f` e sincronização de estado quando o navegador entra/sai de fullscreen (linhas 133-146 e 1877-1891).
- **Diálogos**: abertura/fechamento de login, criação de galeria, editor e diálogo de infos com atalhos e efeitos de segurança (linhas 404-478 e 663-668).
- **Layout móvel/desktop**: cálculo de breakpoints, timers de painel, resets de rolagem e navegação entre `capture`, `galleries` e `galleryDetail` (linhas 590-620, 784-827 e 1070-1145).

## Plano em etapas
1. **Inventário e agrupamento**: consolidar os pontos de entrada (host listeners, sinais, serviços) em um diagrama simples para decidir agrupamentos lógicos.
2. **Extrair utilitários puros**: mover cálculos de grid, ociosidade e timers para helpers isolados, mantendo API atual para evitar regressões.
3. **Segmentar interações**: separar handlers de teclado/fullscreen em um serviço ou diretiva dedicada, preservando as verificações de digitação.
4. **Modularizar diálogos**: encapsular estado de login/edição/criação/infos em um store ou serviço único para reduzir dependências cruzadas.
5. **Refinar layout responsivo**: criar adaptador mobile que coordene `mobileView`, rolagem e painéis, permitindo testes separados do desktop.
6. **Garantir compatibilidade**: após cada extração, atualizar o checklist abaixo e manter testes manuais focados nos fluxos críticos.

## Checklist de validação manual
- [ ] Atalhos: barra de espaço abre criação/webcam conforme visão; `p` alterna autoplay; `q` retorna para galerias; setas movem navegação e `+`/`-` ajustam zoom.
- [ ] Fullscreen: tecla `f` entra/sai e o estado visual acompanha transições (incluindo saída com `Esc`).
- [ ] Diálogos: abrir/fechar login, criação de galeria, editor e infos sem bloquear interações; mensagens de erro de login mantidas.
- [ ] Context menu: abre/fecha com clique e `Esc`, ações de editar/excluir respeitam permissões.
- [ ] Mobile: painéis reaparecem após rolagem, transições entre `capture`, `galleries` e `galleryDetail` preservam seleção e rolagem reiniciada.
- [ ] Desktop: rolagem via mousewheel ajusta zoom apenas quando permitido; modo ocioso/autoplay inicia e cancela corretamente.

## Mapas de responsabilidades atuais
### Serviços injetados e papéis
- `GalleryService`, `ThemeService`, `AuthService` — orquestram dados de galerias, tema e autenticação (`src/app.component.ts` linhas 540-546).
- `NgZone`, `ElementRef` — coordenação de efeitos e cálculos de layout/scroll (`src/app.component.ts` linhas 552-553).

### Principais sinais e estados
- UI principal e autoplay: `currentView`, `visibleItems`, `expandedItem`, `isAutoNavigationActive`, `autoNavigationCountdown`, `autoNavigationHintVisible`, `isFullscreen` (linhas 568-585).
- Layout responsivo e captura: `isMobileLayout`, `mobileCommandPanelVisible`, `mobileView`, `mobileCaptureGalleryId`, `captureMode`, `pendingCaptures`, `lastCapturedImage` (linhas 590-620 e 596-619).
- Diálogos e segurança: `isLoginDialogVisible`, `loginEmail`, `loginPassword`, `loginError`, `isLoginInProgress`, `isGalleryEditorVisible`, `isGalleryCreationDialogVisible`, `isInfoDialogVisible`, `canManageContent` (linhas 544-551 e 663-668).

### Host listeners e ouvintes globais
- Atalhos de teclado: `handleSpacebar`, `toggleFullscreenKey`, `handleIKey`, `handleQuitGalleryKey`, `handlePKey`, `handleEscapeKey`, `handleThemeKey`, `handleAdminAccessShortcut`, `handleZoomKeys`, `handleArrowNavigation`, `handleArrowNavigationRelease` (linhas 85-538).
- Listeners registrados em runtime: `ngOnInit` adiciona `click`, `fullscreenchange` e `wheel`; `ngAfterViewInit` adiciona listeners de ponteiro/resize; limpeza em `ngOnDestroy` (linhas 862-924).
- Controle de fullscreen: `toggleFullscreen` e `onFullscreenChange` sincronizam o estado sinalizado (linhas 1877-1891).
