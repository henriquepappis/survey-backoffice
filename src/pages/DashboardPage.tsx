import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

  const chartColors = ['#0f8f53', '#2ca66f', '#55b98a', '#f3c567', '#f19953', '#df5f51', '#8d6cab']

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

  const statusBreakdown = useMemo(() => {
    const total = surveys.length
    const active = surveys.filter((survey) => survey.ativo && !survey.deletedAt).length
    const inactive = surveys.filter((survey) => !survey.ativo && !survey.deletedAt).length
    const removed = surveys.filter((survey) => survey.deletedAt).length
    return [
      { name: 'Ativas', value: active },
      { name: 'Inativas', value: inactive },
      { name: 'Removidas', value: removed },
    ].filter((item) => item.value > 0 || total === 0)
  }, [surveys])

  const responsesBars = useMemo(
    () =>
      overview
        ? [
            { label: 'Total', value: overview.totals.responses },
            { label: '30 dias', value: overview.totals.responsesLast30Days },
            { label: '7 dias', value: overview.totals.responsesLast7Days },
          ].filter((item) => item.value !== undefined)
        : [],
    [overview],
  )

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

  const mostRespondedData = useMemo(
    () =>
      overview?.rankings?.mostResponded?.map((item) => ({
        name: getRankingTitle(item),
        value: item.value,
      })) ?? [],
    [overview?.rankings?.mostResponded, surveyTitleById],
  )

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
            <div className="chart-grid">
              <article className="chart-card">
                <p className="chart-card__title">Respostas recentes</p>
                <p className="chart-card__subtitle">Total, últimos 30 e 7 dias</p>
                {responsesBars.length === 0 ? (
                  <p className="chart-empty">Sem dados</p>
                ) : (
                  <div className="chart-container chart-container--small">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={responsesBars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0f8f53" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>

              <article className="chart-card">
                <p className="chart-card__title">Status das pesquisas</p>
                <p className="chart-card__subtitle">Ativas, inativas e removidas</p>
                {statusBreakdown.length === 0 ? (
                  <p className="chart-empty">Sem dados</p>
                ) : (
                  <div className="chart-container chart-container--small">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          label
                        >
                          {statusBreakdown.map((entry, index) => (
                            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>
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

      {mostRespondedData.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Destaques</p>
              <h2>Mais respondidas (gráfico)</h2>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mostRespondedData}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={200} />
                <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />
                <Bar dataKey="value" fill="#0b301e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
