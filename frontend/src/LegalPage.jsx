import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { api } from "./api.js";

export const LEGAL_VERSION = "2026-11-13.2";
export const legalPaths = ["/termos", "/privacidade"];

const terms = [
  {
    title: "1. Identificação, escopo e natureza da plataforma",
    paragraphs: [
      "O FreteOn é uma plataforma tecnológica de intermediação que aproxima clientes interessados em contratar fretes e motoristas autônomos ou empresas que ofereçam transporte de cargas. Seu papel é disponibilizar cadastro, publicação de pedidos, propostas, contratação, avaliações e registros operacionais.",
      "O FreteOn não se apresenta como transportadora, não possui a carga, não realiza diretamente o transporte, não emprega os motoristas cadastrados e não presta, por meio destes Termos, serviço de seguro, guarda ou depósito de bens. O contrato de transporte é formado diretamente entre cliente e motorista ou transportador escolhido.",
      "Esta delimitação das atividades não afasta a responsabilidade legal do FreteOn por falhas próprias, informações enganosas, tratamento indevido de dados ou outros fatos pelos quais a lei o considere responsável. Nenhuma disposição restringe direitos indisponíveis de consumidores e usuários."
    ]
  },
  {
    title: "2. Aceitação e elegibilidade",
    paragraphs: [
      "O uso dos recursos de contratação da plataforma depende da aceitação dos Termos de Uso e da ciência da Política de Privacidade. O registro eletrônico da data e da versão aceitas poderá ser conservado para prova da relação contratual.",
      "O usuário declara ser maior de 18 anos, civilmente capaz e responsável pela veracidade de seu cadastro. É proibido utilizar identidade de terceiros, criar contas fraudulentas ou transferir o acesso sem autorização."
    ]
  },
  {
    title: "3. Cadastro e segurança da conta",
    paragraphs: [
      "Cliente e motorista devem manter nome, número de celular, senha e demais informações de cadastro corretos. O motorista também informa seu veículo e suas modalidades de recebimento. Aprovação de cadastro, quando existente, não representa certificação de qualidade, seguro, habilitação ou regularidade permanente do transportador.",
      "Para novas propostas e contratações, o motorista deve apresentar CNH, CRLV, selfie, placa, validade documental e dados de registro de transporte quando aplicáveis. A administração verifica os arquivos manualmente. O selo indica somente a revisão documental realizada, não representa garantia de transporte, seguro ou ausência de risco. Documentos incompletos, reprovados ou vencidos suspendem novas propostas, preservando a gestão dos fretes já contratados.",
      "Cada usuário deve proteger suas credenciais e comunicar uso suspeito. A plataforma poderá solicitar atualização cadastral e realizar verificações proporcionais para segurança e prevenção a fraudes."
    ]
  },
  {
    title: "4. Obrigações do cliente",
    paragraphs: [
      "O cliente deve informar com exatidão endereços, tipo de objeto, dimensões, peso estimado, quantidade, condições de acesso, escadas, necessidade de ajudantes, data, horário, riscos de manuseio e informações relevantes para o preço e a segurança.",
      "Compete ao cliente ser legítimo possuidor ou autorizado a transportar os bens, providenciar embalagem adequada ao tipo de carga quando aplicável, identificar objetos frágeis, garantir acesso seguro aos locais e estar disponível para entrega e recebimento.",
      "O cliente não deve solicitar transporte de objetos ilícitos, perigosos ou que exijam autorizações especiais sem cumprir as exigências legais e sem acordo expresso com o transportador."
    ]
  },
  {
    title: "5. Obrigações legais e operacionais do motorista",
    paragraphs: [
      "O motorista é o prestador responsável pela execução efetiva do transporte contratado. Deve manter documentação pessoal e veicular válida, habilitação apropriada, condições de segurança, equipamentos necessários e autorizações ou registros legalmente exigidos, inclusive o RNTRC quando a atividade estiver sujeita à regulação da ANTT.",
      "Cabe ao motorista avaliar a compatibilidade da carga com seu veículo, conferir informações de coleta e entrega, informar condições e custos antes da proposta, observar normas de trânsito, acondicionar e fixar a carga adequadamente e adotar cuidados razoáveis para evitar avarias, extravios e acidentes.",
      "O motorista não pode oferecer serviço que não tem condições de realizar, exigir pagamentos inesperados, transportar carga proibida ou substituir o prestador contratado sem ciência e aprovação do cliente."
    ]
  },
  {
    title: "6. Propostas, escolha e formação do contrato de transporte",
    paragraphs: [
      "O cliente publica sua necessidade, os motoristas apresentam propostas e o cliente escolhe uma delas. Com a aceitação, cliente e transportador celebram diretamente o ajuste relativo à execução do serviço.",
      "O preço contratado deve refletir o serviço anunciado. Qualquer acréscimo por ajudantes, deslocamento, escadas, pedágios, estacionamento, espera ou outra condição não prevista depende de informação prévia e aceitação expressa, observadas as normas aplicáveis.",
      "Estimativas de distância, duração e rota são referenciais e podem variar conforme trânsito, acesso, condições da via e disponibilidade dos serviços de mapa."
    ]
  },
  {
    title: "7. Guarda, integridade da carga e responsabilidade pelo transporte",
    paragraphs: [
      "A coleta, o acondicionamento sob controle do transportador, a guarda durante o trajeto, a condução do veículo e a entrega dos objetos integram a atividade do motorista ou transportador contratado. Danos, perdas, atrasos, extravios, furtos e outras ocorrências serão avaliados segundo o contrato de transporte, a legislação aplicável, a prova disponível e a responsabilidade efetiva de cada envolvido.",
      "O FreteOn, enquanto intermediador, não assume a posse física dos bens e não oferece garantia automática de indenização de carga. Contudo, esta previsão não elimina sua responsabilidade por falhas comprovadas em serviços que ele próprio fornece nem eventual responsabilidade decorrente de normas de proteção ao consumidor.",
      "Os usuários devem documentar as condições dos objetos antes da retirada e depois da entrega quando necessário. Fotografias e registros não substituem prova pericial ou documental quando exigida."
    ]
  },
  {
    title: "8. Objetos proibidos ou sujeitos a regras especiais",
    paragraphs: [
      "É vedado utilizar o FreteOn para solicitar ou executar transporte de bens cuja circulação seja proibida, produtos roubados ou de procedência ilícita, explosivos, armas ou munições sem as autorizações legais, substâncias perigosas sem licenciamento, pessoas como passageiros em veículo de carga e quaisquer itens incompatíveis com a legislação aplicável.",
      "Transporte de animais, medicamentos, alimentos perecíveis, produtos químicos, objetos de valor elevado ou outras cargas especiais depende de condições técnicas e legais próprias; não há autorização implícita pelo simples anúncio no aplicativo. O transportador deve recusar cargas incompatíveis com a lei ou com sua capacidade."
    ]
  },
  {
    title: "9. Modalidades de pagamento",
    paragraphs: [
      "DINHEIRO: quando escolhido, o cliente paga diretamente ao motorista nos termos da proposta aceita. O motorista é responsável por informar o recebimento e emitir eventual documento fiscal ou comprovante legalmente devido.",
      "CARTÃO NA MAQUININHA DO MOTORISTA: o pagamento é realizado diretamente ao motorista, em equipamento e contrato de adquirência próprios. As taxas da maquininha e condições de parcelamento são de responsabilidade do motorista, que deverá incorporá-las ou informá-las no preço total apresentado previamente ao cliente, respeitada a legislação sobre diferenciação de preços.",
      "PIX PELO FRETEON: na versão atual, a função é exclusivamente SIMULADA. Não há cobrança Pix verdadeira, instituição custodiante, saldo bancário real ou repasse automático. Eventual ativação de pagamentos reais exigirá integração adequada, revisão dos documentos e comunicação prévia aos usuários.",
      "Pagamentos diretos feitos ao motorista não são recebidos, processados ou estornados pelo FreteOn. Divergências sobre dinheiro, cartão, chargeback, entrega ou devolução deverão ser tratadas com o prestador e, quando cabível, por meio dos canais de atendimento e das autoridades competentes."
    ]
  },
  {
    title: "10. Comissão da plataforma: 10% sobre o frete",
    paragraphs: [
      "Para cada proposta aceita que resulte em frete concluído nos fluxos contemplados pelo sistema, a comissão da intermediação é de 10% sobre o valor total contratado, apresentada ao motorista antes de enviar a proposta e na carteira. Para pedidos antigos não abrangidos pelo financeiro, não há cobrança retroativa.",
      "Em dinheiro ou cartão na maquininha, a obrigação simulada de repassar a comissão nasce depois da conclusão do serviço e da confirmação da entrega e do recebimento pelo cliente. O vencimento ocorre 72 horas corridas após esse registro, salvo disputa aberta ou outra suspensão válida da exigibilidade.",
      "Na modalidade Pix pelo FreteOn, o sistema demonstra a dedução de 10% do valor contratual e o saldo líquido do motorista, sem movimentar dinheiro real enquanto durar a simulação. Alterações futuras de percentuais deverão ser informadas antes de novas propostas e não alterarão retroativamente condições já aceitas."
    ]
  },
  {
    title: "11. Carteira do motorista e repasses",
    paragraphs: [
      "A carteira apresenta, individualmente por frete, comissões a repassar e valores previstos para recebimento. Durante os testes, todos os saldos, confirmações de quitação e repasses Pix manuais indicados na interface são apenas registros demonstrativos.",
      "Em futura operação real, eventuais pagamentos recebidos por meio de parceiro financeiro e repasses manuais dependerão de condições contratuais, confirmação efetiva do pagamento e regras de segurança do prestador de serviços de pagamento, previamente divulgadas.",
      "O registro de uma solicitação de repasse não equivale, por si só, a pagamento concluído."
    ]
  },
  {
    title: "12. Atraso de comissão e suspensão progressiva",
    paragraphs: [
      "O motorista poderá ser avisado de comissões pendentes na carteira. Decorridas 72 horas após a confirmação da entrega e recebimento, sem a quitação da comissão exigível, o FreteOn poderá suspender temporariamente a apresentação de novas propostas e a aceitação de novos fretes.",
      "A suspensão não deve impedir o motorista de acessar a conta, consultar a cobrança, apresentar contestação, obter comprovantes ou concluir serviços já contratados. Quitada a comissão ou reconhecida a inexigibilidade, a restrição deverá ser revista ou levantada conforme as regras operacionais.",
      "Comissões submetidas a contestação legítima não devem gerar bloqueio automático enquanto houver análise. O motorista poderá pedir revisão de erro, pagamento não identificado ou lançamento incorreto pelos canais indicados na plataforma."
    ]
  },
  {
    title: "13. Cancelamentos, alterações e reembolsos",
    paragraphs: [
      "Cliente e motorista devem informar prontamente impossibilidade de comparecimento ou alteração relevante. Pedidos cancelados antes da execução seguem os registros de cancelamento disponíveis na plataforma, sem comissão retroativa e sem multa automática que não tenha sido previamente divulgada e validamente acordada.",
      "Se houver pagamento direto, eventual devolução ou indenização será apurada segundo o contrato e a legislação aplicável. Registros fictícios de Pix e estorno não representam transferência bancária real. O exercício de direitos legais do consumidor não é afastado."
    ]
  },
  {
    title: "14. Confirmação da entrega, avaliações e reclamações",
    paragraphs: [
      "O motorista sinaliza a conclusão do transporte. O cliente é convidado a confirmar entrega e, quando cabível, o pagamento direto, podendo registrar reclamação por divergência. A avaliação de uma a cinco estrelas reflete a percepção do cliente e não constitui laudo técnico.",
      "Na ocorrência de reclamação, o FreteOn poderá suspender movimentações financeiras simuladas referentes ao pedido enquanto analisa os registros, sem impedir a busca de órgãos administrativos, autoridades policiais ou Judiciário.",
      "Nenhum resultado de avaliação ou análise interna constitui renúncia a direitos legais."
    ]
  },
  {
    title: "15. Suspensão e encerramento de contas",
    paragraphs: [
      "O FreteOn poderá adotar medidas proporcionais contra fraude, perfis falsos, utilização ilícita, ameaças, discriminação, tentativas de manipular avaliações, pagamentos indevidos, riscos à segurança ou violação comprovada destes Termos.",
      "Salvo situações de risco grave, urgência, fraude ou imposição legal, o usuário deverá receber informação sobre a razão da medida e oportunidade razoável para solicitar revisão. Suspensão de novas propostas por comissão vencida segue a regra específica de 72 horas.",
      "O encerramento da conta não implica eliminação imediata de dados cuja conservação seja necessária por obrigações legais, prevenção a fraude ou exercício regular de direitos."
    ]
  },
  {
    title: "16. Independência dos usuários e ausência de vínculo trabalhista",
    paragraphs: [
      "O transportador cadastrado define livremente as propostas que deseja apresentar, dentro das regras técnicas da plataforma. A mera utilização do FreteOn não estabelece, por si só, vínculo empregatício, representação comercial ou sociedade entre motorista e plataforma.",
      "Essa descrição não afasta consequências jurídicas que venham a decorrer da realidade da prestação de serviços ou de decisão das autoridades competentes."
    ]
  },
  {
    title: "17. Seguro e proteção patrimonial",
    paragraphs: [
      "O FreteOn não oferece, na versão atual, seguro automático da carga, de responsabilidade civil do transportador ou do veículo. Cliente e motorista devem verificar, antes da contratação, a necessidade de cobertura, valor declarado e riscos específicos. Obrigações securitárias legalmente exigíveis ao transportador permanecem aplicáveis.",
      "Nenhum selo, cadastro aprovado, fotografia, avaliação ou intermediação equivale à contratação de seguro."
    ]
  },
  {
    title: "18. Limitações técnicas e indisponibilidade",
    paragraphs: [
      "A disponibilidade do aplicativo, mapas, estimativas, notificações e demais funcionalidades depende de conexão, equipamento, serviços de terceiros e manutenção. O FreteOn adotará medidas razoáveis de segurança e correção de falhas, sem prometer funcionamento ininterrupto.",
      "Notificações dentro do painel podem depender de acesso ao aplicativo; avisos push com o aplicativo fechado não devem ser presumidos sem a funcionalidade efetivamente implementada."
    ]
  },
  {
    title: "19. Proteção de dados e registros",
    paragraphs: [
      "O tratamento de dados pessoais é descrito na Política de Privacidade, acessível publicamente. O FreteOn poderá conservar registros estritamente necessários à segurança, prevenção a fraudes, execução dos contratos, cumprimento de obrigações legais e exercício de direitos, sempre respeitando a LGPD.",
      "O compartilhamento de endereço e informações de frete com motorista interessado ocorrerá na medida necessária à avaliação e realização do transporte; os usuários devem utilizá-los somente para esse fim."
    ]
  },
  {
    title: "20. Atualização dos Termos e direitos legais",
    paragraphs: [
      "Alterações relevantes serão comunicadas por meios apropriados. Quando necessário, será solicitada nova aceitação para continuidade do uso dos serviços. A versão aceita será registrada na conta.",
      "Os direitos previstos no Código de Defesa do Consumidor, no Código Civil, na legislação de transporte, na LGPD e em outras normas aplicáveis prevalecem sobre qualquer cláusula incompatível. Controvérsias podem ser submetidas aos órgãos de proteção ao consumidor e à Justiça competente, observadas as regras legais de foro."
    ]
  },
];

const privacy = [
  {
    title: "1. Quem trata seus dados",
    paragraphs: [
      "FreteOn é o nome comercial da plataforma de intermediação disponível em fretepvh.onrender.com. O responsável jurídico pela operação e seu CNPJ precisam ser confirmados e informados integralmente antes do lançamento comercial. Esta é a versão de testes dos documentos.",
      "O canal de contato para solicitações de privacidade é o formulário ao final desta Política. As solicitações ficam disponíveis à administração e podem exigir confirmação de identidade antes da entrega de dados pessoais."
    ]
  },
  {
    title: "2. Quais dados são coletados",
    paragraphs: [
      "Conta: nome, telefone, função na plataforma, senha protegida por hash, data de cadastro, aceite dos Termos e ciência da Política, fotografia de perfil caso enviada, informações do veículo e situação de aprovação do motorista.",
      "Verificação de motoristas: fotografias da CNH, do CRLV e selfie, placa, validade da habilitação, exercício do documento veicular, RNTRC informado quando aplicável, data e resultado da revisão e eventual motivo de correção. Não há reconhecimento facial automatizado nesta etapa; as imagens são analisadas manualmente pela administração.",
      "Fretes: endereço de coleta e entrega, título, descrição, fotos dos objetos, veículo solicitado, data, horário, estimativa de rota quando disponível, propostas, valores, modalidade de pagamento, aceite, status da entrega, avaliação e registros de contestação.",
      "Carteira: chave Pix informada voluntariamente pelo motorista, valores simulados de comissão, solicitações de repasse, quitação fictícia e datas de movimentação no sistema. O FreteOn atualmente não solicita dados completos de cartão bancário nem processa Pix real.",
      "Dados técnicos: cookies de sessão, identificadores, registros de acesso e eventos necessários à segurança, prevenção a abuso e operação. Localização GPS é acessada apenas se o usuário optar por fornecê-la e o navegador autorizar."
    ]
  },
  {
    title: "3. Finalidades e bases legais",
    paragraphs: [
      "Os dados são usados para criar e autenticar contas, aproximar clientes e motoristas, publicar pedidos, permitir propostas, apresentar informações necessárias ao frete, registrar contratações, controlar comissões simuladas, combater fraudes, prestar suporte e responder a solicitações legais.",
      "As bases legais podem incluir execução de contrato e procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse devidamente avaliado e consentimento apenas quando efetivamente exigido. A aceitação dos Termos não equivale a consentimento genérico para todo tratamento de dados."
    ]
  },
  {
    title: "4. Acesso aos endereços, fotos e outros usuários",
    paragraphs: [
      "Motoristas aprovados poderão visualizar dados do pedido necessários para avaliar o frete, tais como endereços, descrição, horário e fotos da carga. Quando o cliente escolhe o motorista, as partes passam a compartilhar informações necessárias à execução. O cliente poderá visualizar informações do motorista, veículo, foto do perfil, propostas, preço e avaliação.",
      "Os documentos de CNH, CRLV e selfie são armazenados em área privada do banco, separada das fotos públicas dos fretes, e somente podem ser consultados pelo próprio motorista ou administração autenticada. Clientes e outros motoristas não recebem cópias desses documentos.",
      "Os usuários se comprometem a não reutilizar dados, fotografias ou contatos obtidos na plataforma para marketing não autorizado, assédio, divulgação pública ou qualquer finalidade estranha ao serviço."
    ]
  },
  {
    title: "5. Localização e estimativas de trajeto",
    paragraphs: [
      "A funcionalidade de mapas pode enviar endereços, coordenadas e consultas de rota a provedores cartográficos, como serviços do Google Maps, quando configurados. O uso de GPS depende da permissão do dispositivo; o usuário pode optar por digitar os endereços manualmente.",
      "Ao abrir um link externo de mapa, também se aplicam as práticas de privacidade do respectivo provedor."
    ]
  },
  {
    title: "6. Compartilhamento com prestadores tecnológicos",
    paragraphs: [
      "Para hospedar a plataforma, armazenar dados, apresentar mapas e manter a operação, o FreteOn poderá utilizar prestadores de infraestrutura como Render, MongoDB e fornecedores de mapas. O compartilhamento deve se limitar ao necessário e observar contratos e salvaguardas apropriadas.",
      "Dados também poderão ser fornecidos a autoridades legalmente competentes, por decisão ou obrigação legal, e às partes da contratação na medida necessária ao serviço. Não há venda de dados pessoais a anunciantes nesta versão."
    ]
  },
  {
    title: "7. Pagamentos e informações financeiras",
    paragraphs: [
      "Dinheiro e cartão na maquininha são recebidos diretamente pelo motorista, fora do processamento financeiro do FreteOn. O aplicativo pode registrar modalidade, preço, confirmações, pendências e comissões simuladas, mas não recebe os números de cartão utilizados na maquininha.",
      "O Pix indicado como sendo pelo FreteOn funciona apenas em modo simulação, sem transferência de valores reais. Se forem ativados meios de pagamento integrados futuramente, esta Política será atualizada para descrever parceiros, compartilhamentos e retenção."
    ]
  },
  {
    title: "8. Cookies, sessões e preferências",
    paragraphs: [
      "O site utiliza cookies de sessão necessários ao login e à separação das contas de Cliente, Motorista e Master. Os identificadores das sessões são protegidos por configurações próprias do navegador e mantidos pelo período de validade correspondente.",
      "O navegador também pode guardar preferências locais, como a dispensa temporária do convite para instalar o PWA. Não é necessário aceitar cookies de publicidade para realizar o cadastro, pois não há sistema de publicidade comportamental implantado nesta versão."
    ]
  },
  {
    title: "9. Segurança dos dados",
    paragraphs: [
      "A plataforma adota medidas de segurança proporcionais, como armazenamento de senhas em formato derivado criptograficamente, uso de HTTPS quando disponível, controle de sessões e regras de acesso por perfil. Nenhum sistema está imune a incidentes; ocorrências relevantes serão tratadas segundo a lei e as normas da ANPD.",
      "Usuários devem preservar a senha, proteger o celular e evitar compartilhar documentos ou dados financeiros excessivos em descrições e fotos de frete."
    ]
  },
  {
    title: "10. Retenção e eliminação",
    paragraphs: [
      "Dados de cadastro e fretes são mantidos enquanto necessários à conta e às finalidades informadas. Registros operacionais e de transações podem ser conservados pelos prazos legais aplicáveis, inclusive para resolução de disputas, segurança, cumprimento de obrigações e exercício regular de direitos.",
      "Após o término da necessidade legítima, os dados deverão ser eliminados ou anonimizados, salvo retenção permitida ou exigida por lei. A solicitação de exclusão não elimina automaticamente informações cuja preservação seja juridicamente necessária."
    ]
  },
  {
    title: "11. Seus direitos pela LGPD",
    paragraphs: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação quando cabíveis, portabilidade nos termos da regulamentação, informação sobre compartilhamento, oposição ao tratamento irregular e revisão de decisões exclusivamente automatizadas quando aplicável.",
      "Se algum tratamento depender de consentimento, também poderá solicitar sua revogação, sem afetar a legalidade do tratamento anterior. Poderemos precisar confirmar sua identidade antes de prestar informações pessoais."
    ]
  },
  {
    title: "12. Suspensão por comissão e decisões de conta",
    paragraphs: [
      "No perfil do motorista, o sistema calcula automaticamente prazos de comissões e pode suspender novas propostas após 72 horas de pendência não contestada. O motorista poderá pedir revisão de erro, contestar débitos e procurar a administração. Uma medida automática não afasta o direito de apresentar informações e solicitar análise.",
      "Avaliações refletem registros da utilização da plataforma e podem ser consideradas em verificações de segurança e qualidade."
    ]
  },
  {
    title: "13. Dados de crianças e adolescentes",
    paragraphs: [
      "O cadastro e a contratação de fretes destinam-se a maiores de 18 anos. Não solicitamos deliberadamente cadastro de crianças e adolescentes. Se houver tratamento indevido identificado, o responsável poderá solicitar medidas de proteção e exclusão quando legalmente cabíveis."
    ]
  },
  {
    title: "14. Transferências e armazenamento internacional",
    paragraphs: [
      "Conforme a configuração de serviços de hospedagem, banco de dados e mapas, dados poderão ser tratados em infraestrutura localizada fora do Brasil. Nesse caso, serão aplicadas as bases e salvaguardas legalmente exigidas para transferências internacionais, observada a LGPD e os regulamentos da ANPD."
    ]
  },
  {
    title: "15. Alterações e vigência",
    paragraphs: [
      "Esta Política pode ser atualizada para refletir mudanças técnicas, legais e de operação. Alterações relevantes serão informadas aos usuários por meio da plataforma e, quando necessário, será realizada nova comunicação ou coleta de manifestação específica."
    ]
  },
];

const topics = [
  { value: "acesso", label: "Acesso aos meus dados" },
  { value: "correcao", label: "Corrigir meus dados" },
  { value: "eliminacao", label: "Eliminar ou anonimizar dados" },
  { value: "oposicao", label: "Contestar tratamento ou suspensão" },
  { value: "outros", label: "Outra solicitação de privacidade" },
];

function PrivacyContact() {
  const [form, setForm] = useState({ name: "", contact: "", category: "acesso", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  async function send(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/legal/privacy-requests", { method: "POST", body: form });
      setReference(result.reference);
      setForm({ name: "", contact: "", category: "acesso", message: "" });
    } catch (err) {
      setError(err.message || "Não foi possível enviar a solicitação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="legal-contact">
      <h2>Solicitar seus direitos de privacidade</h2>
      <p>Use este canal para assuntos da LGPD. Não envie senha, CPF, fotos de documentos ou dados bancários pelo formulário. A administração poderá solicitar confirmação de identidade antes de responder.</p>
      {reference ? (
        <div className="legal-contact-success" role="status">
          <ShieldCheck size={25} />
          <div>
            <strong>Solicitação recebida</strong>
            <p>Protocolo: <code>{reference}</code></p>
            <p>Guarde o número. A equipe poderá entrar em contato pelos dados informados.</p>
            <button type="button" className="secondary" onClick={() => setReference("")}>Enviar outra solicitação</button>
          </div>
        </div>
      ) : (
        <form onSubmit={send}>
          <label>Nome completo
            <input required minLength={3} maxLength={100} autoComplete="name"
              value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="Seu nome" />
          </label>
          <label>Telefone ou e-mail para resposta
            <input required minLength={7} maxLength={160}
              value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })}
              placeholder="Informe um contato válido" />
          </label>
          <label>Assunto
            <select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>
              {topics.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>Descreva sua solicitação
            <textarea required minLength={10} maxLength={1500} rows={4}
              value={form.message} onChange={event => setForm({ ...form, message: event.target.value })}
              placeholder="Explique quais dados ou direitos deseja consultar..." />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Enviando..." : "Enviar solicitação"} <ArrowRight size={17} />
          </button>
        </form>
      )}
    </section>
  );
}

export default function LegalPage({ kind, navigate }) {
  const isTerms = kind === "termos";
  const sections = isTerms ? terms : privacy;
  return (
    <main className="legal-page" id="conteudo">
      <div className="legal-intro">
        <a href="/" className="legal-back" onClick={event => {
          if (!navigate) return;
          event.preventDefault();
          navigate("/");
        }}><ArrowLeft size={16} /> Voltar ao FreteOn</a>
        <div className="legal-icon">{isTerms ? <FileText size={25} /> : <LockKeyhole size={25} />}</div>
        <p className="eyebrow">FRETEON · DOCUMENTOS LEGAIS</p>
        <h1>{isTerms ? "Termos de Uso" : "Política de Privacidade"}</h1>
        <p className="legal-meta">Versão {LEGAL_VERSION} · Atualização em 13 de novembro de 2026 · Aplicável à fase de testes</p>
        <p className="legal-lead">
          {isTerms ?
            "Leia as regras de utilização, responsabilidades, pagamentos, comissões e segurança antes de contratar ou oferecer um frete." :
            "Saiba quais dados são utilizados, para quais finalidades e como exercer os seus direitos previstos na LGPD."}
        </p>
        <p className="legal-test-notice">
          <ShieldCheck size={18} />
          Os pagamentos e repasses Pix do FreteOn permanecem em simulação. O conteúdo deve passar por revisão jurídica e receber a identificação cadastral completa da operadora antes do lançamento comercial.
        </p>
      </div>
      <nav className="legal-toc" aria-label="Navegação pelos tópicos">
        {sections.map((part, index) => (
          <a href={"#secao-" + index} key={part.title}>{part.title}</a>
        ))}
      </nav>
      <div className="legal-sections">
        {sections.map((part, index) => (
          <section key={part.title} id={"secao-" + index}>
            <h2>{part.title}</h2>
            {part.paragraphs.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
          </section>
        ))}
      </div>
      {!isTerms && <PrivacyContact />}
      <div className="legal-end">
        <p>FreteOn · Porto Velho, Rondônia, Brasil · Versão {LEGAL_VERSION}.</p>
        <a href={isTerms ? "/privacidade" : "/termos"} onClick={event => {
          if (!navigate) return;
          event.preventDefault();
          navigate(isTerms ? "/privacidade" : "/termos");
        }}>
          {isTerms ? "Ler Política de Privacidade" : "Ler Termos de Uso"}
          <ArrowRight size={15} />
        </a>
      </div>
    </main>
  );
}
