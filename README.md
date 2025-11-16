<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Execução local

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
Trigger build

## Design system e tokens

Todo o estilo agora é guiado pelos tokens declarados em `src/styles/tokens.css`. Eles definem as cores, raios, sombras e tipografia de referência usados nos módulos de componentes em `src/styles/components`. Os arquivos já importados em `angular.json` seguem a ordem abaixo:

1. `tokens.css`: define variáveis CSS reativas a tema (escuro/claro);
2. `base.css`: aplica resets e registra componentes globais (shell, cartões, diálogos);
3. `utilities.css`: expõe utilitários (`stack`, `flow`, `badge`, etc.) para composição rápida de layouts.

Quando precisar estilizar um novo bloco, reutilize essas classes antes de criar algo novo. Exemplo: use `.stack` para espaçamentos verticais, `.button` + modificadores (`--ghost`, `--primary`) para botões e `.card` para estruturas com avatar/conteúdo.

## Criando novos componentes

1. Crie o componente Angular normalmente (idealmente standalone) e utilize apenas classes do design system na marcação. Evite adicionar estilos inline que repliquem tokens existentes.
2. Caso uma variação de estilo ainda não exista, crie o CSS correspondente dentro de `src/styles/components` (ou no `styles` do próprio componente) reutilizando as variáveis de `tokens.css`.
3. Referencie utilitários (`.badge`, `.stack`, `.flow`) para manter a consistência visual e atualize este README quando novos padrões forem introduzidos.
