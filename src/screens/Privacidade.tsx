import { Card, PageHeader } from '../components/ui'
import { AVISO_ATUALIZADO_EM, DADOS_GUARDADOS, SECOES_AVISO } from '../domain'
import { Link } from '../router'
import { useApp } from '../store'

/** A6: aviso de privacidade (LGPD, RNF27). Público: abre pelo link da tela de login, com ou sem sessão. */
export default function Privacidade() {
  const { usuario } = useApp()

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Aviso de privacidade"
        description={
          <>
            Quais dados pessoais o Águas do Capibaribe guarda, para quê e por quanto tempo, conforme a Lei Geral de
            Proteção de Dados (LGPD, Lei nº 13.709/2018). Atualizado em {AVISO_ATUALIZADO_EM}.
          </>
        }
      />

      <section aria-labelledby="dados-guardados" className="flex flex-col gap-4">
        <h2 id="dados-guardados" className="text-[22px] font-bold tracking-tight text-ink">
          Quais dados são guardados
        </h2>
        <ul className="flex flex-col gap-4">
          {DADOS_GUARDADOS.map((d) => (
            <li key={d.dado}>
              <Card as="article" className="p-5 sm:p-6">
                <h3 className="text-[18px] font-semibold text-ink">{d.dado}</h3>
                <dl className="mt-3 grid gap-3 text-[15px] sm:grid-cols-[150px_1fr] sm:gap-x-4">
                  <dt className="font-semibold text-ink-2">Para quê</dt>
                  <dd className="text-ink">{d.finalidade}</dd>
                  <dt className="font-semibold text-ink-2">Por quanto tempo</dt>
                  <dd className="text-ink">{d.prazo}</dd>
                  <dt className="font-semibold text-ink-2">Quem vê</dt>
                  <dd className="text-ink">{d.quemVe}</dd>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {SECOES_AVISO.map((s) => (
        <Card as="section" key={s.titulo} className="p-5 sm:p-6">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">{s.titulo}</h2>
          {s.paragrafos.map((p) => (
            <p key={p} className="mt-3 text-[15px] leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </Card>
      ))}

      {!usuario && (
        <p>
          <Link to="/login" className="font-semibold text-brand underline underline-offset-2">
            Voltar para o login
          </Link>
        </p>
      )}
    </div>
  )
}
