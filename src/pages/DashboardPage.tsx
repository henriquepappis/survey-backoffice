import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { dashboardApi, parseApiError, surveyApi } from '../services/api'
import type { DashboardOverview, DashboardRankingItem, Survey } from '../types/api'
import { toArray } from '../utils/response'

const formatDate = (date?: string | null) => {
  if (!date) return 'Sem data'
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatSeconds = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

const DashboardPage = () => {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [overview, setOverview] = useState<DashboardOverview>()
  const [overviewError, setOverviewError] = useState<string>()
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [loadingSurveys, setLoadingSurveys] = useState(true)
  const [surveysError, setSurveysError] = useState<string>()

  useEffect(() => {
    const fetchSurveys = async () => {
      setLoadingSurveys(true)
      setSurveysError(undefined)
      try {
        const data = await surveyApi.list({ size: 200 })
        setSurveys(toArray<Survey>(data))
      } catch (err) {
        setSurveysError(parseApiError(err))
      } finally {
        setLoadingSurveys(false)
      }
    }
    void fetchSurveys()
  }, [])

  useEffect(() => {
    const loadOverview = async () => {
      setOverviewLoading(true)
      setOverviewError(undefined)
      try {
        const data = await dashboardApi.getOverview()
        setOverview(data)
      } catch (err) {
        setOverviewError(parseApiError(err))
      } finally {
        setOverviewLoading(false)
      }
    }
    void loadOverview()
  }, [])

  const recentActivities = useMemo(() => {
    return [...surveys]
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt ?? a.createdAt ?? '').getTime()
        const dateB = new Date(b.updatedAt ?? b.createdAt ?? '').getTime()
        return dateB - dateA
      })
      .slice(0, 4)
  }, [surveys])

  const surveyTitleById = useMemo(() => {
    const map = new Map<number, string>()
    surveys.forEach((survey) => map.set(survey.id, survey.titulo))
    return map
  }, [surveys])

  const getRankingTitle = (item: DashboardRankingItem) =>
    item.titulo ||
    surveyTitleById.get(item.surveyId) ||
    item.metricLabel ||
    `Pesquisa #${item.surveyId}`

  return (
    <Layout title="Dashboard">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Visão geral</p>
            <h2>Desempenho das pesquisas</h2>
          </div>
        </div>
        {overviewLoading && <p>Carregando métricas...</p>}
        {overviewError && <p className="error-text">{overviewError}</p>}
        {overview && !overviewLoading && (
          <>
            <div className="stats-grid">
              <article className="stat-card">
                <p className="eyebrow">Pesquisas</p>
                <strong>{overview.totals.surveys}</strong>
                <span className="muted-text">
                  {overview.totals.activeSurveys} ativas • {overview.totals.inactiveSurveys} inativas
                </span>
              </article>
              <article className="stat-card">
                <p className="eyebrow">Respostas totais</p>
                <strong>{overview.totals.responses}</strong>
                <span className="muted-text">
                  +{overview.totals.responsesLast7Days} nos últimos 7 dias
                </span>
              </article>
              <article className="stat-card">
                <p className="eyebrow">Taxa média de conclusão</p>
                <strong>
                  {overview.totals.averageCompletionRate
                    ? `${overview.totals.averageCompletionRate.toFixed(1)}%`
                    : '—'}
                </strong>
                <span className="muted-text">
                  Abandono médio{' '}
                  {overview.totals.averageAbandonmentRate
                    ? `${overview.totals.averageAbandonmentRate.toFixed(1)}%`
                    : '—'}
                </span>
              </article>
              <article className="stat-card">
                <p className="eyebrow">Tempo médio de resposta</p>
                <strong>{formatSeconds(overview.totals.averageResponseTimeSeconds)}</strong>
                <span className="muted-text">Últimos 30 dias</span>
              </article>
            </div>
            <div className="stats-grid compact">
              <MetricCard title="Respostas (7 dias)" value={overview.totals.responsesLast7Days ?? 0}>
                <span className="metric-card__dot" />
              </MetricCard>
              <MetricCard title="Respostas (30 dias)" value={overview.totals.responsesLast30Days ?? 0}>
                <span className="metric-card__dot" />
              </MetricCard>
            </div>
          </>
        )}
      </section>

      {overview?.rankings && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Destaques</p>
              <h2>Rankings de desempenho</h2>
            </div>
          </div>
          <div className="rankings-grid">
            {[
              {
                title: 'Mais respondidas',
                items: overview.rankings.mostResponded,
              },
              {
                title: 'Maior conclusão',
                items: overview.rankings.highestCompletion,
              },
              {
                title: 'Maior abandono',
                items: overview.rankings.highestAbandonment,
              },
              {
                title: 'Próximas do vencimento',
                items: overview.rankings.expiringSoon,
              },
            ]
              .filter((section) => section.items && section.items.length)
              .map((section) => (
                <article key={section.title} className="rankings-card">
                  <p className="eyebrow">{section.title}</p>
                  <ul>
                    {section.items?.map((item) => (
                      <li key={item.surveyId}>
                        <div>
                          <strong>{getRankingTitle(item)}</strong>
                          {item.metricLabel && <small className="muted-text">{item.metricLabel}</small>}
                        </div>
                        <span>{item.valueFormatted ?? item.value}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Atualizações recentes</p>
            <h2>Últimos eventos</h2>
          </div>
        </div>
        <ul className="timeline">
          {recentActivities.length === 0 && !loadingSurveys && <li>Sem atividades registradas.</li>}
          {loadingSurveys && <li>Carregando pesquisas...</li>}
          {surveysError && <li className="error-text">{surveysError}</li>}
          {recentActivities.map((activity) => (
            <li key={activity.id}>
              <span className="timeline__title">{activity.titulo}</span>
              <span className="timeline__date">{formatDate(activity.updatedAt ?? activity.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  )
}

export default DashboardPage
