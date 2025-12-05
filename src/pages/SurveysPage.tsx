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

type StatusFilter = 'active' | 'activeInactive' | 'all'
type SortKey = 'id' | 'validity'
type SortDirection = 'asc' | 'desc'

const SurveysPage = () => {
  const publicSurveyBaseUrl =
    import.meta.env.VITE_PUBLIC_SURVEY_BASE_URL ?? 'http://localhost:5173/surveys'
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Survey | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [toast, setToast] = useState<{ type: 'error' | 'info'; message: string } | null>(null)

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
      setToast({ type: 'error', message: parseApiError(err) })
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

  const handleSort = (key: SortKey) => {
    setSortDirection((prev) => {
      if (sortKey !== key) return 'asc'
      return prev === 'asc' ? 'desc' : 'asc'
    })
    setSortKey(key)
  }

  const filteredAndSortedSurveys = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const filtered = surveys.filter((survey) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'activeInactive'
            ? !survey.deletedAt
            : survey.ativo && !survey.deletedAt
      const matchesSearch = term
        ? survey.titulo.toLowerCase().includes(term) ||
          (survey.descricao ?? '').toLowerCase().includes(term)
        : true
      return matchesStatus && matchesSearch
    })
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'id') {
        return sortDirection === 'asc' ? a.id - b.id : b.id - a.id
      }
      const dateA = parseDateSafe(a.dataValidade)?.getTime() ?? 0
      const dateB = parseDateSafe(b.dataValidade)?.getTime() ?? 0
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
    })
    return sorted
  }, [searchTerm, sortDirection, sortKey, statusFilter, surveys])

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
      setToast({ type: 'error', message: parseApiError(err) })
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
      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="Restaurar pesquisa"
        description={
          restoreTarget
            ? `Deseja restaurar "${restoreTarget.titulo}" e suas perguntas/opções?`
            : ''
        }
        confirmLabel="Restaurar"
        onCancel={() => setRestoreTarget(null)}
        onConfirm={async () => {
          if (!restoreTarget) return
          await handleRestore(restoreTarget)
          setRestoreTarget(null)
        }}
        confirmLoading={restoringId === restoreTarget?.id}
      />
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pesquisas</p>
            <h2>Todas</h2>
          </div>
          <div className="hero-actions">
            <Link to="/surveys/new" className="btn primary small">
              Criar pesquisa
            </Link>
          </div>
        </div>
        <div className="filter-group" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="active">Apenas ativas</option>
              <option value="activeInactive">Ativas e inativas</option>
              <option value="all">Todas (inclui removidas)</option>
            </select>
          </label>
          <label>
            <span>Buscar</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Título ou descrição"
            />
          </label>
        </div>
        <p className="muted-text">
          Mostrando {filteredAndSortedSurveys.length} de {surveys.length} pesquisas
        </p>

        {loading && <p>Carregando pesquisas...</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && !error && filteredAndSortedSurveys.length === 0 && (
          <p>Nenhuma pesquisa registrada.</p>
        )}

        {filteredAndSortedSurveys.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort('id')}
                    >
                      ID
                    </button>
                  </th>
                  <th>Título</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort('validity')}
                    >
                      Validade
                    </button>
                  </th>
                  <th className="text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSurveys.map((survey) => (
                  <tr key={survey.id}>
                    <td className="text-center">#{survey.id}</td>
                    <td>
                      <strong>{survey.titulo}</strong>
                    </td>
                    <td className="text-center">
                      <div className="status-stack">
                        {getStatusPills(survey).map((status) => (
                          <span key={status.label} className={`status-pill ${status.className}`}>
                            {status.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center">{formatDateOnly(survey.dataValidade)}</td>
                    <td className="table-actions text-center">
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
                        onClick={() => setRestoreTarget(survey)}
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
