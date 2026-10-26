# Google Business Profile no Garden Analytics

A integração usa GitHub Actions para atualizar uma página estática diariamente. Não precisa de Cloud Run, Secret Manager nem de uma conta de faturamento no Google Cloud.

## Secrets do repositório

No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e crie estes três secrets:

- `GBP_CLIENT_ID`: ID do cliente OAuth.
- `GBP_CLIENT_SECRET`: segredo OAuth novo, após a rotação.
- `GBP_REFRESH_TOKEN`: refresh token obtido com esse cliente OAuth e com o escopo `https://www.googleapis.com/auth/business.manage`.

Não coloque os valores no código, em variáveis `NEXT_PUBLIC_*), em commits ou nesta conversa. A rotina usa a conta `accounts/105765779662568090049` e o estabelecimento `locations/11536416076404130194`.

## Funcionamento

O workflow de publicação roda quando há alteração em `main`, pode ser iniciado manualmente e também roda diariamente. Durante o build, ele troca o refresh token por um access token e consulta as avaliações. O arquivo publicado contém somente a contagem, a média, a data mais recente e o horário da coleta. Não inclui nomes, comentários, OAuth tokens ou segredos.

Como o GitHub Pages é estático, esse resumo agregado pode ser lido publicamente. A página do Garden Analytics continua exigindo login para o painel; as funcionalidades existentes de histórico Firebase, registros manuais, CSV e scans permanecem independentes.

Se os três secrets ainda não estiverem cadastrados, o site compila e mostra que a integração aguarda configuração. Depois de cadastrá-los, execute **Actions → Publish Garden Marketing Control → Run workflow** para a primeira coleta. A rotina diária mantém os dados atualizados.

Os tokens do OAuth Playground não são presumidos nem incluídos no repositório. O refresh token precisa pertencer ao cliente OAuth rotacionado. Se a tela de consentimento OAuth estiver em modo de teste, confirme que a conta autorizada está incluída entre os usuários de teste e considere que refresh tokens de aplicativos externos em teste podem expirar após sete dias.
