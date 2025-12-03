import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { dashboardApi, parseApiError, surveyApi } from '../services/api'
import type { DashboardOverview, Survey } from '../types/api'
import { toArray } from '../utils/response'

type StatusFilter = 'all' | 'active'

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

const SurveysPage = () => {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [overview, setOverview] = useState<DashboardOverview>()
  const [overviewError, setOverviewError] = useState<string>()
  const [overviewLoading, setOverviewLoading] = useState(true)

  const fetchSurveys = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const baseParams = { size: 200 }
      const params = statusFilter === 'active' ? { ...baseParams, ativo: true } : baseParams
      const data = await surveyApi.list(params)
      setSurveys(toArray<Survey>(data))
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void fetchSurveys()
  }, [fetchSurveys])

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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await surveyApi.remove(deleteTarget.id)
      await fetchSurveys()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <Layout title="Pesquisas">
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Remover pesquisa"
        description={
          deleteTarget
            ? `Tem certeza que deseja remover "${deleteTarget.titulo}"? Essa ação é irreversível.`
            : ''
        }
        confirmLabel="Remover"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirmLoading={isDeleting}
      />
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

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Lista de pesquisas</p>
            <h2>Monitore status e ações</h2>
          </div>
          <div className="filter-group">
            <label>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">Todas</option>
                <option value="active">Somente ativas</option>
              </select>
            </label>
            <button className="btn ghost" type="button">
              Exportar CSV
            </button>
          </div>
        </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Atualizações recentes</p>
            <h2>Últimos eventos</h2>
          </div>
        </div>
        <ul className="timeline">
          {recentActivities.length === 0 && !loading && <li>Sem atividades registradas.</li>}
          {recentActivities.map((activity) => (
            <li key={activity.id}>
              <span className="timeline__title">{activity.titulo}</span>
              <span className="timeline__date">{formatDate(activity.updatedAt ?? activity.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>

        {loading && <p>Carregando pesquisas...</p>}
        {error && <p className="error-text">{error}</p>}

        {surveys.length === 0 && !loading && !error && <p>Nenhuma pesquisa registrada.</p>}

        {surveys.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => (
                  <tr key={survey.id}>
                    <td>#{survey.id}</td>
                    <td>
                      <strong>{survey.titulo}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${survey.ativo ? 'success' : 'neutral'}`}>
                        {survey.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>{formatDate(survey.dataValidade)}</td>
                    <td className="table-actions">
                      <button className="btn ghost small" type="button" disabled>
                        Ver
                      </button>
                      <Link to={`/surveys/${survey.id}`} className="btn secondary small">
                        Editar
                      </Link>
                      <button className="btn danger small" type="button" onClick={() => setDeleteTarget(survey)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              { title: 'Mais respondidas', items: overview.rankings.mostResponded },
              { title: 'Maior conclusão', items: overview.rankings.highestCompletion },
              { title: 'Maior abandono', items: overview.rankings.highestAbandonment },
              { title: 'Recém-criadas', items: overview.rankings.recentlyCreated },
              { title: 'Próximas do vencimento', items: overview.rankings.expiringSoon },
            ]
              .filter((section) => section.items && section.items.length)
              .map((section) => (
                <article key={section.title} className="rankings-card">
                  <p className="eyebrow">{section.title}</p>
                  <ul>
                    {section.items?.map((item) => (
                      <li key={item.surveyId}>
                        <div>
                          <strong>{item.titulo}</strong>
                          {item.metricLabel && <small>{item.metricLabel}</small>}
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
    </Layout>
  )
}

export default SurveysPage
