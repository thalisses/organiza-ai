import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  signIn,
  signOut,
  signUp,
  subscribeToAuthState,
} from '../lib/authService';
import {
  validateAvailabilityWindows,
  type AvailabilityWindow,
} from '../lib/availabilityService';
import AvailabilityEditor from './AvailabilityEditor';
import AvailabilityManager from './AvailabilityManager';
import SectorLeaderManagement from './SectorLeaderManagement';

const CityMap = lazy(() => import('../../territory-map/components/CityMap'));
const ActManagement = lazy(() => import('../../acts/components/ActManagement'));
const ActAgenda = lazy(() => import('../../acts/components/ActAgenda'));
const MaterialPointManagement = lazy(() => import('../../material-points/components/MaterialPointManagement'));
const MaterialPointDiscovery = lazy(() => import('../../material-points/components/MaterialPointDiscovery'));

type AuthMode = 'login' | 'signup';

export default function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeToAuthState((sessionIsActive) => {
      setHasSession(sessionIsActive);
      if (!sessionIsActive) {
        setMode('login');
        setName('');
        setWhatsapp('');
        setAvailability([]);
        setPassword('');
        setNotice('');
      }
    });
  }, []);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'signup') {
        validateAvailabilityWindows(availability);
        const result = await signUp({ name, whatsapp, email, password, availability });
        setHasSession(Boolean(result.session));
        setNotice(
          result.session
            ? 'Sessão iniciada.'
            : 'Conta criada. Entre para continuar.',
        );
      } else {
        const result = await signIn({ email, password });
        setHasSession(Boolean(result.session));
        setNotice('Sessão iniciada.');
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível concluir. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      await signOut();
      setHasSession(false);
      setMode('login');
      setName('');
      setWhatsapp('');
      setAvailability([]);
      setPassword('');
      setNotice('Você saiu da sua conta.');
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : 'Não foi possível sair. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-identity" aria-label="Organiza AI em Maringá">
        <div className="identity-topline">
          <span className="brand-mark" aria-hidden="true">★</span>
          <span>Organiza AI</span>
        </div>
        <div className="identity-copy">
          <p className="identity-location">Maringá, Paraná</p>
          <p className="identity-statement">Mobilização começa no território.</p>
        </div>
        <div className="territory-motif" aria-hidden="true">
          <span className="territory-block block-one">01</span>
          <span className="territory-block block-two">02</span>
          <span className="territory-block block-three">03</span>
          <span className="territory-block block-four">04</span>
          <span className="territory-line" />
        </div>
        <p className="identity-caption">Organização estudantil em rede</p>
      </aside>

      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-panel">
          <p className="auth-kicker">Área de mobilização</p>
          <h1 id="auth-title">Organiza AI</h1>
          <p className="auth-description">
            Entre para acompanhar sua região e os próximos atos.
          </p>
          {!hasSession && (
            <>
              <h2 className="auth-mode-title">
                {mode === 'signup' ? 'Criar conta' : 'Entrar na conta'}
              </h2>

              <div className="auth-switch" role="group" aria-label="Acesso à conta">
                <button
                  aria-pressed={mode === 'login'}
                  className={mode === 'login' ? 'is-selected' : ''}
                  onClick={() => changeMode('login')}
                  type="button"
                >
                  Entrar
                </button>
                <button
                  aria-pressed={mode === 'signup'}
                  className={mode === 'signup' ? 'is-selected' : ''}
                  onClick={() => changeMode('signup')}
                  type="button"
                >
                  Criar conta
                </button>
              </div>
            </>
          )}

          {error && (
            <div
              aria-labelledby="auth-error-title"
              className="auth-error"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              <h2 id="auth-error-title">Não foi possível continuar</h2>
              <p>{error}</p>
            </div>
          )}

          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}

          {!hasSession && <form autoComplete="on" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <label htmlFor="name">Seu nome</label>
                <input
                  autoComplete="name"
                  id="name"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />

                <label htmlFor="whatsapp">WhatsApp</label>
                <input
                  autoComplete="tel"
                  id="whatsapp"
                  inputMode="tel"
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="(44) 99999-0000"
                  required
                  type="tel"
                  value={whatsapp}
                />

                <AvailabilityEditor
                  allowMultipleDays
                  onChange={setAvailability}
                  windows={availability}
                />
              </>
            )}

            <label htmlFor="email">E-mail</label>
            <input
              autoComplete="email"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />

            <label htmlFor="password">Senha</label>
            <input
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              id="password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />

            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Aguarde…'
                : mode === 'signup'
                  ? 'Cadastrar'
                  : 'Entrar na conta'}
            </button>
          </form>}

          {hasSession && (
            <div className="auth-session">
              <p role="status">Sessão ativa.</p>
              <Suspense fallback={<p className="city-map-loading" role="status">Carregando mapa urbano…</p>}>
                <CityMap />
              </Suspense>
              <Suspense fallback={<p role="status">Carregando gestão de atos…</p>}>
                <ActManagement />
              </Suspense>
              <Suspense fallback={<p role="status">Carregando agenda de atos…</p>}>
                <ActAgenda />
              </Suspense>
              <Suspense fallback={<p role="status">Carregando gestão de locais de retirada…</p>}>
                <MaterialPointManagement />
              </Suspense>
              <Suspense fallback={<p role="status">Carregando locais de retirada…</p>}>
                <MaterialPointDiscovery />
              </Suspense>
              <SectorLeaderManagement />
              <AvailabilityManager />
              <button
                className="auth-signout"
                disabled={isSubmitting}
                onClick={handleSignOut}
                type="button"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
