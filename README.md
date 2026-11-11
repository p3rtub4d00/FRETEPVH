# FreteOn

Plataforma de fretes com propostas de motoristas, começando por Porto Velho, RO.

## Etapa atual

Versão 0.1 para aprovação da interface. Cliente, Motorista e Master são áreas navegáveis de demonstração, acessíveis pelo seletor no topo. Dados fictícios e alterações ficam no navegador via localStorage. A troca de área serve exclusivamente para testar a experiência.

O fluxo permite solicitar frete em etapas, incluir até três fotos, enviar propostas na área Motorista, escolher uma oferta na área Cliente, iniciar e concluir o transporte e avaliar. Também inclui histórico, disponibilidade e análise simulada de motoristas.

## Executar

Requer Node.js 22 ou 24.

```sh
npm run build
npm start
```

Acesse http://localhost:3001. O backend serve a interface compilada e `/api/health`.

Para desenvolver a interface, execute `npm run dev` após instalar as dependências.

## Render

Configure um Web Service conectado a este repositório.

| Campo             | Valor         |
| ----------------- | ------------- |
| Branch            | main          |
| Root Directory    | vazio         |
| Build Command     | npm run build |
| Start Command     | npm start     |
| Health Check Path | /api/health   |

Se já existir um serviço com Root Directory `backend`, também é suportado usar Build Command `npm ci && npm run build` e Start Command `npm start`.

`PORT` é fornecida pelo Render. `MONGODB_URI` é opcional nesta prévia. Quando informada, o servidor verifica a conexão, mas os pedidos de demonstração continuam locais. Se a conexão falhar, a inicialização falha com mensagem sem expor a URI.

## Próxima etapa

Após aprovação visual, implementar autenticação por telefone e senha, autorização de cada perfil, modelos e persistência no MongoDB, upload privado de documentos, moderação, notificações reais, denúncias e relatórios. Pagamentos reais ficam fora do escopo inicial.

## PWA

Manifesto e ícones incluídos. O service worker armazena a interface para reabertura offline após a primeira visita. A instalação depende de HTTPS e suporte do navegador. API e recursos externos não entram no cache.

## Restauração

O conteúdo anterior está preservado na branch `restauracao/antes-freteon-2026-11-11`, no commit `e41c6d6cb2366e3fb5e104d35e5617971f9f8b68`. Antes de alterações importantes, criar uma nova branch de restauração a partir do estado atual.
