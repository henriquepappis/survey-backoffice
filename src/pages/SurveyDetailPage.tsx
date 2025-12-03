import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { dashboardApi, optionApi, parseApiError, questionApi, surveyApi } from '../services/api'
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

const MAX_ACTIVE_OPTIONS = 5

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
            {item.percentage !== undefined && (
              <small>{item.percentage.toFixed(1)}%</small>
            )}
          </li>
        ))}
      </ul>
    )}
  </article>
)

const SurveyDetailPage = () => {
  const { id } = useParams()
  const surveyId = Number(id)
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<SurveyStructure>()
  const [metrics, setMetrics] = useState<SurveyDashboardMetrics>()
  const [audienceMetrics, setAudienceMetrics] = useState<SurveyAudienceMetrics>()
  const [insightsError, setInsightsError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [questionForm, setQuestionForm] = useState({ texto: '', ordem: 1 })
  const [optionForm, setOptionForm] = useState({ questionId: '', texto: '', ativo: true })
  const [feedback, setFeedback] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
      metrics.totals?.completionRate ??
      metrics.completionRate ??
      overview?.completionRate
    const abandonmentRate =
      metrics.totals?.abandonmentRate ??
      metrics.abandonmentRate ??
      overview?.abandonmentRate
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

  const loadSurvey = async () => {
    if (!surveyId) return
    setLoading(true)
    setError(undefined)
    try {
      const structureData = await surveyApi.getStructure(surveyId)
      setSurvey(structureData)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSurvey()
  }, [surveyId])

  useEffect(() => {
    const loadInsights = async () => {
      if (!surveyId) return
      try {
        const dateRange = {
          from: '2000-01-01T00:00:00',
          to: new Date().toISOString(),
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

  const handleQuestionSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(undefined)
    setFormError(undefined)
    try {
      await questionApi.create({
        texto: questionForm.texto.trim(),
        ordem: Number(questionForm.ordem),
        surveyId,
      })
      setQuestionForm({ texto: '', ordem: 1 })
      setFeedback('Pergunta adicionada com sucesso.')
      await loadSurvey()
    } catch (err) {
      setFormError(parseApiError(err))
    }
  }

  const handleOptionSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(undefined)
    setFormError(undefined)
    const parsedQuestionId = Number(optionForm.questionId)
    if (!parsedQuestionId) {
      setFormError('Selecione uma pergunta para adicionar a opção.')
      return
    }
    const targetQuestion = survey?.questions.find((question) => question.id === parsedQuestionId)
    if (targetQuestion && optionForm.ativo) {
      const activeCount = (targetQuestion.options ?? []).filter((option) => option.ativo).length
      if (activeCount >= MAX_ACTIVE_OPTIONS) {
        setFormError(
          `Máximo de ${MAX_ACTIVE_OPTIONS} opções ativas por pergunta. Desative uma opção antes de ativar outra.`,
        )
        return
      }
    }
    try {
      await optionApi.create({
        texto: optionForm.texto.trim(),
        ativo: optionForm.ativo,
        questionId: parsedQuestionId,
      })
      setOptionForm({ questionId: optionForm.questionId, texto: '', ativo: true })
      setFeedback('Opção adicionada com sucesso.')
      await loadSurvey()
    } catch (err) {
      setFormError(parseApiError(err))
    }
  }

  const handleDelete = async () => {
    if (!surveyId || !survey) return
    setIsDeleting(true)
    try {
      await surveyApi.remove(surveyId)
      navigate('/surveys', { replace: true })
    } catch (err) {
      setFormError(parseApiError(err))
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  if (!surveyId) {
    return (
      <Layout title="Pesquisa" subtitle="ID inválido">
        <p className="error-text">ID da pesquisa inválido.</p>
      </Layout>
    )
  }

  const questionMetrics = useMemo(() => {
    if (!survey) {
      return {
        totalQuestions: 0,
        totalOptions: 0,
        activeOptions: 0,
        inactiveOptions: 0,
        avgOptions: '0.0',
        questionsWithoutActiveOptions: 0,
      }
    }
    const totals = survey.questions.reduce(
      (acc, question) => {
        const opts = question.options ?? []
        acc.totalOptions += opts.length
        const active = opts.filter((option) => option.ativo).length
        acc.activeOptions += active
        acc.inactiveOptions += opts.length - active
        if (active === 0) acc.questionsWithoutActiveOptions += 1
        return acc
      },
      { totalOptions: 0, activeOptions: 0, inactiveOptions: 0, questionsWithoutActiveOptions: 0 },
    )
    const totalQuestions = survey.questions.length
    return {
      totalQuestions,
      totalOptions: totals.totalOptions,
      activeOptions: totals.activeOptions,
      inactiveOptions: totals.inactiveOptions,
      avgOptions: totalQuestions
        ? (totals.totalOptions / totalQuestions).toFixed(1)
        : '0.0',
      questionsWithoutActiveOptions: totals.questionsWithoutActiveOptions,
    }
  }, [survey])

  return (
    <Layout
      title={survey?.titulo ?? 'Carregando pesquisa'}
      subtitle="Visão completa da audiência e estrutura"
    >
      <ConfirmModal
        open={deleteModalOpen}
        title="Remover pesquisa"
        description={
          survey
            ? `Deseja remover "${survey.titulo}"? Todas as perguntas e opções associadas serão excluídas.`
            : ''
        }
        confirmLabel="Remover"
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        confirmLoading={isDeleting}
      />
      <section className="panel hero-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pesquisa #{survey?.id}</p>
            <h2>{survey?.titulo ?? 'Carregando...'}</h2>
          </div>
          <div className="hero-actions">
            <Link to="/surveys" className="btn ghost">
              Voltar
            </Link>
            <button className="btn secondary" type="button">
              Duplicar
            </button>
            <button className="btn primary" type="button">
              Publicar alterações
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              disabled={isDeleting}
            >
              Remover
            </button>
          </div>
        </div>
        {loading && <p>Carregando dados...</p>}
        {error && <p className="error-text">{error}</p>}
        {survey && !loading && !error && (
          <>
            <p className="muted-text">Validade: {formatDate(survey.dataValidade)}</p>
            <div className="metrics-grid">
              <MetricCard title="Status" value={survey.ativo ? 'Ativa' : 'Inativa'}>
                <span className={`status-pill ${survey.ativo ? 'success' : 'neutral'}`}>
                  {survey.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </MetricCard>
              <MetricCard title="Perguntas" value={questionMetrics.totalQuestions} delta={`Média ${questionMetrics.avgOptions}`}>
                <span className="metric-card__dot" />
              </MetricCard>
              <MetricCard
                title="Opções ativas"
                value={questionMetrics.activeOptions}
                delta={`Inativas ${questionMetrics.inactiveOptions}`}
              >
                <span className="metric-card__dot" />
              </MetricCard>
              <MetricCard
                title="Perguntas sem opções"
                value={questionMetrics.questionsWithoutActiveOptions}
              >
                <span className="metric-card__dot neutral" />
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

          {(metrics?.peakQuestionAbandonment || metrics?.overview?.peakQuestionAbandonment) && (
            <div className="list-card">
              <p className="eyebrow">Maior abandono</p>
              <strong>
                {(
                  metrics?.peakQuestionAbandonment ?? metrics?.overview?.peakQuestionAbandonment
                )?.texto}
              </strong>
              <span className="muted-text">
                Taxa de abandono{' '}
                {(
                  metrics?.peakQuestionAbandonment ?? metrics?.overview?.peakQuestionAbandonment
                )?.abandonmentRate !== undefined
                  ? `${(
                      metrics?.peakQuestionAbandonment ?? metrics?.overview?.peakQuestionAbandonment
                    )?.abandonmentRate?.toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          )}

          {metrics?.responsesOverTime && metrics.responsesOverTime.length > 0 && (
            <div className="list-card">
              <p className="eyebrow">Respostas ao longo do tempo</p>
              <ul className="simple-list">
                {metrics.responsesOverTime.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {metrics?.statsByQuestion && metrics.statsByQuestion.length > 0 && (
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
                  {metrics?.statsByQuestion?.map((question) => (
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
          )}
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
            <article className="stat-card">
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

      {survey && (
        <section className="panel grid-two-columns">
          <form className="form-vertical" onSubmit={handleQuestionSubmit}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Perguntas</p>
                <h2>Novo bloco</h2>
              </div>
            </div>
            <label className="form-field">
              <span>Texto</span>
              <textarea
                required
                minLength={3}
                value={questionForm.texto}
                onChange={(event) =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    texto: event.target.value,
                  }))
                }
                placeholder="Qual sua faixa etária?"
              />
            </label>
            <label className="form-field">
              <span>Ordem</span>
              <input
                required
                type="number"
                min={1}
                value={questionForm.ordem}
                onChange={(event) =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    ordem: Number(event.target.value),
                  }))
                }
              />
            </label>
            <button className="btn primary" type="submit">
              Adicionar pergunta
            </button>
          </form>

          <form className="form-vertical" onSubmit={handleOptionSubmit}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Opções</p>
                <h2>Resposta vinculada</h2>
              </div>
            </div>
            <label className="form-field">
              <span>Pergunta</span>
              <select
                required
                value={optionForm.questionId}
                onChange={(event) =>
                  setOptionForm((prev) => ({
                    ...prev,
                    questionId: event.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {survey.questions.map((question) => (
                  <option key={question.id} value={question.id}>
                    #{question.ordem} - {question.texto}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Texto</span>
              <input
                required
                value={optionForm.texto}
                onChange={(event) =>
                  setOptionForm((prev) => ({
                    ...prev,
                    texto: event.target.value,
                  }))
                }
                placeholder="Entre 18 e 25 anos"
              />
            </label>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={optionForm.ativo}
                onChange={(event) =>
                  setOptionForm((prev) => ({
                    ...prev,
                    ativo: event.target.checked,
                  }))
                }
              />
              <span>Ativa</span>
            </label>
            <button className="btn secondary" type="submit">
              Adicionar opção
            </button>
            {formError && <p className="error-text">{formError}</p>}
            {feedback && <p className="success-text">{feedback}</p>}
          </form>
        </section>
      )}

      {survey && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Estrutura</p>
              <h2>Perguntas e opções</h2>
            </div>
            <div className="hero-actions">
              <button className="btn ghost" type="button">
                Reordenar
              </button>
              <button className="btn secondary" type="button">
                Exportar
              </button>
            </div>
          </div>
          <div className="questions-list">
            {survey.questions.length === 0 && <p>Nenhuma pergunta cadastrada.</p>}
            {survey.questions.map((question) => (
              <article key={question.id} className="question-card">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">#{question.ordem}</p>
                    <h3>{question.texto}</h3>
                  </div>
                  <div className="card-actions">
                    <button className="btn ghost small" type="button">
                      Editar
                    </button>
                    <button className="btn ghost small" type="button">
                      Duplicar
                    </button>
                  </div>
                </div>
                <ul className="options-list">
                  {(question.options ?? []).length === 0 && (
                    <li className="option-row muted">Sem opções cadastradas.</li>
                  )}
                  {(question.options ?? []).map((option) => (
                    <li key={option.id} className="option-row">
                      <span>{option.texto}</span>
                      <span className={`status-pill ${option.ativo ? 'success' : 'neutral'}`}>
                        {option.ativo ? 'Ativa' : 'Inativa'}
                      </span>
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

export default SurveyDetailPage
