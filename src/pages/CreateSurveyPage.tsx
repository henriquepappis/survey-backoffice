import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
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
  options: [
    createOptionDraft(),
    createOptionDraft(),
    createOptionDraft(),
    createOptionDraft(),
    createOptionDraft(),
  ],
})

const countActiveOptions = (options: DraftOption[]) => options.filter((option) => option.ativo).length

const TEMPLATE_TITLE = 'Satisfação dos Clientes – Rede de Supermercados'
const TEMPLATE_DESCRIPTION =
  'Esta pesquisa tem como objetivo avaliar a satisfação dos clientes em diferentes áreas dos supermercados. Selecione o supermercado que melhor representa sua opinião para cada item.'
const TEMPLATE_OPTIONS = [
  'Supermercado NovaVida',
  'Supermercado PreçoBom',
  'Supermercado Econômico+',
  'Supermercado FamíliaMax',
  'Supermercado UltraMarket',
]
const TEMPLATE_QUESTIONS = [
  'Qual supermercado você considera mais organizado e limpo nas áreas internas?',
  'Qual supermercado oferece a melhor limpeza e higienização dos banheiros?',
  'Qual supermercado tem o melhor estacionamento em termos de espaço, acesso e vagas disponíveis?',
  'Qual supermercado possui a garagem mais segura e bem organizada?',
  'Em qual supermercado o setor de hortifrúti oferece melhor qualidade e apresentação dos produtos?',
  'Qual supermercado oferece o melhor atendimento no setor de açougue?',
  'Qual supermercado possui a melhor organização nas gôndolas e prateleiras?',
  'Em qual supermercado você encontra filas mais rápidas e caixas mais eficientes?',
  'Em qual supermercado você percebe maior variedade de produtos?',
  'Qual supermercado você considera, no geral, o melhor para fazer compras?',
]

const CreateSurveyPage = () => {
  const navigate = useNavigate()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [dataValidade, setDataValidade] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>([createQuestionDraft(1)])
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState<string>()
  const [selectedTemplate, setSelectedTemplate] = useState('')

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
              options:
                question.options.length > 1
                  ? question.options.filter((option) => option.id !== optionId)
                  : question.options,
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
    setSuccess(undefined)

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
        descricao: descricao.trim() || null,
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

      setSuccess('Pesquisa criada com sucesso.')
      navigate(`/surveys/${createdSurvey.id}`)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout title="Nova pesquisa" subtitle="Crie a estrutura com perguntas e opções">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>Informações básicas</h2>
          </div>
          <div className="hero-actions">
            <label className="form-field" style={{ minWidth: '220px' }}>
              <span>Template</span>
              <div className="inline-template">
                <select
                  value={selectedTemplate}
                  onChange={(event) => {
                    const value = event.target.value
                    setSelectedTemplate(value)
                    if (value === 'supermarkets') {
                      const builtQuestions = TEMPLATE_QUESTIONS.map((texto, index) => ({
                        id: uniqueId(),
                        texto,
                        ordem: index + 1,
                        options: TEMPLATE_OPTIONS.map((optionTexto) => ({
                          id: uniqueId(),
                          texto: optionTexto,
                          ativo: true,
                        })),
                      }))
                      setTitulo(TEMPLATE_TITLE)
                      setDescricao(TEMPLATE_DESCRIPTION)
                      setAtivo(true)
                      setQuestions(builtQuestions)
                      setError(undefined)
                      setSuccess(undefined)
                    }
                  }}
                >
                  <option value="">Selecione</option>
                  <option value="supermarkets">Satisfação – Supermercados</option>
                </select>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    setTitulo('')
                    setDescricao('')
                    setAtivo(true)
                    setDataValidade('')
                    setQuestions([createQuestionDraft(1)])
                    setSelectedTemplate('')
                    setError(undefined)
                    setSuccess(undefined)
                  }}
                >
                  Limpar
                </button>
              </div>
            </label>
          </div>
        </div>
        <form className="form-vertical" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Título</span>
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
              placeholder="Pesquisa de Satisfação"
            />
          </label>
          <label className="form-field">
            <span>Descrição</span>
            <textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Contexto ou objetivo da pesquisa"
              maxLength={1000}
            />
          </label>
          <label className="form-field">
            <span>Data de validade</span>
            <input
              type="datetime-local"
              value={dataValidade}
              onChange={(event) => setDataValidade(event.target.value)}
            />
          </label>
          <label className="form-checkbox">
            <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
            <span>Ativa ao publicar</span>
          </label>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Perguntas</p>
            <p className="section-subtitle">
              {questions.length} {questions.length === 1 ? 'pergunta' : 'perguntas'} configuradas
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" className="btn secondary" onClick={handleAddQuestion}>
              Adicionar pergunta
            </button>
          </div>
        </div>

        <div className="questions-builder">
          {questions.map((question, questionIndex) => (
            <article key={question.id} className="question-card builder">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Pergunta #{questionIndex + 1}</p>
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
                <button type="button" className="btn secondary small" onClick={() => handleAddOption(question.id)}>
                  Adicionar opção
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="hero-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/surveys')}>
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Salvando...' : ativo ? 'Salvar e publicar' : 'Salvar'}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}
      </section>
    </Layout>
  )
}

export default CreateSurveyPage
