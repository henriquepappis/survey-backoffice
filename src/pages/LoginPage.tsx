import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, parseApiError } from '../services/api'

type LoginPageProps = {
  onLogin?: () => void
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(undefined)
    try {
      await authApi.login({ username: username.trim(), password })
      onLogin?.()
      navigate('/', { replace: true })
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div>
          <p className="eyebrow">Acesso ao painel</p>
          <h1>Entrar</h1>
          <p className="muted-text">Use suas credenciais administrativas para acessar o backoffice.</p>
        </div>
        <form className="form-vertical" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Usuário</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>
          <label className="form-field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="btn primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
