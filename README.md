# Garden Marketing Control — Firebase + GitHub Pages

Projeto React/Next.js configurado para `output: export` em `/garden-marketing-control`.

## Banco e login

- Firebase Authentication (Email/Senha) e Firestore.
- Documento único por usuário: `users/{uid}/data/workspace`.
- Regras: `match /users/{userId}/data/{documentId} { allow read, write: if request.auth != null && request.auth.uid == userId; }`.
- Dados da conta sincronizam ao abrir outros computadores com o **mesmo login**.
- Outros usuários possuem dados separados. A opção de compartilhamento multiusuário precisa de outra arquitetura.
- Edição simultânea do mesmo workspace em dois PCs não tem controle sofisticado de conflitos: não edite ao mesmo tempo.

## Publicação gratuita

`npm install && npm run build` gera a pasta `out/` para publicação estática no GitHub Pages.
As variáveis NEXT_PUBLIC_FIREBASE_* são configuração pública do Firebase Web, não credenciais secretas.
Configure no Firebase Authentication > Settings > Authorized domains: `site-proj.github.io`.
Configure GitHub Actions para exportar e publicar `out/` no GitHub Pages.

## Importante

O Firebase foi pré-configurado com dados públicos do SDK web. Não inclua senhas no GitHub.
O conteúdo de dados só deve ficar no Firestore protegido por regras, nunca no repositório.
Faça exportações JSON periódicas. Até os testes de ponta a ponta, não use como fonte única de dados importantes.
