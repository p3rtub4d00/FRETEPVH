# Asaas no FreteOn

Integração exclusiva de produção para Pix de frete e comissão. Dinheiro/cartão pagos diretamente ao motorista continuam no fluxo existente. Repasse ao motorista continua manual e exige comprovante no Master; esta integração não inicia transferências automáticas.

## Variáveis no Render

| Variável | Valor |
| --- | --- |
| ASAAS_ENABLED | true |
| ASAAS_ENV | production |
| ASAAS_API_KEY | Preencher com a chave de produção da conta recebedora |
| ASAAS_WEBHOOK_TOKEN | Segredo aleatório de 32 a 255 caracteres, sem espaços; não usar a API key |
| ASAAS_PUBLIC_URL | https://fretepvh.onrender.com |
| ASAAS_WEBHOOK_EMAIL | Opcional; vazio usa o e-mail do webhook existente ou da conta Asaas |

Nunca colocar a chave ou token neste documento, no GitHub ou no frontend. O endpoint da API é fixo em `https://api.asaas.com/v3`. Sem chave ou configuração completa, gerar Pix fica bloqueado. Depois de preencher a chave, salvar e implantar no Render e selecionar **Asaas** em **Banco preferencial para receber Pix** no Master. O banco atualmente selecionado não é alterado durante a implantação.

Antes da primeira cobrança, o servidor configura o webhook em `/api/asaas/webhook`, preservando outros webhooks da conta. A chave precisa permitir clientes, cobranças, estornos e configuração de webhooks. A leitura dos dados comerciais serve apenas para obter o e-mail; não altera o cadastro bancário. Se essa leitura estiver restrita, preencher ASAAS_WEBHOOK_EMAIL. Se a configuração do webhook falhar, nenhuma cobrança é criada.

## Confirmação e estorno

O valor vem do frete no servidor. A reserva atômica mantém o mesmo provedor, mesmo que o banco preferido mude enquanto o Pix está sendo criado. Criação de pagamento com resposta incerta não é repetida: a cobrança é buscada pela referência externa. Se continuar incerta, conferir a referência da ordem no Asaas; nunca excluir a ordem local para tentar outra cobrança.

O webhook valida o token, persiste o evento e responde HTTP 200. A fila consulta o próprio Asaas e aplica a mudança em transação MongoDB, verificando identificador, referência, pagador, método e valor. Eventos pendentes sobrevivem à reinicialização; são processados enquanto a instância está ativa. A consulta da tela de pagamento também concilia o banco.

Somente `RECEIVED` comprova recebimento Pix. `CONFIRMED` continua aguardando liquidação. Devoluções parciais, valores inesperados e pagamentos após cancelamento ficam em análise e bloqueiam liberação de repasse.

A aprovação do estorno suspende repasse e cancela o frete antes da chamada bancária. Somente `REFUNDED` com estornos `DONE` somando o valor integral conclui a devolução. Resposta incerta não gera nova solicitação bancária. O botão **Consultar ou retomar devolução Asaas** consulta novamente e só reenvia quando a tentativa anterior foi definitivamente recusada. Saldo insuficiente ou estorno negado devem ser conferidos no Asaas.

Registros financeiros Asaas ficam protegidos contra limpeza/exclusão. Asaas não exige alterar as credenciais dos demais bancos.

## Validação

Testes automatizados usam respostas simuladas, sem cobranças reais: autenticação, produção obrigatória, valor calculado no servidor, duplicação, recuperação após timeout, troca de provedor, liquidação, comissão, estorno e divergências. Após inserir a chave é necessário validar uma cobrança real autorizada e conferir recebimento, webhook e estorno na conta. Os testes locais não validam credenciais ou liberação bancária.

Referências oficiais consultadas:
- https://docs.asaas.com/reference/criar-nova-cobranca
- https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix
- https://docs.asaas.com/reference/criar-novo-webhook
- https://docs.asaas.com/reference/estornar-cobranca
- https://docs.asaas.com/docs/estornos
