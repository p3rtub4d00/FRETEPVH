# FreteOn

Plataforma de fretes com propostas de motoristas, começando por Porto Velho, RO.

## Acessos

| Endereço              | Uso                                                 |
| --------------------- | --------------------------------------------------- |
| `/`                   | Página pública com entrada de clientes e motoristas |
| `/cliente`            | Login e painel do cliente                           |
| `/cliente/cadastro`   | Cadastro de cliente                                 |
| `/motorista`          | Login e painel do motorista                         |
| `/motorista/cadastro` | Cadastro de motorista e veículo                     |
| `/master`             | Login e painel do administrador                     |

Cadastro com nome, celular com DDD e senha de 8 a 128 caracteres. O telefone aceita formatação e prefixo +55. Cada telefone identifica uma conta. O motorista informa o veículo e aguarda aprovação do Master. Após aprovado, ativa sua disponibilidade no painel.

Usuários, sessões, pedidos, fotos, propostas e avaliações são persistidos no MongoDB. As permissões são verificadas na API. O registro público aceita somente Cliente e Motorista. A sessão usa cookie HttpOnly, SameSite=Lax e Secure em produção. Senhas usam scrypt com salt individual.

## Render

Requer Node.js 22 ou 24. O repositório está configurado para um Web Service.

| Campo             | Valor         |
| ----------------- | ------------- |
| Branch            | main          |
| Root Directory    | vazio         |
| Build Command     | npm run build |
| Start Command     | npm start     |
| Health Check Path | /api/health   |

Configure `MONGODB_URI` com sua conexão. Também são aceitos `MONGO_URI` e `MONGO_URL`. A aplicação exige uma conexão válida antes de iniciar. `PORT` é fornecida pelo Render.

### Primeira conta Master

Em Environment do serviço, defina `ADMIN_PHONE` com um celular de 11 dígitos, incluindo DDD, e `ADMIN_PASSWORD` com uma senha particular de 8 a 128 caracteres. Opcionalmente defina `ADMIN_NAME`.

Salve e publique novamente. Se não existir Master, a inicialização cria essa conta no MongoDB. Entre em `/master`. Use um número ainda não cadastrado como Cliente ou Motorista. Após o primeiro acesso, as variáveis de criação podem ser removidas. Alterar essas variáveis depois não troca a senha de uma conta existente.

Nunca coloque valores reais de credenciais no GitHub.

## Desenvolvimento

Instale e compile com `npm run build`. Configure `backend/.env` a partir de `.env.example`, usando um banco separado para testes, e rode `npm start`. A aplicação abre em http://localhost:3001.

Para desenvolver a interface com atualização automática, rode também `npm run dev`. O Vite encaminha `/api` para a porta 3001.

## Fluxo para testar

1. Cadastre um cliente e um motorista com celulares diferentes.
2. Entre no Master e aprove o motorista.
3. No painel do motorista, ative a disponibilidade.
4. No cliente, publique um frete com data futura, endereços completos e detalhes da carga.
5. No motorista, envie uma proposta com valor e horário.
6. No cliente, escolha e confirme a proposta.
7. No motorista contratado, inicie e conclua o transporte.
8. No cliente, avalie o frete concluído.

Use navegadores ou perfis separados para testar simultaneamente. As abas de um mesmo perfil compartilham a sessão. O painel consulta atualizações a cada 15 segundos. A escolha de proposta usa controle de versão do MongoDB para evitar duas contratações concorrentes no mesmo pedido.

## Escopo desta etapa

Pagamentos são combinados diretamente. A primeira versão oferece cadastro e aprovação simples de motoristas. Verificação de telefone, recuperação de senha, documentos, denúncias e notificações push serão adicionados em próximas etapas. Não há dados fictícios misturados aos cadastros reais.

Fotos da carga são limitadas a três arquivos JPG, PNG ou WebP de 600 KB cada e ficam no documento do frete no MongoDB nesta versão inicial. O service worker guarda apenas recursos da interface e ignora a API. Operações e autenticação exigem internet.

## Restauração

- `restauracao/antes-freteon-2026-11-11` preserva o projeto anterior à identidade FreteOn.
- `restauracao/antes-login-2026-11-11` preserva a demonstração anterior ao cadastro e login.

## Diagnóstico de conexão e acesso Master

1. Em **MongoDB Atlas > Database > Connect > Drivers**, copie a string de conexão do cluster **correto** e substitua os campos de usuário e senha. Não utilize o endereço de exemplo, caracteres `<`/`>` nem aspas extras. Codifique caracteres especiais na senha conforme o formato de URI.
2. No **Render > serviço FreteOn > Environment**, defina `MONGODB_URI` com a string completa. As variáveis `MONGO_URI`, `MONGO_URL` e `MONGODB_URL` também são aceitas, mas evite manter múltiplas URIs conflitantes.
3. **`ENOTFOUND` ou `querySrv`:** o DNS não encontrou o host do cluster; geralmente é um endereço incorreto ou indisponibilidade de resolução SRV. Isso não é um erro de login do Master. Confirme o domínio do cluster com a conexão copiada do Atlas. Se necessário, use a conexão **Standard Connection String (`mongodb://`) gerada pelo próprio Atlas**, com todos os hosts/parâmetros exigidos — nunca invente endereços.
4. **Falha de autenticação:** confira o usuário do banco em **Database Access**; ele é diferente do login da conta Atlas. **Timeout de conexão:** examine o cluster e as regras de **Network Access**. Não é necessário liberar IPs indiscriminadamente para corrigir um erro de DNS.
5. Confira o status de `/api/health`: retorna HTTP 200 quando o banco está conectado e 503 quando está indisponível. O startup escreve no log o estágio do problema sem expor a senha nem a URI.
6. Para o primeiro Master, defina `ADMIN_PHONE` (celular com DDD, 11 dígitos, sem `+55` obrigatório) e `ADMIN_PASSWORD` (8–128 caracteres). Acesse `/master` e use **o celular, não um e-mail**. Uma conta Master existente mantém a senha já salva no banco; mudar essas variáveis **não redefine senha** e não cria uma segunda conta Master.

**Segurança:** nunca envie a URI ou as senhas completas em mensagens, capturas públicas ou commits. Para análise de um erro, compartilhe apenas o código (por exemplo, `ENOTFOUND`) e o estágio mostrado no log.
