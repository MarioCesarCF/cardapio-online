// Testa o envio de WhatsApp via Meta Cloud API usando o número de TESTE do app
// (envia o template "hello_world", disponível por padrão, para até 5
// destinatários). Requer o back compilado (importa dist/whatsapp/whatsapp.service.js):
// rode antes `npm run build`.
// Uso (na pasta back/): npm run testar:whatsapp [-- <numero>]
//   - Destinatário: argumento, senão WA_TEST_RECIPIENT (default 5527998927442).
//   - Template: WA_TEMPLATE_TESTE (default hello_world).
import { WhatsAppService } from '../dist/whatsapp/whatsapp.service.js';

const destino = process.argv[2] ?? process.env.WA_TEST_RECIPIENT ?? '5527998927442';
const template = process.env.WA_TEMPLATE_TESTE ?? 'hello_world';

const whatsapp = new WhatsAppService();
if (!whatsapp.configured) {
  console.error(
    'WhatsApp não configurado: defina WA_GRAPH_TOKEN e WA_PHONE_NUMBER_ID no back/.env.',
  );
  process.exit(1);
}

try {
  await whatsapp.enviarTemplate(destino, template);
  console.log(
    `WhatsApp enviado para ${destino} com o template "${template}" (confira o celular).`,
  );
} catch (error) {
  console.error('Falha ao enviar WhatsApp:', error.message);
  process.exitCode = 1;
}