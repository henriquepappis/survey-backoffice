import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { optionApi, parseApiError, questionApi, surveyApi } from '../services/api'
import type { SurveyStructure } from '../types/api'

const formatDate = (date?: string | null) => {
  if (!date) return 'Sem data definida'
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const MAX_ACTIVE_OPTIONS = 5

const SurveyDetailPage = () => {
  const { id } = useParams()
  const surveyId = Number(id)
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<SurveyStructure>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [questionForm, setQuestionForm] = useState({ texto: '', ordem: 1 })
  const [optionForm, setOptionForm] = useState({ questionId: '', texto: '', ativo: true })
  const [feedback, setFeedback] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadSurvey = useCallback(async () => {
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
  }, [surveyId])

  useEffect(() => {
    void loadSurvey()
  }, [loadSurvey])

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
      subtitle="Gerencie estrutura, perguntas e opções"
    >
      {!surveyId && <p className="error-text">ID da pesquisa inválido.</p>}
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
            {survey?.descricao && <p className="muted-text muted-text--light">{survey.descricao}</p>}
          </div>
          <div className="hero-actions">
            <Link to="/surveys" className="btn ghost">
              Voltar
            </Link>
            {surveyId && (
              <Link to={`/surveys/${surveyId}/metrics`} className="btn secondary">
                Métricas
              </Link>
            )}
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
            <p className="eyebrow">Validade</p>
            <p className="muted-text validity-text">{formatDate(survey.dataValidade)}</p>
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
            </div>
          </>
        )}
      </section>

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
