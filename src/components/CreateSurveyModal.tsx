import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { optionApi, parseApiError, questionApi, surveyApi } from '../services/api'

const uniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type DraftOption = {
  id: string
  texto: string
  ativo: boolean
}

type DraftQuestion = {
  id: string
  texto: string
  ordem: number
  options: DraftOption[]
}

const MAX_ACTIVE_OPTIONS = 5

const createOptionDraft = (ativo = true): DraftOption => ({
  id: uniqueId(),
  texto: '',
  ativo,
})

const createQuestionDraft = (ordem: number): DraftQuestion => ({
  id: uniqueId(),
  texto: '',
  ordem,
  options: [createOptionDraft()],
})

const countActiveOptions = (options: DraftOption[]) => options.filter((option) => option.ativo).length

type CreateSurveyModalProps = {
  open: boolean
  onClose: () => void
  onCreated: () => Promise<void> | void
}

const CreateSurveyModal = ({ open, onClose, onCreated }: CreateSurveyModalProps) => {
  const [titulo, setTitulo] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [dataValidade, setDataValidade] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>([createQuestionDraft(1)])
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const questionCount = questions.length

  const questionSummary = useMemo(() => {
    return questions.reduce(
      (acc, question) => {
        acc.options += question.options.length
        return acc
      },
      { options: 0 },
    )
  }, [questions])

  const closeAndReset = () => {
    setTitulo('')
    setDataValidade('')
    setAtivo(true)
    setQuestions([createQuestionDraft(1)])
    setError(undefined)
    setIsSaving(false)
    onClose()
  }

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createQuestionDraft(prev.length + 1)])
  }

  const handleRemoveQuestion = (id: string) => {
    setQuestions((prev) => {
      const filtered = prev.filter((question) => question.id !== id)
      return filtered.length ? filtered : prev
    })
  }

  const updateQuestion = (id: string, updates: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((question) => (question.id === id ? { ...question, ...updates } : question)),
    )
  }

  const handleAddOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) return question
        const activeCount = countActiveOptions(question.options)
        const reachedLimit = activeCount >= MAX_ACTIVE_OPTIONS
        if (reachedLimit) {
          setError(
            `Máximo de ${MAX_ACTIVE_OPTIONS} opções ativas por pergunta. A nova opção foi criada como inativa.`,
          )
        }
        const newOption = createOptionDraft(!reachedLimit)
        return {
          ...question,
          options: [...question.options, newOption],
        }
      }),
    )
  }

  const handleRemoveOption = (questionId: string, optionId: string) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.length > 1 ? question.options.filter((option) => option.id !== optionId) : question.options,
            }
          : question,
      ),
    )
  }

  const updateOption = (questionId: string, optionId: string, updates: Partial<DraftOption>) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) return question
        const targetOption = question.options.find((option) => option.id === optionId)
        if (!targetOption) return question

        const activeCount = countActiveOptions(question.options)
        const willActivate = updates.ativo === true && !targetOption.ativo
        if (willActivate && activeCount >= MAX_ACTIVE_OPTIONS) {
          setError(
            `Máximo de ${MAX_ACTIVE_OPTIONS} opções ativas por pergunta. Desative uma opção antes de ativar outra.`,
          )
          return question
        }

        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, ...updates } : option,
          ),
        }
      }),
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(undefined)

    if (!titulo.trim()) {
      setError('Informe um título para a pesquisa.')
      return
    }

    if (!questions.every((question) => question.texto.trim())) {
      setError('Todas as perguntas precisam de um texto.')
      return
    }

    const hasTooManyActiveOptions = questions.some(
      (question) => countActiveOptions(question.options) > MAX_ACTIVE_OPTIONS,
    )
    if (hasTooManyActiveOptions) {
      setError(`Cada pergunta pode ter no máximo ${MAX_ACTIVE_OPTIONS} opções ativas.`)
      return
    }

    setIsSaving(true)
    try {
      const createdSurvey = await surveyApi.create({
        titulo: titulo.trim(),
        ativo,
        dataValidade: dataValidade ? new Date(dataValidade).toISOString() : null,
      })

      for (const question of questions) {
        const createdQuestion = await questionApi.create({
          texto: question.texto.trim(),
          ordem: question.ordem,
          surveyId: createdSurvey.id,
        })
        for (const option of question.options) {
          if (!option.texto.trim()) continue
          await optionApi.create({
            texto: option.texto.trim(),
            ativo: option.ativo,
            questionId: createdQuestion.id,
          })
        }
      }

      await onCreated()
      closeAndReset()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal__header">
          <div>
            <p className="eyebrow">Nova pesquisa</p>
            <h2>Monte a estrutura completa</h2>
          </div>
          <button className="btn ghost" type="button" onClick={closeAndReset}>
            Fechar
          </button>
        </header>
        <div className="modal__content">
          <form className="modal__form" onSubmit={handleSubmit}>
            <section>
              <h3>Informações básicas</h3>
              <div className="form-field">
                <span>Título</span>
                <input value={titulo} onChange={(event) => setTitulo(event.target.value)} required placeholder="Pesquisa de Satisfação" />
              </div>
              <div className="form-field">
                <span>Data de validade</span>
                <input
                  type="datetime-local"
                  value={dataValidade}
                  onChange={(event) => setDataValidade(event.target.value)}
                />
              </div>
              <label className="form-checkbox">
                <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
                <span>Ativa ao publicar</span>
              </label>
            </section>

            <section>
              <div className="modal__section-header">
                <div>
                  <h3>Perguntas ({questionCount})</h3>
                  <p className="section-subtitle">
                    {questionSummary.options} opções configuradas
                  </p>
                </div>
                <button type="button" className="btn secondary small" onClick={handleAddQuestion}>
                  Adicionar pergunta
                </button>
              </div>

              <div className="questions-builder">
                {questions.map((question, questionIndex) => (
                  <article key={question.id} className="question-card builder">
                    <div className="card-header">
                      <div>
                        <p className="eyebrow">#{questionIndex + 1}</p>
                        <input
                          className="input-unstyled"
                          value={question.texto}
                          onChange={(event) => updateQuestion(question.id, { texto: event.target.value })}
                          placeholder="Digite o texto da pergunta"
                          required
                        />
                      </div>
                      {questions.length > 1 && (
                        <button type="button" className="btn ghost small" onClick={() => handleRemoveQuestion(question.id)}>
                          Remover
                        </button>
                      )}
                    </div>
                    <label className="form-field">
                      <span>Ordem</span>
                      <input
                        type="number"
                        min={1}
                        value={question.ordem}
                        onChange={(event) =>
                          updateQuestion(question.id, { ordem: Number(event.target.value) || questionIndex + 1 })
                        }
                      />
                    </label>

                    <div className="options-builder">
                      <p className="eyebrow">Opções</p>
                      {question.options.map((option) => (
                        <div key={option.id} className="option-builder-row">
                          <input
                            value={option.texto}
                            onChange={(event) => updateOption(question.id, option.id, { texto: event.target.value })}
                            placeholder="Texto da opção"
                          />
                          <label className="form-checkbox">
                            <input
                              type="checkbox"
                              checked={option.ativo}
                              onChange={(event) => updateOption(question.id, option.id, { ativo: event.target.checked })}
                            />
                            <span>Ativa</span>
                          </label>
                          {question.options.length > 1 && (
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => handleRemoveOption(question.id, option.id)}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => handleAddOption(question.id)}
                      >
                        Adicionar opção
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            {error && <p className="error-text">{error}</p>}
            <div className="modal__footer">
              <button type="button" className="btn ghost" onClick={closeAndReset} disabled={isSaving}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={isSaving}>
                {isSaving ? 'Publicando...' : 'Salvar e publicar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateSurveyModal
