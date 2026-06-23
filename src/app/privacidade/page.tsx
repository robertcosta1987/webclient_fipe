import Link from "next/link";
import { DPO, PRIVACY_POLICY_VERSION } from "@/lib/lgpd/policy";

export const metadata = { title: "Política de Privacidade · Placas360" };

// Public page (allow-listed in middleware) so it is reachable while logged out.
export default function PrivacidadePage() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 leading-relaxed">
      <header>
        <h1 className="text-3xl font-semibold">Política de Privacidade</h1>
        <p className="text-sm opacity-70">
          Versão {PRIVACY_POLICY_VERSION} · Placas360 / DadoCar · em conformidade com a LGPD (Lei nº 13.709/2018).
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Quem trata os seus dados</h2>
        <p>
          A plataforma Placas360 / DadoCar trata dados pessoais para prestar serviços de consulta veicular e
          gestão de estoque a concessionárias e seus usuários. Atuamos como <strong>operador</strong> dos dados
          que as concessionárias (controladoras) inserem, e como controlador dos dados de cadastro e acesso dos
          usuários da plataforma.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Dados que coletamos</h2>
        <ul className="list-disc pl-6">
          <li><strong>Cadastro e conta:</strong> nome, e-mail, empresa, CNPJ e telefone (quando informados).</li>
          <li><strong>Autenticação:</strong> senha (armazenada apenas como hash com sal — nunca em texto puro) e chave de API (armazenada como hash).</li>
          <li><strong>Veículos e consultas:</strong> placa, chassi e dados técnicos do veículo consultado/cadastrado e o resultado das consultas (FIPE, KBB, Infocar, CheckTudo).</li>
          <li><strong>Registros técnicos (logs):</strong> placa consultada, endereço IP, navegador (user-agent), data/hora e identificadores da chamada, para segurança e conciliação de cobrança.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Finalidades e bases legais (Art. 7º)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr><th className="text-left p-2 border-b">Finalidade</th><th className="text-left p-2 border-b">Base legal</th></tr>
            </thead>
            <tbody>
              <tr><td className="p-2 border-b">Criar e manter a conta; autenticar o acesso</td><td className="p-2 border-b">Execução de contrato (Art. 7º, V)</td></tr>
              <tr><td className="p-2 border-b">Prestar as consultas veiculares e gerir o estoque</td><td className="p-2 border-b">Execução de contrato (Art. 7º, V)</td></tr>
              <tr><td className="p-2 border-b">Segurança, prevenção a fraude e conciliação de cobrança (logs)</td><td className="p-2 border-b">Legítimo interesse (Art. 7º, IX)</td></tr>
              <tr><td className="p-2 border-b">Cumprir obrigações fiscais/legais</td><td className="p-2 border-b">Obrigação legal/regulatória (Art. 7º, II)</td></tr>
              <tr><td className="p-2 border-b">Aceite desta Política no cadastro</td><td className="p-2 border-b">Consentimento (Art. 7º, I)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">4. Compartilhamento e operadores</h2>
        <p>
          Compartilhamos dados apenas com operadores necessários à prestação do serviço, sob contrato e dever de
          confidencialidade. Lista de sub-operadores (provedor de nuvem, provedores de dados veiculares/preço,
          e-mail e demais): <strong>[A DEFINIR — ver docs/LGPD/OPEN_DECISIONS.md]</strong>. Não vendemos dados
          pessoais.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">5. Retenção</h2>
        <p>
          Mantemos os dados pelo tempo necessário às finalidades acima e às obrigações legais. Os prazos por
          categoria (logs técnicos, consultas, contas inativas) estão em definição —{" "}
          <strong>[A DEFINIR — ver docs/LGPD/OPEN_DECISIONS.md]</strong>. Registros exigidos por lei (ex.: fiscais)
          são mantidos de forma anonimizada após o pedido de exclusão (Art. 16).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">6. Seus direitos (Art. 18) e como exercê-los</h2>
        <p>
          Você pode confirmar a existência de tratamento, acessar, corrigir, portar e solicitar a exclusão dos
          seus dados. Na própria plataforma, em{" "}
          <Link href="/meus-dados" className="underline">Meus dados</Link>, é possível <strong>exportar</strong>{" "}
          (JSON/CSV) e <strong>excluir/anonimizar</strong> a sua conta. Você também pode contatar o Encarregado
          (DPO) pelos canais abaixo.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">7. Segurança (Art. 46)</h2>
        <p>
          Adotamos medidas técnicas e organizacionais: acesso autenticado, isolamento por titular/assinatura,
          senhas com hash e sal, consultas SQL parametrizadas, criptografia em trânsito (HTTPS) e ausência de
          dados pessoais nos registros de aplicação.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">8. Encarregado pelo Tratamento de Dados (DPO)</h2>
        <p>
          {DPO.name} — <a href={`mailto:${DPO.email}`} className="underline">{DPO.email}</a>.{" "}
          <em>(Contato em definição — ver docs/LGPD/OPEN_DECISIONS.md.)</em>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">9. Alterações</h2>
        <p>
          Esta política pode ser atualizada. A versão vigente e a data constam no topo. Mudanças relevantes serão
          comunicadas pelos canais da plataforma.
        </p>
      </section>
    </article>
  );
}
