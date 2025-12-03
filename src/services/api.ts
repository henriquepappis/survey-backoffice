import axios, { AxiosHeaders } from 'axios'
import type {
  ApiError,
  AuthResponse,
  CreateOptionPayload,
  CreateQuestionPayload,
  CreateSurveyPayload,
  DashboardOverview,
  LoginPayload,
  Option,
  Question,
  Survey,
  SurveyAudienceMetrics,
  SurveyAudienceResponse,
  SurveyDashboardMetrics,
  SurveyDashboardResponse,
  SurveyStructure,
  UpdateSurveyPayload,
} from '../types/api'

const generateCorrelationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

const TOKEN_STORAGE_KEY = 'survey_token'
const loginRedirectPath = '/login'
let hasRedirectedForAuth = false

const decodeJwtPayload = (token: string) => {
  try {
    const base64Payload = token.split('.')[1]
    if (!base64Payload) return null
    return JSON.parse(atob(base64Payload))
  } catch {
    return null
  }
}

const isTokenExpired = (token: string | null) => {
  if (!token) return true
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return false
  const expMs = Number(payload.exp) * 1000
  return Number.isFinite(expMs) && Date.now() >= expMs
}

const redirectToLogin = () => {
  if (typeof window === 'undefined' || hasRedirectedForAuth) return
  hasRedirectedForAuth = true
  window.location.assign(loginRedirectPath)
}

export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    delete apiClient.defaults.headers.common.Authorization
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    hasRedirectedForAuth = false
  }
}

const storedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
if (storedToken) {
  apiClient.defaults.headers.common.Authorization = `Bearer ${storedToken}`
}

apiClient.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers ?? {})
  if (!headers.has('X-Correlation-Id')) {
    headers.set('X-Correlation-Id', generateCorrelationId())
  }
  config.headers = headers
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401 || status === 403) {
      setAuthToken(null)
      redirectToLogin()
      return Promise.reject(new Error('Sessão expirada. Faça login novamente.'))
    }
    return Promise.reject(error)
  },
)

export const parseApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined
    const status = error.response?.status
    if (status === 401) {
      return data?.message || 'Credenciais inválidas.'
    }
    if (status === 403) {
      return data?.message || 'Você não tem permissão para executar esta ação.'
    }
    if (data?.message) {
      return data.errors
        ? `${data.message}: ${Object.values(data.errors).join(', ')}`
        : data.message
    }
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return 'A requisição demorou para responder. Tente novamente em instantes.'
      }
      return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
    }
    return 'Erro ao processar sua solicitação. Tente novamente mais tarde.'
  }
  if (error instanceof Error) {
    return error.message || 'Erro inesperado. Tente novamente.'
  }
  return 'Erro inesperado. Tente novamente.'
}

export const surveyApi = {
  async list(params?: {
    ativo?: boolean
    page?: number
    size?: number
    sort?: string
    direction?: 'asc' | 'desc'
  }) {
    const config = params && Object.keys(params).length > 0 ? { params } : undefined
    const response = await apiClient.get<Survey[]>('/surveys', config)
    return response.data
  },
  async create(payload: CreateSurveyPayload) {
    const response = await apiClient.post<Survey>('/surveys', payload)
    return response.data
  },
  async update(id: number, payload: UpdateSurveyPayload) {
    const response = await apiClient.put<Survey>(`/surveys/${id}`, payload)
    return response.data
  },
  async remove(id: number) {
    await apiClient.delete(`/surveys/${id}`)
  },
  async getStructure(id: number, includeInactiveOptions?: boolean) {
    const response = await apiClient.get<SurveyStructure>(`/surveys/${id}/structure`, {
      params: includeInactiveOptions ? { includeInactiveOptions } : undefined,
    })
    return response.data
  },
}

export const questionApi = {
  async list(params?: {
    surveyId?: number
    page?: number
    size?: number
    sort?: string
    direction?: 'asc' | 'desc'
  }) {
    const response = await apiClient.get<Question[]>('/questions', { params })
    return response.data
  },
  async create(payload: CreateQuestionPayload) {
    const response = await apiClient.post<Question>('/questions', payload)
    return response.data
  },
  async remove(id: number) {
    await apiClient.delete(`/questions/${id}`)
  },
}

export const optionApi = {
  async list(params?: {
    questionId?: number
    ativo?: boolean
    page?: number
    size?: number
    sort?: string
    direction?: 'asc' | 'desc'
  }) {
    const response = await apiClient.get<Option[]>('/options', { params })
    return response.data
  },
  async create(payload: CreateOptionPayload) {
    const response = await apiClient.post<Option>('/options', payload)
    return response.data
  },
  async remove(id: number) {
    await apiClient.delete(`/options/${id}`)
  },
}

export const authApi = {
  async login(payload: LoginPayload) {
    const response = await apiClient.post<AuthResponse>('/auth/login', payload)
    const headerToken = response.headers?.authorization || response.headers?.Authorization
    const extractedHeaderToken =
      headerToken && headerToken.toLowerCase().startsWith('bearer ')
        ? headerToken.slice(7)
        : headerToken
    const dataObj = response.data as unknown as Record<string, string | undefined>
    const dataToken =
      dataObj?.accessToken ??
      dataObj?.token ??
      dataObj?.Authorization ??
      dataObj?.authorization
    const token = dataToken || extractedHeaderToken
    if (!token) {
      throw new Error('Token não retornado pela API. Verifique o endpoint de login.')
    }
    setAuthToken(token)
    return { ...response.data, token }
  },
  async logout() {
    const token = authApi.getStoredToken()
    try {
      if (token) {
        await apiClient.post('/auth/logout')
      }
    } finally {
      setAuthToken(null)
    }
  },
  getStoredToken() {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
  },
  isTokenExpired,
  ensureValidSession() {
    const token = authApi.getStoredToken()
    if (isTokenExpired(token)) {
      setAuthToken(null)
      redirectToLogin()
      return null
    }
    return token
  },
}

export const dashboardApi = {
  async getOverview() {
    const response = await apiClient.get<DashboardOverview>('/dashboard/overview')
    return response.data
  },
  async getSurveyMetrics(id: number, params?: { from?: string; to?: string }) {
    const response = await apiClient.get<SurveyDashboardResponse>(`/dashboard/surveys/${id}`, {
      params,
    })
    const data = response.data
    const overview = data.overview ?? {}
    const toNumber = (value: unknown) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : undefined
    }

    const totals = {
      responses: toNumber(overview.totalResponses),
      completions: toNumber(overview.totalCompletions),
      abandons: toNumber(overview.totalAbandons),
      completionRate: toNumber(overview.completionRate),
      abandonmentRate: toNumber(overview.abandonmentRate),
      avgResponseTimeSeconds:
        toNumber(overview.avgResponseTimeSeconds ?? overview.averageResponseTimeSeconds),
    }
    return {
      overview,
      totals,
      totalResponses: totals.responses ?? toNumber(overview.totalResponses),
      totalCompletions: totals.completions ?? toNumber(overview.totalCompletions),
      totalAbandons: totals.abandons ?? toNumber(overview.totalAbandons),
      completionRate: totals.completionRate ?? toNumber(overview.completionRate),
      abandonmentRate: totals.abandonmentRate ?? toNumber(overview.abandonmentRate),
      avgResponseTimeSeconds:
        overview.avgResponseTimeSeconds ?? overview.averageResponseTimeSeconds,
      predominantDevice: overview.predominantDevice,
      peakQuestionAbandonment:
        overview.peakQuestionAbandonment ||
        (overview.mostAbandonedQuestion
          ? { texto: overview.mostAbandonedQuestion }
          : undefined),
      statsByQuestion: data.questions?.map((question) => {
        const options =
          question.options?.map((option) => {
            const opt = option as Record<string, unknown>
            const optionResponses =
              toNumber(
                opt.total ??
                  opt.responses ??
                  opt.totalResponses ??
                  opt.count ??
                  opt.value,
              ) ?? 0
            return {
              optionId: option.optionId,
              texto: option.optionText,
              responses: optionResponses,
              percentage:
                option.percentage ??
                toNumber(opt.percent ?? opt.rate ?? opt.ratio)?.valueOf(),
            }
          }) ?? []
        const questionResponses =
          toNumber(
            (question as { totalResponses?: unknown }).totalResponses ??
              (question as { responses?: unknown }).responses ??
              (question as { total?: unknown }).total ??
              (question as { count?: unknown }).count,
          ) ??
          options.reduce((acc, option) => acc + (option.responses ?? 0), 0)
        return {
          questionId: question.questionId,
          texto: question.questionText,
          responses: questionResponses,
          options,
        }
      }),
      responsesOverTime:
        data.timeSeries?.daily?.map((item) => ({
          label: item.date,
          count: item.total,
        })) ||
        data.timeSeries?.hourly?.map((item) => ({
          label: item.hour,
          count: item.total,
        })),
    } satisfies SurveyDashboardMetrics
  },
  async getSurveyAudience(id: number, params?: { from?: string; to?: string }) {
    const response = await apiClient.get<SurveyAudienceResponse>(`/dashboard/surveys/${id}/audience`, {
      params,
    })
    const data = response.data

    const mapRecord = (record?: Record<string, number>) =>
      record
        ? Object.entries(record).map(([label, value]) => ({
            label,
            value,
          }))
        : undefined

    const mapPeak = (
      arr?: Array<{ label?: string; hour?: string; day?: string; total?: number } | string>,
    ) =>
      arr
        ?.map((item) => {
          if (typeof item === 'string') return { label: item, value: 0 }
          const label = item.label ?? item.hour ?? item.day
          const value = item.total ?? 0
          return label ? { label, value } : undefined
        })
        .filter(Boolean) as SurveyAudienceMetrics['peakHours']

    return {
      deviceDistribution: mapRecord(data.devices),
      osDistribution: mapRecord(data.operatingSystems),
      browserDistribution: mapRecord(data.browsers),
      sourceDistribution: mapRecord(data.sources),
      countryDistribution: mapRecord(data.countries),
      stateDistribution: mapRecord(data.states),
      cityDistribution: mapRecord(data.cities),
      peakHours: mapPeak(data.peakHours),
      peakDays: mapPeak(data.peakDays),
      avgTimeToAbandonSeconds: data.averageAbandonmentTimeSeconds,
      uniqueRespondents: data.uniqueRespondents,
      duplicateRespondents: data.duplicateResponses,
      suspiciousSessions: data.suspiciousIndicators,
    } satisfies SurveyAudienceMetrics
  },
}
