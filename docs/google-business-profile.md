# Google Business Profile no Garden Analytics

A integração usa GitHub Actions para atualizar uma página estática diariamente. Não precisa de Cloud Run, Secret Manager nem de uma conta de faturamento no Google Cloud.

## Secrets do repositório

No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e crie estes três secrets:

- `GBP_CLIENT_ID`: ID do cliente OAuth.
- `GBP_CLIENT_SECRET`: segredo OAuth novo, após a rotação.
- `GBP_REFRESH_TOKEN`: refresh token concedido por esse cliente OAuth com o escopo `https://www.googleapis.com/auth/business.manage`.

Não coloque os valores no código, em variáveis `NEXT_PUBLIC_*`, em commits, em issues ou nesta conversa. A rotina usa a conta `accounts/105765779662568090049` e o estabelecimento `locations/11536416076404130194`.

## Funcionamento

O workflow de publicação roda quando há alteração em `main`, pode ser iniciado manualmente e também roda diariamente. Durante o build, ele troca o refresh token por um access token e consulta as avaliações. O arquivo publicado contém somente a contagem, a média, a data mais recente e o horário da coleta. Não inclui nomes, comentários, OAuth tokens ou segredos.

Como o Garden Studio usa GitHub Pages estático, o arquivo agregado pode ser acessado publicamente, mesmo que a página do Analytics exija login. As funcionalidades existentes de histórico Firebase, registros manuais, CSV e scans permanecem independentes.

Se os três secrets ainda não estiverem cadastrados, o site compila e informa que a integração aguarda configuração. Depois de cadastrá-los, integre o PR e execute **Actions → Publish Garden Marketing Control → Run workflow** para a primeira coleta. A rotina diária mantém os dados atualizados.

Os tokens do OAuth Playground não são presumidos nem incluídos no repositório. O refresh token precisa pertencer ao cliente OAuth rotacionado. Se a tela de consentimento OAuth estiver em modo de teste, inclua a conta autorizada entre os usuários de teste; refresh tokens de aplicativos externos em teste podem expirar após sete dias.
