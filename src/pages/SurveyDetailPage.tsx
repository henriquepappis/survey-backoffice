import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { optionApi, parseApiError, questionApi, surveyApi } from '../services/api'
import type { SurveyStructure } from '../types/api'

const MAX_ACTIVE_OPTIONS = 5

const toDateValue = (value?: string | null) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (num: number) => num.toString().padStart(2, '0')
  const year = parsed.getFullYear()
  const month = pad(parsed.getMonth() + 1)
  const day = pad(parsed.getDate())
  return `${year}-${month}-${day}`
}

const SurveyDetailPage = () => {
  const { id } = useParams()
  const surveyId = Number(id)
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<SurveyStructure>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [questionForm, setQuestionForm] = useState({ texto: '', ordem: 1 })
  const [optionForm, setOptionForm] = useState({ questionId: '', texto: '', ativo: true })
  const [feedback, setFeedback] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [surveyForm, setSurveyForm] = useState({
    titulo: '',
    descricao: '',
    dataValidade: '',
    ativo: true,
  })
  const [savingSurvey, setSavingSurvey] = useState(false)
  const [surveySaveMessage, setSurveySaveMessage] = useState<string>()
  const [editingQuestion, setEditingQuestion] = useState<{ id: number; texto: string; ordem: number } | null>(null)
  const [editingOption, setEditingOption] = useState<{
    id: number
    questionId: number
    texto: string
    ativo: boolean
  } | null>(null)
  const [savingOptionId, setSavingOptionId] = useState<number | null>(null)
  const [newOptionText, setNewOptionText] = useState<Record<number, string>>({})
  const [exporting, setExporting] = useState(false)
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
      setSurveyForm({
        titulo: structureData.titulo,
        descricao: structureData.descricao ?? '',
        dataValidade: toDateValue(structureData.dataValidade),
        ativo: structureData.ativo,
      })
    } catch (err) {
      const msg = parseApiError(err)
      setError(msg)
      setToast({ type: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }, [surveyId, setToast])

  const saveQuestionEdit = async () => {
    if (!editingQuestion || !surveyId) return
    setFormError(undefined)
    try {
      await questionApi.update(editingQuestion.id, {
        texto: editingQuestion.texto.trim(),
        ordem: editingQuestion.ordem,
        surveyId,
      })
      setEditingQuestion(null)
      await loadSurvey()
    } catch (err) {
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    }
  }

  const handleExport = async () => {
    if (!surveyId) return
    setExporting(true)
    setToast(null)
    try {
      const { blob, filename } = await surveyApi.export(surveyId, { includeDeleted: true })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || `survey-${surveyId}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setToast({ type: 'success', message: 'Exportação iniciada.' })
    } catch (err) {
      const msg = parseApiError(err)
      setToast({ type: 'error', message: msg })
    } finally {
      setExporting(false)
    }
  }

  const saveOptionEdit = async () => {
    if (!editingOption || !editingOption.questionId) return
    setFormError(undefined)
    try {
      await optionApi.update(editingOption.id, {
        texto: editingOption.texto.trim(),
        ativo: editingOption.ativo,
        questionId: editingOption.questionId,
      })
      setEditingOption(null)
      await loadSurvey()
    } catch (err) {
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    }
  }

  const toggleOptionActive = async (optionId: number, questionId: number, current: boolean) => {
    setSavingOptionId(optionId)
    setFormError(undefined)
    try {
      await optionApi.update(optionId, {
        texto: survey?.questions
          .find((q) => q.id === questionId)
          ?.options?.find((opt) => opt.id === optionId)?.texto ?? '',
        ativo: !current,
        questionId,
      })
      await loadSurvey()
    } catch (err) {
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    } finally {
      setSavingOptionId(null)
    }
  }

  const handleInlineAddOption = async (questionId: number) => {
    const text = (newOptionText[questionId] ?? '').trim()
    if (!text) {
      setFormError('Informe um texto para a opção.')
      return
    }
    const question = survey?.questions.find((q) => q.id === questionId)
    if (question) {
      const activeCount = (question.options ?? []).filter((option) => option.ativo).length
      if (activeCount >= MAX_ACTIVE_OPTIONS) {
        setFormError(
          `Máximo de ${MAX_ACTIVE_OPTIONS} opções ativas por pergunta. Desative uma opção antes de ativar outra.`,
        )
        return
      }
    }
    setFormError(undefined)
    try {
      await optionApi.create({
        texto: text,
        ativo: true,
        questionId,
      })
      setNewOptionText((prev) => ({ ...prev, [questionId]: '' }))
      await loadSurvey()
    } catch (err) {
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    }
  }

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
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
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
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    }
  }

  const saveSurvey = async () => {
    if (!surveyId) return
    setSavingSurvey(true)
    setSurveySaveMessage(undefined)
    setFormError(undefined)
    try {
      await surveyApi.update(surveyId, {
        titulo: surveyForm.titulo.trim(),
        descricao: surveyForm.descricao.trim() || null,
        ativo: surveyForm.ativo,
        dataValidade: surveyForm.dataValidade
          ? new Date(`${surveyForm.dataValidade}T23:59:00`).toISOString()
          : null,
      })
      setSurveySaveMessage('Pesquisa atualizada com sucesso.')
      setToast({ type: 'success', message: 'Pesquisa atualizada com sucesso.' })
      await loadSurvey()
    } catch (err) {
      const msg = parseApiError(err)
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    } finally {
      setSavingSurvey(false)
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
            <input
              className="input-title"
              value={surveyForm.titulo}
              onChange={(event) =>
                setSurveyForm((prev) => ({
                  ...prev,
                  titulo: event.target.value,
                }))
              }
              placeholder="Título da pesquisa"
              disabled={savingSurvey}
            />
            <textarea
              className="textarea-unstyled"
              value={surveyForm.descricao}
              onChange={(event) =>
                setSurveyForm((prev) => ({
                  ...prev,
                  descricao: event.target.value,
                }))
              }
              placeholder="Descrição da pesquisa"
              rows={2}
              disabled={savingSurvey}
            />
            <div className="validity-inline">
              <label className="form-field">
                <span>Validade</span>
                <input
                  type="date"
                  value={surveyForm.dataValidade}
                  onChange={(event) =>
                    setSurveyForm((prev) => ({
                      ...prev,
                      dataValidade: event.target.value,
                    }))
                  }
                  className="input-validity"
                  disabled={savingSurvey}
                />
              </label>
            </div>
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
            <button className="btn primary" type="button" onClick={saveSurvey} disabled={savingSurvey}>
              {savingSurvey ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              disabled={isDeleting || savingSurvey}
            >
              Remover
            </button>
          </div>
        </div>
        {loading && <p>Carregando dados...</p>}
        {error && <p className="error-text">{error}</p>}
        {surveySaveMessage && <p className="success-text">{surveySaveMessage}</p>}
        {survey && !loading && !error && (
          <>
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

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
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
              <button className="btn secondary" type="button" onClick={handleExport} disabled={exporting}>
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
                    {editingQuestion?.id === question.id ? (
                      <>
                        <input
                          className="input-unstyled"
                          value={editingQuestion.texto}
                          onChange={(event) =>
                            setEditingQuestion((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    texto: event.target.value,
                                  }
                                : prev,
                            )
                          }
                        />
                        <label className="form-field" style={{ marginTop: '0.5rem' }}>
                          <span>Ordem</span>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            style={{ maxWidth: '100px' }}
                            value={editingQuestion.ordem}
                            onChange={(event) =>
                              setEditingQuestion((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      ordem: Number(event.target.value) || question.ordem,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </label>
                      </>
                    ) : (
                      <h3>{question.texto}</h3>
                    )}
                  </div>
                  <div className="card-actions">
                    {editingQuestion?.id === question.id ? (
                      <>
                        <button className="btn secondary small" type="button" onClick={saveQuestionEdit}>
                          Salvar
                        </button>
                        <button
                          className="btn ghost small"
                          type="button"
                          onClick={() => setEditingQuestion(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn ghost small"
                        type="button"
                        onClick={() =>
                          setEditingQuestion({ id: question.id, texto: question.texto, ordem: question.ordem })
                        }
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
                <ul className="options-list">
                  {(question.options ?? []).length === 0 && (
                    <li className="option-row muted">Sem opções cadastradas.</li>
                  )}
                  {(question.options ?? []).map((option) => (
                    <li key={option.id} className="option-row">
                      {editingOption?.id === option.id ? (
                        <>
                          <input
                            value={editingOption.texto}
                            onChange={(event) =>
                              setEditingOption((prev) =>
                                prev ? { ...prev, texto: event.target.value } : prev,
                              )
                            }
                          />
                          <label className="form-checkbox" style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={editingOption.ativo}
                              onChange={(event) =>
                                setEditingOption((prev) =>
                                  prev ? { ...prev, ativo: event.target.checked } : prev,
                              )
                            }
                          />
                          <span>Ativa</span>
                        </label>
                          <div className="option-row__spacer" />
                          <div className="table-actions">
                            <button className="btn secondary small" type="button" onClick={saveOptionEdit}>
                              Salvar
                            </button>
                            <button
                              className="btn ghost small"
                              type="button"
                              onClick={() => setEditingOption(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span>{option.texto}</span>
                          <div className="option-row__spacer" />
                          <button
                            className={`status-pill ${option.ativo ? 'success' : 'neutral'}`}
                            type="button"
                            onClick={() => toggleOptionActive(option.id, question.id, option.ativo)}
                            disabled={savingOptionId === option.id}
                          >
                            {savingOptionId === option.id ? '...' : option.ativo ? 'Ativa' : 'Inativa'}
                          </button>
                          <button
                            className="btn ghost small"
                            type="button"
                            onClick={() =>
                              setEditingOption({
                                id: option.id,
                                questionId: question.id,
                                texto: option.texto,
                                ativo: option.ativo,
                              })
                            }
                          >
                            Editar
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                  <li className="option-row">
                    <input
                      value={newOptionText[question.id] ?? ''}
                      onChange={(event) =>
                        setNewOptionText((prev) => ({ ...prev, [question.id]: event.target.value }))
                      }
                      placeholder="Nova opção"
                    />
                    <div className="option-row__spacer" />
                    <button
                      className="btn secondary small"
                      type="button"
                      onClick={() => void handleInlineAddOption(question.id)}
                    >
                      Adicionar
                    </button>
                  </li>
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
