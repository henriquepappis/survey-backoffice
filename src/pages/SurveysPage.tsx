import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import Layout from '../components/Layout'
import { parseApiError, surveyApi } from '../services/api'
import type { Survey } from '../types/api'
import { toArray } from '../utils/response'

const parseDateSafe = (value?: string | null) => {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed
  const parsedWithZ = new Date(`${normalized}Z`)
  return Number.isNaN(parsedWithZ.getTime()) ? null : parsedWithZ
}

const formatDateOnly = (date?: string | null) => {
  const parsed = parseDateSafe(date)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('pt-BR')
}

const formatDateOrDash = (date?: string | null) => formatDateOnly(date)

const SurveysPage = () => {
  const publicSurveyBaseUrl =
    import.meta.env.VITE_PUBLIC_SURVEY_BASE_URL ?? 'http://localhost:5173/surveys'
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const fetchSurveys = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const data = await surveyApi.list({
        size: 500,
        includeDeleted: true,
        sort: 'id',
        direction: 'desc',
      })
      const normalized = toArray<Survey>(data).map((survey) => ({
        ...survey,
        deletedAt:
          (survey as unknown as { deleted_at?: string | null }).deleted_at ??
          survey.deletedAt ??
          null,
        ativo: Boolean(survey.ativo),
      }))
      setSurveys(normalized)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleViewClick = (survey: Survey) => {
    if (survey.deletedAt) return
    const isInactiveOrDeleted = !survey.ativo || Boolean(survey.deletedAt)
    const targetUrl = isInactiveOrDeleted
      ? `/surveys/${survey.id}`
      : `${publicSurveyBaseUrl}/${survey.id}`
    window.open(targetUrl, '_blank')
  }

  useEffect(() => {
    void fetchSurveys()
  }, [fetchSurveys])

  const sortedSurveys = useMemo(() => {
    return [...surveys].sort((a, b) => b.id - a.id)
  }, [surveys])

  const getStatusPills = (survey: Survey) => {
    const pills: Array<{ label: string; className: string }> = [
      survey.ativo ? { label: 'Ativa', className: 'success' } : { label: 'Inativa', className: 'neutral' },
    ]
    if (survey.deletedAt) {
      pills.push({ label: 'Removida', className: 'danger' })
    }
    return pills
  }

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

  const handleRestore = async (survey: Survey) => {
    setRestoringId(survey.id)
    setError(undefined)
    try {
      await surveyApi.restore(survey.id)
      await fetchSurveys()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setRestoringId(null)
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
            <p className="eyebrow">Pesquisas</p>
            <h2>Todas (ativas e inativas)</h2>
          </div>
        </div>

        {loading && <p>Carregando pesquisas...</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && !error && sortedSurveys.length === 0 && <p>Nenhuma pesquisa registrada.</p>}

        {sortedSurveys.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th>Deletada em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedSurveys.map((survey) => (
                  <tr key={survey.id}>
                    <td>#{survey.id}</td>
                    <td>
                      <strong>{survey.titulo}</strong>
                      {survey.descricao && <div className="muted-text muted-text--light">{survey.descricao}</div>}
                      {survey.deletedAt && (
                        <div className="muted-text">Deletada em {formatDateOnly(survey.deletedAt)}</div>
                      )}
                    </td>
                    <td>
                      <div className="status-stack">
                        {getStatusPills(survey).map((status) => (
                          <span key={status.label} className={`status-pill ${status.className}`}>
                            {status.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{formatDateOnly(survey.dataValidade)}</td>
                    <td>{formatDateOrDash(survey.deletedAt)}</td>
                    <td className="table-actions">
                      <button
                        className="btn ghost small"
                        type="button"
                        onClick={() => handleViewClick(survey)}
                        disabled={Boolean(survey.deletedAt)}
                      >
                        Ver
                      </button>
                      <Link to={`/surveys/${survey.id}/metrics`} className="btn secondary small">
                        Métricas
                    </Link>
                    <Link to={`/surveys/${survey.id}`} className="btn secondary small">
                      Editar
                    </Link>
                    {/** Ativas/inativas: permitem remoção. Deletadas: mostram reativar (desabilitado por enquanto). */}
                    {survey.deletedAt ? (
                      <button
                        className="btn danger small"
                        type="button"
                        onClick={() => handleRestore(survey)}
                        disabled={restoringId === survey.id}
                      >
                        Restaurar
                      </button>
                    ) : (
                      <button
                        className="btn danger small"
                        type="button"
                        onClick={() => setDeleteTarget(survey)}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </Layout>
  )
}

export default SurveysPage
