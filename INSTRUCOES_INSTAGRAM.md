# Integração com o Instagram

Este documento descreve os passos necessários para modificar a aplicação e exibir as fotos de uma conta do Instagram na galeria.

**Aviso:** Este processo é complexo e envolve a criação de uma aplicação no painel da Meta (Facebook), a implementação de um fluxo de autenticação seguro (OAuth 2.0) e a comunicação com a API do Instagram. As instruções abaixo são um guia de alto nível.

---

### Passo 1: Registrar uma Aplicação na Plataforma da Meta

Antes de poder acessar os dados do Instagram, você precisa registrar sua aplicação na Meta.

1.  **Acesse o Portal de Desenvolvedores da Meta:** Vá para [https://developers.facebook.com/](https://developers.facebook.com/) e crie uma conta de desenvolvedor, se ainda não tiver uma.
2.  **Crie um Novo App:** No painel "Meus aplicativos", crie um novo aplicativo do tipo "Outro" e, em seguida, "Consumidor".
3.  **Adicione o Produto "Instagram Basic Display":** No painel do seu novo aplicativo, encontre a seção "Adicionar produtos" e configure o "Instagram Basic Display".
4.  **Crie um App de Teste:** Siga as instruções para criar um aplicativo de teste do Instagram. Você precisará fornecer:
    *   **URL de Redirecionamento do OAuth:** A URL para a qual o Instagram irá redirecionar o usuário após a autorização. Para desenvolvimento local, você pode usar `http://localhost:3000/auth/instagram/callback` (seria necessário criar essa rota na aplicação).
    *   **URL de Cancelamento:** A URL para a qual o usuário é enviado se cancelar o fluxo de autorização.
5.  **Adicione um Usuário de Teste:** Na seção "Funções" > "Usuários de teste do Instagram", adicione a conta do Instagram da qual você deseja buscar as fotos. A conta adicionada precisará aceitar o convite no aplicativo do Instagram em "Configurações" > "Aplicativos e sites".
6.  **Obtenha suas Credenciais:** Anote o **ID do Aplicativo** e a **Chave Secreta do Aplicativo**. **A chave secreta é confidencial e nunca deve ser exposta no código do frontend.**

---

### Passo 2: Implementar o Fluxo de Autenticação OAuth 2.0

OAuth 2.0 é o padrão usado pelo Instagram para permitir que sua aplicação acesse os dados de um usuário de forma segura.

1.  **Criar um Botão de Login:** Adicione um botão "Login com Instagram" na interface da aplicação.
2.  **Redirecionar para a Autorização:** Ao clicar no botão, a aplicação deve redirecionar o usuário para a URL de autorização do Instagram, incluindo seu `app-id` e a `redirect-uri`.
    ```
    https://api.instagram.com/oauth/authorize
      ?client_id={app-id}
      &redirect_uri={redirect-uri}
      &scope=user_profile,user_media
      &response_type=code
    ```
3.  **Trocar o Código por um Access Token:**
    *   Após o usuário autorizar, o Instagram o redirecionará de volta para a sua `redirect-uri` com um `code` na URL.
    *   **Importante:** A próxima etapa **deve** ser feita em um **backend seguro** (ex: Node.js, Python), nunca no frontend. O frontend envia o `code` para o seu backend.
    *   Seu backend fará uma requisição POST para a API do Instagram, enviando o `client_id`, `client_secret` e o `code` para trocá-lo por um **Access Token** de curta duração.
4.  **Armazenar o Access Token:** O backend deve armazenar o Access Token de forma segura, associado ao usuário.

---

### Passo 3: Buscar as Fotos do Usuário

Com o Access Token em mãos, seu backend pode finalmente buscar as mídias do usuário.

1.  **Fazer a Requisição à API:** O backend fará uma requisição GET para o endpoint `https://graph.instagram.com/me/media`, incluindo o Access Token.
    ```
    https://graph.instagram.com/me/media
      ?fields=id,media_type,media_url,timestamp
      &access_token={access-token}
    ```
2.  **Filtrar os Resultados:** A API retornará uma lista de todas as mídias (fotos e vídeos). Você pode filtrar para incluir apenas as do tipo `IMAGE`.
3.  **Expor os Dados para o Frontend:** O backend deve expor um novo endpoint (ex: `/api/instagram-photos`) que o frontend Angular possa chamar para obter a lista de URLs das imagens.

---

### Passo 4: Integrar com a Galeria Angular

Finalmente, com o backend fornecendo as URLs, a aplicação Angular pode ser modificada.

1.  **Modificar o `GalleryService`:** O `gallery.service.ts` seria alterado. Em vez de usar uma lista de imagens estática, ele faria uma requisição HTTP para o seu backend (`/api/instagram-photos`).
2.  **Atualizar a Galeria:** O serviço preencheria o `signal` de imagens com as URLs recebidas do backend, e a galeria automaticamente renderizaria as fotos do Instagram.
