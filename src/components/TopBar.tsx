import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'

type TopBarProps = {
  title?: string
  subtitle?: string
}

const TopBar = ({ title = 'Painel', subtitle }: TopBarProps) => {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await authApi.logout()
    } finally {
      setIsLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="topbar">
      <div>
        {subtitle && <p className="eyebrow">{subtitle}</p>}
        <h1>{title}</h1>
      </div>
      <div className="topbar__actions">
        <button
          className="btn ghost small"
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </header>
  )
}

export default TopBar
