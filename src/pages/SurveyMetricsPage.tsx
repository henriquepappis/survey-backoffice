import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { dashboardApi, parseApiError, surveyApi } from '../services/api'
import type {
  DashboardBreakdownItem,
  SurveyAudienceMetrics,
  SurveyDashboardMetrics,
  SurveyStructure,
} from '../types/api'

const formatDate = (date?: string | null) => {
  if (!date) return 'Sem data definida'
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatSeconds = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

const formatTimeSeriesLabel = (label: string) => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label)
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    return `${day}/${month}/${year}`
  }
  return label
}

const renderBreakdownCard = (title: string, items?: DashboardBreakdownItem[]) => (
  <article key={title} className="breakdown-card">
    <p className="eyebrow">{title}</p>
    {!items || items.length === 0 ? (
      <p className="muted-text">Sem dados</p>
    ) : (
      <ul>
        {items.map((item) => (
          <li key={`${title}-${item.label}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.percentage !== undefined && <small>{item.percentage.toFixed(1)}%</small>}
          </li>
        ))}
      </ul>
    )}
  </article>
)

const SurveyMetricsPage = () => {
  const { id } = useParams()
  const surveyId = Number(id)
  const [survey, setSurvey] = useState<SurveyStructure>()
  const [metrics, setMetrics] = useState<SurveyDashboardMetrics>()
  const [audienceMetrics, setAudienceMetrics] = useState<SurveyAudienceMetrics>()
  const [insightsError, setInsightsError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const totals = useMemo(() => {
    if (!metrics) return undefined
    const overview = metrics.overview
    const responsesFromQuestions =
      metrics.statsByQuestion?.reduce((acc, q) => acc + (q.responses ?? 0), 0) ?? 0
    const toNumber = (value: unknown) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : undefined
    }
    const baseResponses =
      toNumber(metrics.totals?.responses) ??
      toNumber(metrics.totalResponses) ??
      toNumber(overview?.totalResponses) ??
      responsesFromQuestions
    const completionRate =
      metrics.totals?.completionRate ?? metrics.completionRate ?? overview?.completionRate
    const abandonmentRate =
      metrics.totals?.abandonmentRate ?? metrics.abandonmentRate ?? overview?.abandonmentRate
    const computedCompletions =
      completionRate !== undefined ? Math.round(baseResponses * completionRate) : undefined
    const computedAbandons =
      abandonmentRate !== undefined ? Math.round(baseResponses * abandonmentRate) : undefined
    return {
      responses: baseResponses,
      completions:
        metrics.totals?.completions ??
        metrics.totalCompletions ??
        overview?.totalCompletions ??
        computedCompletions ??
        0,
      abandons:
        metrics.totals?.abandons ??
        metrics.totalAbandons ??
        overview?.totalAbandons ??
        computedAbandons ??
        0,
      completionRate: completionRate,
      abandonmentRate: abandonmentRate,
      avgResponseTimeSeconds:
        metrics.totals?.avgResponseTimeSeconds ??
        metrics.avgResponseTimeSeconds ??
        overview?.avgResponseTimeSeconds,
    }
  }, [metrics])

  useEffect(() => {
    const loadSurvey = async () => {
      if (!surveyId) return
      setLoading(true)
      setError(undefined)
      try {
        const structureData = await surveyApi.getStructure(surveyId, {
          includeDeleted: true,
          includeInactiveOptions: true,
        })
        setSurvey(structureData)
      } catch (err) {
        setError(parseApiError(err))
      } finally {
        setLoading(false)
      }
    }
    void loadSurvey()
  }, [surveyId])

  useEffect(() => {
    const loadInsights = async () => {
      if (!surveyId) return
      try {
        const dateRange = {
          from: '2000-01-01T00:00:00',
          to: new Date().toISOString(),
          includeDeleted: true,
        }
        const [metricsData, audienceData] = await Promise.all([
          dashboardApi.getSurveyMetrics(surveyId, dateRange),
          dashboardApi.getSurveyAudience(surveyId, dateRange),
        ])
        setMetrics(metricsData)
        setAudienceMetrics(audienceData)
        setInsightsError(undefined)
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 403) {
          setInsightsError('As métricas do dashboard exigem login com usuário ADMIN.')
        } else {
          setInsightsError(parseApiError(err))
        }
      }
    }
    void loadInsights()
  }, [surveyId])

  if (!surveyId) {
    return (
      <Layout title="Métricas" subtitle="ID inválido">
        <p className="error-text">ID da pesquisa inválido.</p>
      </Layout>
    )
  }

  return (
    <Layout
      title={survey?.titulo ?? 'Métricas da pesquisa'}
      subtitle="Visão de respostas e audiência"
    >
      <section className="panel hero-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pesquisa #{surveyId}</p>
            <h2>{survey?.titulo ?? 'Carregando...'}</h2>
            {survey?.descricao && <p className="muted-text muted-text--light">{survey.descricao}</p>}
          </div>
          <div className="hero-actions">
            <Link to="/surveys" className="btn ghost">
              Voltar
            </Link>
            <Link to={`/surveys/${surveyId}`} className="btn secondary">
              Editar
            </Link>
          </div>
        </div>
        {loading && <p>Carregando dados...</p>}
        {error && <p className="error-text">{error}</p>}
        {survey && !loading && !error && (
          <>
            <p className="eyebrow">Validade</p>
            <p className="muted-text validity-text">{formatDate(survey.dataValidade)}</p>
            <div className="metrics-grid">
              <MetricCard title="Status" value={survey.ativo ? 'Ativa' : 'Inativa'}>
                <span className={`status-pill ${survey.ativo ? 'success' : 'neutral'}`}>
                  {survey.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </MetricCard>
              <MetricCard title="Perguntas" value={survey.questions.length}>
                <span className="metric-card__dot" />
              </MetricCard>
              <MetricCard
                title="Opções totais"
                value={survey.questions.reduce((acc, q) => acc + (q.options?.length ?? 0), 0)}
              >
                <span className="metric-card__dot" />
              </MetricCard>
              <MetricCard title="Votos coletados" value={totals?.responses ?? 0}>
                <span className="metric-card__dot" />
              </MetricCard>
            </div>
          </>
        )}
      </section>

      {insightsError && <p className="error-text">{insightsError}</p>}

      {totals && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Desempenho</p>
              <h2>Métricas operacionais</h2>
            </div>
          </div>
          <div className="stats-grid">
            <article className="stat-card center">
              <p className="eyebrow">Respostas</p>
              <strong>{totals.responses ?? 0}</strong>
              <span className="muted-text">Conclusões {totals.completions ?? 0}</span>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Abandonos</p>
              <strong>{totals.abandons ?? 0}</strong>
              <span className="muted-text">
                Taxa{' '}
                {totals.abandonmentRate !== undefined
                  ? `${totals.abandonmentRate.toFixed(1)}%`
                  : '—'}
              </span>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Taxa de conclusão</p>
              <strong>
                {totals.completionRate !== undefined
                  ? `${totals.completionRate.toFixed(1)}%`
                  : '—'}
              </strong>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Tempo médio</p>
              <strong>{formatSeconds(totals.avgResponseTimeSeconds)}</strong>
              <span className="muted-text">Tempo para responder</span>
            </article>
          </div>
        </section>
      )}

      {metrics?.peakQuestionAbandonment && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Alertas</p>
              <h2>Maior abandono</h2>
            </div>
          </div>
          <div className="list-card">
            <strong>{metrics.peakQuestionAbandonment.texto}</strong>
            <span className="muted-text">
              Taxa de abandono{' '}
              {metrics.peakQuestionAbandonment.abandonmentRate !== undefined
                ? `${metrics.peakQuestionAbandonment.abandonmentRate.toFixed(1)}%`
                : '—'}
            </span>
          </div>
        </section>
      )}

      {metrics?.responsesOverTime && metrics.responsesOverTime.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Evolução</p>
              <h2>Respostas ao longo do tempo</h2>
            </div>
          </div>
          <div className="list-card">
            <ul className="simple-list">
              {metrics.responsesOverTime.map((item) => (
                <li key={item.label}>
                  <span>{formatTimeSeriesLabel(item.label)}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {metrics?.statsByQuestion && metrics.statsByQuestion.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Perguntas</p>
              <h2>Respostas por questão</h2>
            </div>
          </div>
          <div className="table-wrapper compact">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Pergunta</th>
                  <th className="text-center">Respostas</th>
                  <th>Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {metrics.statsByQuestion.map((question) => (
                  <tr key={question.questionId}>
                    <td>
                      <strong>{question.texto}</strong>
                      {question.options && question.options.length > 0 && (
                        <ul className="simple-list nested">
                          {question.options.map((option) => (
                            <li key={option.optionId}>
                              <span>{option.texto}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="text-center">
                      <strong>{question.responses}</strong>
                      {question.options && question.options.length > 0 && (
                        <ul className="simple-list nested centered">
                          {question.options.map((option) => (
                            <li key={option.optionId}>
                              <span>
                                {option.responses} resp{' '}
                                {option.percentage !== undefined
                                  ? `(${option.percentage.toFixed(1)}%)`
                                  : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      {question.completionRate !== undefined
                        ? `${question.completionRate.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {audienceMetrics && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Audiência</p>
              <h2>Dispositivos e origem</h2>
            </div>
          </div>
          <div className="stats-grid compact">
            <article className="stat-card">
              <p className="eyebrow">Respondentes únicos</p>
              <strong>{audienceMetrics.uniqueRespondents ?? '—'}</strong>
              <span className="muted-text">
                Duplicados {audienceMetrics.duplicateRespondents ?? 0}
              </span>
            </article>
            <article className="stat-card stat-card--compact-value">
              <p className="eyebrow">Sessões suspeitas</p>
              <strong>{audienceMetrics.suspiciousSessions ?? 0}</strong>
            </article>
            <article className="stat-card">
              <p className="eyebrow">Tempo médio para abandono</p>
              <strong>{formatSeconds(audienceMetrics.avgTimeToAbandonSeconds)}</strong>
            </article>
          </div>
          <div className="breakdown-grid">
            {renderBreakdownCard('Dispositivos', audienceMetrics.deviceDistribution)}
            {renderBreakdownCard('Sistemas Operacionais', audienceMetrics.osDistribution)}
            {renderBreakdownCard('Navegadores', audienceMetrics.browserDistribution)}
            {renderBreakdownCard('Origem', audienceMetrics.sourceDistribution)}
          </div>
          <div className="breakdown-grid">
            {renderBreakdownCard('Países', audienceMetrics.countryDistribution)}
            {renderBreakdownCard('Estados', audienceMetrics.stateDistribution)}
            {renderBreakdownCard('Cidades', audienceMetrics.cityDistribution)}
          </div>
          <div className="breakdown-grid">
            {renderBreakdownCard('Horários de pico', audienceMetrics.peakHours)}
            {renderBreakdownCard('Dias de pico', audienceMetrics.peakDays)}
          </div>
        </section>
      )}
    </Layout>
  )
}

export default SurveyMetricsPage
