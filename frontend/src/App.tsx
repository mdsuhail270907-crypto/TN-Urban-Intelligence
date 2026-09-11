import { useEffect, useState } from 'react';
import CommandCenterDashboard from './components/CommandCenterDashboard';
import { authApi } from './services/api';
import type { User } from './types';
import './App.css';

const TOKEN_KEY = 'urban-command-center-token';

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({
    email: 'admin.phase4@example.com',
    password: 'AdminPass123'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }

    const verifySession = async () => {
      try {
        const result = await authApi.me();
        setUser(result.data);
        setAuthError(null);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setAuthError('Session expired. Please log in again.');
      } finally {
        setAuthLoading(false);
      }
    };

    void verifySession();
  }, [token]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const result = await authApi.login(loginForm.email, loginForm.password);
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      setUser(result.data.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to log in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setAuthError('Logged out.');
  };

  if (authLoading) {
    return <div className="loading-screen">Loading dashboard...</div>;
  }

  if (!token || !user) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <p className="eyebrow">Urban Command Center</p>
          <h1>Secure Access</h1>
          <p className="login-subtitle">Sign in to access live fleet, route, telemetry, and AI intelligence.</p>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>

            {authError && <div className="login-error">{authError}</div>}

            <button type="submit" disabled={isSubmitting} className="primary-button login-submit">
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <CommandCenterDashboard token={token} user={user} onLogout={handleLogout} />;
}

export default App;
