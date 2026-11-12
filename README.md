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

A plataforma opera com pagamentos e comissões em **modo simulação**: não há cobrança, saldo real, geração de Pix ou transferências bancárias nesta versão. A primeira versão oferece cadastro e aprovação simples de motoristas. Verificação de telefone, recuperação de senha, documentos, denúncias e notificações push serão adicionados em próximas etapas. Não há dados fictícios misturados aos cadastros reais.

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

## Trajeto com endereços inteligentes, GPS e quilometragem

A etapa **Trajeto** pode sugerir endereços em Porto Velho, utilizar a localização do cliente (com permissão do navegador) e mostrar **distância por ruas** e **tempo aproximado** antes de publicar o pedido. Os motoristas veem a estimativa salva no pedido. Ela não representa um preço calculado: o valor do frete continua sendo definido em propostas.

Para ativar, configure a variável `GOOGLE_MAPS_API_KEY` no **Render > Environment** usando uma chave de API da Google Maps Platform com faturamento ativado e as APIs **Places API (New)**, **Routes API** e **Geocoding API** habilitadas. Restrinja a chave às APIs necessárias, monitore custos e aplique cotas. A chave deve ficar **apenas no servidor**, nunca no Vite/React. Consulte o fornecedor para as restrições de segurança compatíveis com requisições de servidor.

- Sugestões usam Places Autocomplete (New), priorizando Porto Velho; selecionar uma sugestão resolve endereço e coordenadas. Com a chave configurada, o sistema também tenta calcular a rota usando endereços completos digitados manualmente.
- A opção **Usar minha localização** depende de HTTPS, permissão do usuário e Geocoding API para apresentar o endereço.
- Estimativas usam Routes API para trajetos de carro. O tempo é aproximado e não constitui previsão de trânsito em tempo real.
- Sem chave, o formulário mantém os endereços manuais e permite publicar, mas **não inventa km ou tempo**. Endereços que não tenham sido selecionados nas sugestões também podem ficar sem estimativa.
- A API de mapas tem controle de frequência e não exige sessão nem conexão MongoDB. O login e a publicação do frete continuam exigindo MongoDB funcionando.
- O servidor recalcula a distância quando publica o frete, sem confiar nos quilômetros enviados pelo navegador.
- O resumo oferece link para abrir o percurso no Google Maps. O mapa embutido pode ser acrescentado depois da validação da rota.


## Alternar contas no topo para testes

Depois de entrar no primeiro perfil, aparece uma faixa **Testar como: Cliente · Motorista · Master** no topo da interface. Cada perfil tem **login real independente**: entre uma única vez em cada conta, usando seu próprio celular e senha. Depois, clique na opção correspondente para alternar instantaneamente entre os painéis **na mesma aba**. O indicador verde mostra os perfis já conectados.

O seletor **não concede permissões**: uma conta de Cliente nunca recebe os poderes de Motorista ou Master. O backend exige o cookie HttpOnly correspondente ao perfil selecionado e valida a função da conta no banco de dados. As sessões têm duração de sete dias, salvo saída manual ou expiração.

- O botão **Sair desta conta** encerra somente o perfil atual; os demais permanecem conectados.
- Sessões anteriores à atualização continuam sendo reconhecidas enquanto válidas.
- A primeira entrada em cada perfil exige login ou cadastro normal. Se ainda não tiver motorista, crie uma conta e aprove-a pelo Master para testar as propostas.
- Para maior segurança, evite conectar Master em celulares ou computadores compartilhados. No computador de testes, encerre as três sessões ao terminar.


## Financeiro FreteOn — modo integral de simulação

> **ATENÇÃO:** esta versão não recebe pagamentos reais, não gera cobranças reais e não realiza Pix. Todas as ações são registros fictícios de teste, inclusive os botões "Confirmar quitação" e "Confirmar repasse".

### Formas de pagamento na solicitação de frete

O cliente deve escolher **Dinheiro ao motorista**, **Cartão na maquininha do motorista** ou **Pix pelo FreteOn (simulado)** na etapa Agendamento. O método fica fixo para aquele pedido, visível para os motoristas antes de enviar propostas e também nos detalhes.

O motorista precisa ativar **Aceito cartão na minha própria maquininha** na página **Minha carteira** antes de poder propor fretes em cartão. Para dinheiro/cartão, o cliente paga diretamente ao motorista fora do FreteOn; as taxas da maquininha são consideradas pelo motorista ao propor o preço. Para Pix pelo FreteOn, o cliente apenas confirma uma **simulação fictícia de pagamento** depois de contratar a proposta e antes do motorista iniciar o serviço.

### Comissão e prazo de 72h

A comissão fixa de **10%** é calculada no backend sobre o preço final da proposta escolhida, com valores armazenados em centavos para evitar erros de arredondamento.

- Dinheiro e cartão: após o motorista concluir e o cliente confirmar a entrega e o recebimento, nasce uma comissão **pendente** com vencimento exatamente **72h depois da confirmação**. O motorista pode informar no painel que enviou a comissão *apenas em simulação*; o Master deve registrar a quitação manual simulada.
- Passadas as 72h sem quitação e sem contestação aberta, o motorista fica **impedido de enviar novas propostas** ou ser escolhido para novos fretes. Ele permanece apto a acessar o painel/carteira e terminar fretes já contratados.
- Pix simulado pelo FreteOn: após conclusão e confirmação da entrega, surge um saldo líquido **disponível** para o motorista solicitar um repasse. É necessário cadastrar uma chave Pix na carteira. Depois do pedido, o Master marca **repasse manual realizado (simulado)**. Nenhum valor é realmente enviado.
- O Master vê valores pendentes, comissões vencidas, solicitações de repasse, a chave Pix do motorista e a situação de cada pedido.
- Caso o cliente abra contestação depois da conclusão, o financeiro do frete fica suspenso enquanto o Master avalia. O Master pode reconhecer a entrega ou dispensar os valores simulados. **Nenhuma reversão de um pagamento verdadeiro acontece nesta versão.**
- Pedidos criados antes desta implementação **não recebem comissão retroativa** e continuam funcionando sem método de pagamento financeiro.

### Teste ponta a ponta

1. Entre como motorista. Em **Minha carteira**, salve a chave Pix de teste e habilite cartão caso queira oferecer fretes de cartão.
2. Entre como cliente, crie um frete e selecione a modalidade de pagamento no Agendamento.
3. Envie a proposta pelo motorista, conferindo o resumo de comissão de 10% e o método de pagamento em destaque.
4. Escolha a proposta pelo cliente. Se escolheu **Pix pelo FreteOn**, clique **Simular pagamento Pix**; o motorista não consegue iniciar antes disso.
5. O motorista inicia e conclui o frete. O cliente confirma entrega e, para dinheiro/cartão, pagamento direto ao motorista.
6. Para dinheiro/cartão, o motorista vê a comissão pendente e seu vencimento. Clique **Informar comissão enviada (simulação)**; no Master > **Financeiro**, clique **Confirmar quitação**.
7. Para Pix simulado, o motorista solicita o saldo líquido em **Minha carteira**; no Master > **Financeiro**, clique **Confirmar repasse manual (simulação)**.
8. Para testar suspensão de 72 horas, ajuste **apenas em ambiente de teste** a data `commissionDueAt` de um pedido pendente para o passado no MongoDB. O backend bloqueará novas propostas e liberará automaticamente após o Master registrar a comissão como quitada.

**Antes de ligar pagamentos reais**, será necessário contratar um provedor de pagamento compatível, verificar obrigações legais/tributárias, formalizar termos de cancelamento e contestação e implementar confirmações bancárias verificadas no servidor. Não basta remover a palavra "simulação" da interface.

## Fotos de perfil, imagens do frete e confirmação automática da entrega

- Cliente e motorista podem cadastrar, trocar ou remover a foto em **Meu perfil**. A imagem JPG/PNG/WebP é compactada no navegador (máximo de 400 px por lado) e validada no servidor antes de ser salva no MongoDB. A foto aparece no avatar e, para motoristas, na proposta apresentada ao cliente.
- As fotos anexadas ao pedido aparecem como **miniatura no card** do frete e na galeria dos detalhes para cliente e motorista. É possível tocar em uma foto para ampliá-la. Pedidos sem fotos exibem uma mensagem informativa; nenhum arquivo é inventado.
- A distância e a duração são calculadas pelas ruas via Routes API quando `GOOGLE_MAPS_API_KEY` estiver configurada. Endereços digitados manualmente também são aceitos. Para fretes antigos sem cálculo, use **Calcular km** nos detalhes. Se a chave não estiver configurada, o sistema mostra **Distância ainda não calculada** e oferece **Consultar trajeto no Google Maps**, sem inventar números.
- Depois que o motorista marca o frete como **Concluído**, o cliente recebe um **modal automático** ao abrir o painel ou na próxima atualização com a página aberta (cerca de 15 segundos). Nele pode confirmar a entrega, informar problema ou avaliar o motorista de 1 a 5 estrelas. Após confirmar a entrega, o mesmo modal passa a oferecer a avaliação.
- O modal pode ser fechado e há um **aviso persistente no painel** para reabri-lo sem precisar acessar Histórico. Reaparece ao iniciar nova sessão na interface se ainda houver confirmação ou avaliação pendente.
- Para fretes com modalidade financeira, a avaliação só pode ser registrada depois da confirmação da entrega. O sistema financeiro permanece inteiramente no modo **simulação**, sem pagamento real.

