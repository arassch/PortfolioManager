import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Upload, 
  Edit2,
  Trash2,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

// Models
import { Account } from './models/Account';
import { Portfolio } from './models/Portfolio';
import { Projection } from './models/Projection';

// Controllers
import AccountController from './controllers/AccountController';
import RuleController from './controllers/RuleController';
import ProjectionController from './controllers/ProjectionController';

// Services
import CurrencyService from './services/CurrencyService';

// Hooks
import { usePortfolioData } from './hooks/usePortfolioData';
import { useProjections } from './hooks/useProjections';
import { useAuth } from './hooks/useAuth';

// Components
import { SummaryCard } from './components/SummaryCard';
import { AccountForm } from './components/AccountForm';
import { AccountItem } from './components/AccountItem';
import { TransferRuleForm } from './components/TransferRuleForm';
import { TransferRuleItem } from './components/TransferRuleItem';
import { ChartSection } from './components/ChartSection';
import { ProjectionComparisonSection } from './components/ProjectionComparisonSection';
import { PortfolioSettings } from './components/PortfolioSettings';
import { OnboardingTour } from './components/OnboardingTour';
import StorageService from './services/StorageService';

// Constants
import { CURRENCY_SYMBOLS } from './constants/currencies';
import { TERMS_SECTIONS, TERMS_EFFECTIVE_DATE } from './content/terms';
import { PRIVACY_SECTIONS, PRIVACY_EFFECTIVE_DATE } from './content/privacy';

function AuthScreen({ auth }) {
  const [mode, setMode] = useState('login'); // login | register | resetRequest | resetConfirm
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [showResend, setShowResend] = useState(false);
  const googleButtonRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const showGoogleButton = !!googleClientId && (mode === 'login' || mode === 'register');

  // If a token is present in the URL (e.g., /reset?token=...), jump straight to confirm mode.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    const verifyToken = params.get('verify');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode('resetConfirm');
    } else if (verifyToken) {
      auth.verifyEmail(verifyToken)
        .then(() => {
          setResetMessage('Email verified! You are now signed in.');
          setMode('login');
        })
        .catch((err) => {
          setLocalError(err.message || 'Verification failed.');
        });
    }
  }, []);

  useEffect(() => {
    if (!googleClientId) return;
    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => console.error('Failed to load Google Identity Services');
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleReady) return;
    if (!showGoogleButton) return;
    if (!googleButtonRef.current) return;
    const google = window.google;
    if (!google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        setLocalError('');
        setResetMessage('');
        try {
          await auth.loginWithGoogle(response.credential);
        } catch (err) {
          setLocalError(err.message || 'Google sign-in failed');
        }
      }
    });

    googleButtonRef.current.innerHTML = '';
    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 360,
      text: 'continue_with'
    });
  }, [googleReady, showGoogleButton, googleClientId, auth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setResetMessage('');
    setShowResend(false);
    try {
      if (mode === 'login') {
        await auth.login(email, password);
      } else if (mode === 'register') {
        const result = await auth.register(email, password);
        if (result?.verificationSent) {
          setResetMessage(result.message || 'Check your email to verify your account.');
          setMode('login');
          return;
        }
      } else if (mode === 'resetRequest') {
        await auth.requestPasswordReset(email);
        setResetMessage('If that email exists, a reset link has been sent.');
        setMode('login');
      }
    } catch (err) {
      setLocalError(err.message || 'Authentication failed');
      if (err?.data?.needVerification || (err.message || '').toLowerCase().includes('verify')) {
        setShowResend(true);
      }
    }
  };

  const handleResendVerification = async () => {
    setLocalError('');
    setResetMessage('');
    try {
      await auth.resendVerification(email);
      setResetMessage('Verification email sent. Check your inbox.');
    } catch (err) {
      setLocalError(err.message || 'Failed to resend verification email');
    }
  };

  const handleStartCheckout = async (plan) => {
    setIsStartingCheckout(true);
    try {
      const res = await StorageService.startCheckout(plan);
      if (res.free) {
        window.location.reload();
        return;
      }
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setLocalError(err.message || 'Failed to start checkout');
    } finally {
      setIsStartingCheckout(false);
    }
  };
  const handleManageBilling = async () => {
    setIsStartingCheckout(true);
    try {
      const res = await StorageService.openPortal();
      if (res.free) {
        alert('Your account is whitelisted; no billing needed.');
        return;
      }
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setLocalError(err.message || 'Failed to open billing portal');
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const handleResetConfirm = async (e) => {
    e.preventDefault();
    setLocalError('');
    setResetMessage('');
    if (!resetToken) {
      setLocalError('Reset link is missing or expired. Request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    try {
      await auth.confirmPasswordReset(resetToken, password);
      setResetMessage('Password updated. You can sign in now.');
      setMode('login');
      // Clear token from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      setLocalError(err.message || 'Reset failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Portfolio Planner</h1>
        <p className="text-purple-200 text-center mb-6">
          {mode === 'login' && 'Sign in to your account'}
          {mode === 'register' && 'Create an account to get started'}
          {mode === 'resetRequest' && 'Request a password reset'}
          {mode === 'resetConfirm' && 'Set a new password'}
        </p>
        {mode === 'resetConfirm' ? (
          <form onSubmit={handleResetConfirm} className="space-y-4">
            <div>
              <label className="block text-sm text-purple-100 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-purple-100 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                required
              />
            </div>
            {(localError || auth.error) && (
              <div className="text-red-300 text-sm">{localError || auth.error}</div>
            )}
            {resetMessage && (
              <div className="text-green-300 text-sm">{resetMessage}</div>
            )}
            <button
              type="submit"
              disabled={auth.isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-all"
            >
              {auth.isLoading ? 'Working...' : 'Update Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-purple-100 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                required
              />
            </div>
            {mode !== 'resetRequest' && (
              <div>
                <label className="block text-sm text-purple-100 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  required
                />
              </div>
            )}

            {(localError || auth.error) && (
              <div className="text-red-300 text-sm">{localError || auth.error}</div>
            )}
            {resetMessage && (
              <div className="text-green-300 text-sm">{resetMessage}</div>
            )}
            {mode === 'login' && showResend && (
              <div className="mt-2 text-xs text-purple-100 text-center">
                {(localError || auth.error) && (localError?.toLowerCase().includes('verify') || auth.error?.toLowerCase().includes('verify')) && (
                  <div className="text-red-200 mb-1">Email not verified.</div>
                )}
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="underline"
                >
                  Resend verification email
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={auth.isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-all"
            >
              {auth.isLoading
                ? 'Working...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Create Account'
                    : 'Send Reset Email'}
            </button>

            {showGoogleButton && (
              <div className="pt-2">
                <div className="flex items-center gap-3 my-2">
                  <div className="h-px bg-white/20 flex-1" />
                  <span className="text-xs text-purple-200">or</span>
                  <div className="h-px bg-white/20 flex-1" />
                </div>
                <div className="flex justify-center">
                  <div ref={googleButtonRef} />
                </div>
              </div>
            )}
          </form>
        )}

        <div className="mt-4 text-center text-sm text-purple-100">
          {mode === 'login' ? (
            <div className="space-y-2">
              <button className="underline block w-full" onClick={() => setMode('register')}>
                Need an account? Sign up
              </button>
              <button className="underline block w-full" onClick={() => setMode('resetRequest')}>
                Forgot password?
              </button>
            </div>
          ) : mode === 'register' ? (
            <div className="space-y-2">
              <button className="underline block w-full" onClick={() => setMode('login')}>
                Already have an account? Sign in
              </button>
              <button className="underline block w-full" onClick={() => setMode('resetRequest')}>
                Forgot password?
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button className="underline block w-full" onClick={() => setMode('login')}>
                Back to sign in
              </button>
              <button className="underline block w-full" onClick={() => setMode('register')}>
                Need an account? Sign up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioManager({ auth }) {
  const {
    portfolio,
    updatePortfolio,
    savePortfolio,
    exportPortfolio,
    importPortfolio,
    saveStatus,
    isLoading,
    subscriptionRequired,
    subscriptionInfo
  } = usePortfolioData(!!auth?.user);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [primaryTab, setPrimaryTab] = useState('portfolio'); // 'portfolio' | 'projections' | 'analysis'
  const [activeTab, setActiveTab] = useState('growth');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [projectionRateDrafts, setProjectionRateDrafts] = useState({});
  const [projectionYearsDraft, setProjectionYearsDraft] = useState(portfolio.projectionYears ?? 10);
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [showIndividualAccounts, setShowIndividualAccounts] = useState(true);
  const [showActualInput, setShowActualInput] = useState(null);
  const ONBOARDING_VERSION = 1;
  const [onboardingState, setOnboardingState] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [onboardingError, setOnboardingError] = useState(null);
  const lastTourAutoAdvanceRef = useRef(0);
  const [showProjectionMenu, setShowProjectionMenu] = useState(false);
  const navRef = useRef(null);
  const activeProjection = portfolio.getActiveProjection();
  const activeProjectionId = activeProjection?.id;
  const projectionView = useMemo(
    () => portfolio.buildProjectionView(activeProjectionId),
    [portfolio, activeProjectionId]
  );

  const tourSteps = useMemo(() => ([
    {
      title: 'Views',
      target: '[data-tour="nav-views"]',
      content: 'Use these buttons to switch between:\n• Portfolio: add accounts + FI target\n• Projections: create scenarios and rules\n• Analysis: compare scenarios'
    },
    {
      title: 'Create Your First Account',
      target: '[data-tour="account-form"]',
      content: 'Add an account name, type, balance, and return rate.\nTip: Return rate is nominal; inflation is applied later in projections.'
    },
    {
      title: 'Projection Return Rates & Inflation',
      target: '[data-tour="return-rates"]',
      content: 'Inside each projection, you can adjust:\n• Inflation rate (scenario-specific)\n• Account return rates (scenario-specific)\n\nThis lets you model different market assumptions without changing your base portfolio.'
    },
    {
      title: 'Projections & Transfer Rules',
      target: '[data-tour="transfer-rules"]',
      content: 'Transfer rules move money between accounts over time (or from/to external income/expenses).'
    },
    {
      title: 'Scenario Copying',
      target: '[data-tour="add-projection"]',
      content: 'Creating a new projection copies the active one so you can tweak return rates, inflation, and transfer rules without changing other scenarios.'
    },
    {
      title: 'Charts & Tooltip',
      target: '[data-tour="projection-chart"]',
      content: 'Hover the chart to see the tooltip with calculations.\nUse Filter Accounts to include/exclude accounts, and toggle individual accounts for more detail.'
    },
    {
      title: 'Analysis View',
      target: '[data-tour="analysis-chart"]',
      content: 'Analysis compares multiple projections side-by-side so you can see how different scenarios perform.'
    }
  ]), []);

  const prepareTourStep = async (nextStep) => {
    setOnboardingError(null);
    if (nextStep === 0) {
      setPrimaryTab('portfolio');
      setShowAddAccount(false);
      setShowAddRule(false);
    } else if (nextStep === 1) {
      setPrimaryTab('portfolio');
      setShowAddAccount(true);
      setShowAddRule(false);
    } else if (nextStep === 2 || nextStep === 3 || nextStep === 4 || nextStep === 5) {
      setPrimaryTab('projections');
      setShowAddAccount(false);
      setShowAddRule(false);
    } else if (nextStep === 6) {
      setPrimaryTab('analysis');
      setShowAddAccount(false);
      setShowAddRule(false);
    }
    // give React a tick to render the target
    await new Promise((r) => setTimeout(r, 50));
  };

  const persistOnboarding = async ({ step, completed }) => {
    try {
      const updated = await StorageService.updateOnboarding({
        version: ONBOARDING_VERSION,
        step,
        completed
      });
      setOnboardingState(updated);
    } catch (err) {
      setOnboardingError(err.message || 'Failed to save onboarding progress');
    }
  };

  const startTour = async (startAt = 0) => {
    await prepareTourStep(startAt);
    setTourStep(startAt);
    setTourOpen(true);
    await persistOnboarding({ step: startAt, completed: false });
  };

  const closeTour = async ({ completed } = { completed: false }) => {
    setTourOpen(false);
    if (completed) {
      setPrimaryTab('portfolio');
      setShowAddAccount(true);
      setShowAddRule(false);
      setTimeout(() => {
        const el = document.querySelector('[data-tour="add-account-btn"]') || document.querySelector('[data-tour="account-form"]');
        el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }, 150);
      await persistOnboarding({ step: tourSteps.length, completed: true });
    } else {
      await persistOnboarding({ step: tourStep, completed: false });
    }
  };

  const nextTour = async () => {
    if (tourStep === 1 && (portfolio.accounts || []).length === 0) {
      setOnboardingError('Please create at least one account to continue.');
      return;
    }
    if (tourStep >= tourSteps.length - 1) {
      await closeTour({ completed: true });
      return;
    }
    const next = tourStep + 1;
    await prepareTourStep(next);
    setTourStep(next);
    await persistOnboarding({ step: next, completed: false });
  };

  // Auto-advance step 2 (create account) once an account exists
  useEffect(() => {
    if (!tourOpen) return;
    if (tourStep !== 1) return;
    if ((portfolio.accounts || []).length === 0) return;
    const now = Date.now();
    if (now - lastTourAutoAdvanceRef.current < 1500) return;
    lastTourAutoAdvanceRef.current = now;
    const t = setTimeout(() => {
      nextTour();
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, tourStep, portfolio.accounts.length]);

  const backTour = async () => {
    const prev = Math.max(0, tourStep - 1);
    await prepareTourStep(prev);
    setTourStep(prev);
    await persistOnboarding({ step: prev, completed: false });
  };

  // Load onboarding state for this user (per-user, stored in DB)
  useEffect(() => {
    if (!auth?.user) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await StorageService.getOnboarding();
        if (cancelled) return;
        setOnboardingState(state);
      } catch (err) {
        if (cancelled) return;
        setOnboardingError(err.message || 'Failed to load onboarding state');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth?.user?.id]);

  const tourCanNext = useMemo(() => {
    if (!tourOpen) return true;
    if (tourStep === 1) {
      return (portfolio.accounts || []).length > 0;
    }
    return true;
  }, [tourOpen, tourStep, portfolio.accounts]);

  const tourNextDisabledReason = useMemo(() => {
    if (!tourOpen) return '';
    if (tourStep === 1 && (portfolio.accounts || []).length === 0) {
      return 'Create an account to continue.';
    }
    return '';
  }, [tourOpen, tourStep, portfolio.accounts]);

  useEffect(() => {
    setProjectionYearsDraft(Number.isFinite(portfolio.projectionYears) ? portfolio.projectionYears : 10);
  }, [portfolio.projectionYears]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target)) {
        setShowProjectionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-start tour for users who haven't completed it
  useEffect(() => {
    if (!auth?.user) return;
    if (!onboardingState) return;
    const completed = !!onboardingState.completedAt;
    if (completed) return;
    if (tourOpen) return;
    const startAtRaw = Number.isFinite(Number(onboardingState.step)) ? Number(onboardingState.step) : 0;
    const startAt = Math.min(Math.max(startAtRaw, 0), Math.max(tourSteps.length - 1, 0));
    // Only auto-run when user is in the app (portfolio loaded)
    if (isLoading) return;
    startTour(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id, onboardingState?.completedAt, onboardingState?.step, isLoading]);

  // Initialize selected accounts on portfolio load
  useEffect(() => {
    const currentIds = portfolio.accounts.map(acc => String(acc.id));
    const selectedKeys = Object.keys(selectedAccounts || {});
    const needsInit =
      selectedKeys.length !== currentIds.length ||
      currentIds.some(id => selectedAccounts[id] === undefined && selectedAccounts[Number(id)] === undefined);

    if (needsInit) {
      const selected = {};
      portfolio.accounts.forEach(acc => {
        const prev = selectedAccounts[String(acc.id)] ?? selectedAccounts[acc.id];
        selected[acc.id] = prev !== undefined ? prev : true;
      });
      setSelectedAccounts(selected);
    }
  }, [portfolio.accounts, selectedAccounts]);

  useEffect(() => {
    // If projections change, keep an active projection selected
    const exists = (portfolio.projections || []).some(
      p => String(p.id) === String(activeProjectionId)
    );
    if (!exists && portfolio.projections[0]) {
      updatePortfolio(new Portfolio({ ...portfolio.toJSON(), activeProjectionId: portfolio.projections[0].id }));
    }
  }, [portfolio.projections, activeProjectionId, portfolio, updatePortfolio]);

  useEffect(() => {
    if (primaryTab !== 'projections') return;
    const drafts = {};
    projectionView.accounts.forEach(acc => {
      drafts[acc.id] = acc.returnRate;
    });
    setProjectionRateDrafts(drafts);
  }, [primaryTab, projectionView.accounts]);

  // Calculate projections
  const projectionData = useProjections(
    projectionView,
    selectedAccounts,
    showIndividualAccounts
  );

  const projectionSeries = useMemo(() => {
    return (portfolio.projections || []).map((proj) => {
      const view = portfolio.buildProjectionView(proj.id);
      const data = ProjectionController.calculateProjections(
        view,
        selectedAccounts,
        false
      );
      return {
        id: proj.id,
        name: proj.name,
        createdAt: proj.createdAt,
        data
      };
    });
  }, [portfolio, selectedAccounts]);
  const fiTarget = portfolio.getFiTarget();

  const projectionCards = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return projectionSeries.map((series) => {
      const finalPoint = series.data[series.data.length - 1] || {};
      const actualNow = series.data.find(d => d.year === currentYear)?.actual || null;
      const fiHit = fiTarget > 0
        ? series.data.find((d) => d.projected != null && d.projected >= fiTarget)
        : null;
      return {
        id: series.id,
        name: series.name,
        createdAt: series.createdAt,
        finalProjected: finalPoint.projected,
        currentActual: actualNow,
        fiYear: fiHit?.year || null
      };
    });
  }, [projectionSeries, fiTarget]);

  const projectionComparisonData = useMemo(() => {
    const years = new Set();
    projectionSeries.forEach(series => {
      series.data.forEach(point => years.add(point.year));
    });
    return Array.from(years)
      .sort((a, b) => a - b)
      .map(year => {
        const row = { year, label: year.toString(), actual: null };
        projectionSeries.forEach(series => {
          const found = series.data.find(p => p.year === year);
          if (!found) return;
          row[`projection_${series.id}`] = found.projected;
          if (found.actual != null && found.actual !== undefined) {
            row.actual = found.actual;
          }
        });
        return row;
      });
  }, [projectionSeries]);

  if (subscriptionRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center text-purple-100 space-y-4">
          <h1 className="text-3xl font-bold text-white">Start your 30-day free trial</h1>
          <p className="text-purple-200">
            Your email is verified, but a subscription is required after the trial. Choose monthly or annual to begin.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={() => handleStartCheckout('monthly')}
              disabled={isStartingCheckout}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition"
            >
              {isStartingCheckout ? 'Working...' : 'Start Monthly Trial'}
            </button>
            <button
              onClick={() => handleStartCheckout('annual')}
              disabled={isStartingCheckout}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition"
            >
              {isStartingCheckout ? 'Working...' : 'Start Annual Trial'}
            </button>
          </div>
          <button
            onClick={handleManageBilling}
            disabled={isStartingCheckout}
            className="text-sm underline text-purple-100"
          >
            Manage billing
          </button>
        </div>
      </div>
    );
  }

  // Helper functions
  const getAccountById = (id) => {
    if (!id) return null;
    return portfolio.accounts.find(acc => acc.id == id || String(acc.id) === String(id));
  };

  const handleSelectProjection = (projectionId) => {
    setPrimaryTab('projections');
    setActiveProjectionIdLocal(projectionId);
  };

  const toggleAccountSelection = (accountId) => {
    setSelectedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };
  const selectAllAccounts = () => {
    const selected = {};
    portfolio.accounts.forEach(acc => {
      selected[acc.id] = true;
    });
    setSelectedAccounts(selected);
  };
  const selectNoAccounts = () => {
    const selected = {};
    portfolio.accounts.forEach(acc => {
      selected[acc.id] = false;
    });
    setSelectedAccounts(selected);
  };
  const handleStartCheckout = async (plan) => {
    setIsStartingCheckout(true);
    try {
      const res = await StorageService.startCheckout(plan);
      if (res.free) {
        window.location.reload();
        return;
      }
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      alert(err.message || 'Failed to start checkout');
    } finally {
      setIsStartingCheckout(false);
    }
  };
  const handleManageBilling = async () => {
    setIsStartingCheckout(true);
    try {
      const res = await StorageService.openPortal();
      if (res.free) {
        alert('Your account is whitelisted; no billing needed.');
        return;
      }
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      alert(err.message || 'Failed to open billing portal');
    } finally {
      setIsStartingCheckout(false);
    }
  };
  const targetProjectionId = activeProjectionId || portfolio.projections[0]?.id;
  const isPortfolioSection = primaryTab === 'portfolio';
  const isAnalysisSection = primaryTab === 'analysis';
  const isProjectionSection = primaryTab === 'projections';
  const allowProjectionEditing = isProjectionSection;

  // Account handlers
  const handleAddAccount = async (accountData) => {
    try {
      const newAccounts = AccountController.createAccount(accountData, portfolio.accounts);
      const newAccount = newAccounts[newAccounts.length - 1];
      const updatedProjections = (portfolio.projections || []).map(proj => {
        const overrides = { ...(proj.accountOverrides || {}) };
        overrides[newAccount.id] = {
          returnRate: newAccount.returnRate
        };
        return new Projection({ ...proj.toJSON(), accountOverrides: overrides });
      });
      const updatedPortfolio = new Portfolio({
        ...portfolio.toJSON(),
        accounts: newAccounts,
        projections: updatedProjections.map(p => p.toJSON()),
        activeProjectionId
      });
      updatePortfolio(updatedPortfolio);
      await savePortfolio(updatedPortfolio);
      setShowAddAccount(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveAccountEdit = async (accountId, field, value) => {
    const isProjectionField = field === 'returnRate';
    const updatedAccounts = isProjectionField
      ? portfolio.accounts
      : AccountController.updateAccount(
          accountId,
          field,
          value,
          portfolio.accounts
        );
    let updatedProjections = portfolio.projections;
    if (isProjectionField && targetProjectionId) {
      updatedProjections = portfolio.projections.map(proj => {
        if (String(proj.id) !== String(targetProjectionId)) return proj;
        const overrides = { ...(proj.accountOverrides || {}) };
        const current = overrides[accountId] || {};
        overrides[accountId] = { ...current, returnRate: value };
        return new Projection({ ...proj.toJSON(), accountOverrides: overrides });
      });
    }
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      accounts: updatedAccounts,
      projections: updatedProjections.map(p => p.toJSON()),
      activeProjectionId
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio, { skipReload: true });
  };

  const handleDeleteAccount = async (accountId) => {
    const accounts = portfolio.accounts.filter(acc => String(acc.id) !== String(accountId));
    const cleanedActuals = { ...portfolio.actualValues };
    delete cleanedActuals[accountId];
    const updatedProjections = portfolio.projections.map(proj => {
      const overrides = { ...(proj.accountOverrides || {}) };
      delete overrides[accountId];
      const filteredRules = (proj.transferRules || []).filter(rule =>
        rule.fromAccountId !== accountId && rule.toAccountId !== accountId
      );
      return new Projection({ ...proj.toJSON(), accountOverrides: overrides, transferRules: filteredRules });
    });
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      accounts,
      actualValues: cleanedActuals,
      projections: updatedProjections.map(p => p.toJSON()),
      activeProjectionId
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const handleAddActualValue = async (accountId, year, value) => {
    const updatedActualValues = {
      ...portfolio.actualValues,
      [accountId]: {
        ...(portfolio.actualValues[accountId] || {}),
        [year]: value
      }
    };
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      actualValues: updatedActualValues
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const handleDeleteActualValue = async (accountId, year) => {
    const accountActuals = { ...(portfolio.actualValues[accountId] || {}) };
    delete accountActuals[year];
    const updatedActualValues = { ...portfolio.actualValues };
    if (Object.keys(accountActuals).length === 0) {
      delete updatedActualValues[accountId];
    } else {
      updatedActualValues[accountId] = accountActuals;
    }
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      actualValues: updatedActualValues
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const handleAddProjection = async () => {
    const template = activeProjection || portfolio.projections[0] || new Projection({
      transferRules: [],
      accountOverrides: {}
    });
    // Duplicate the active projection (overrides + transfer rules)
    const templateJson = template.toJSON();
    // ensure transferRules are plain objects to avoid shared references
    const clonedRules = (templateJson.transferRules || []).map(rule => ({ ...rule }));
    const clonedOverrides = Object.fromEntries(
      Object.entries(templateJson.accountOverrides || {}).map(([accId, override]) => [
        accId,
        { ...override }
      ])
    );
    const tempId = Math.floor(Date.now() % 2147480000); // safe int32 range for client selection
    const newProjection = new Projection({
      ...templateJson,
      transferRules: clonedRules,
      accountOverrides: clonedOverrides,
      id: tempId,
      name: `${template.name || 'Projection'} Copy`,
      createdAt: new Date().toISOString()
    });
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      projections: [...portfolio.projections.map(p => p.toJSON()), newProjection.toJSON()],
      activeProjectionId: newProjection.id
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
    setPrimaryTab('projections');
  };

  const handleRenameProjection = async (projectionId) => {
    const targetId = projectionId || portfolio.projections[0]?.id;
    if (!targetId) return;
    const existing = portfolio.projections.find(p => String(p.id) === String(targetId));
    const nextName = window.prompt('Rename projection', existing?.name || 'Projection');
    if (!nextName) return;
    const updatedProjections = portfolio.projections.map(proj =>
      String(proj.id) === String(targetId)
        ? new Projection({ ...proj.toJSON(), name: nextName })
        : proj
    );
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      projections: updatedProjections.map(p => p.toJSON()),
      activeProjectionId
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const handleDeleteProjection = async (projectionId) => {
    if ((portfolio.projections || []).length <= 1) {
      alert('You must keep at least one projection.');
      return;
    }
    if (!window.confirm('Delete this projection? This cannot be undone.')) return;

    const filtered = portfolio.projections.filter(p => String(p.id) !== String(projectionId));
    const nextActive = filtered[0]?.id || null;
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      projections: filtered.map(p => p.toJSON()),
      activeProjectionId: nextActive
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const setActiveProjectionIdLocal = (projectionId) => {
    const updated = new Portfolio({
      ...portfolio.toJSON(),
      activeProjectionId: projectionId
    });
    updatePortfolio(updated);
  };

  const handleUpdateProjectionSettings = async (updates) => {
    // Legacy no-op: projection-specific settings removed
  };
  const handleUpdatePortfolioSettings = async (updates, { skipReload = false } = {}) => {
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      ...updates
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio, { skipReload });
  };
  const commitProjectionYears = async (value) => {
    const parsed = Math.max(1, parseInt(value, 10) || 1);
    setProjectionYearsDraft(parsed);
    await handleUpdatePortfolioSettings({ projectionYears: parsed }, { skipReload: true });
  };
  const handleInlineProjectionYears = async (value) => {
    const parsed = Number(value);
    const safeVal = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    await handleUpdatePortfolioSettings({ projectionYears: safeVal }, { skipReload: true });
  };

  // Transfer rule handlers
  const handleSaveInflationRate = async (value) => {
    const rateNum = Number.isFinite(value) ? value : parseFloat(value) || 0;
    const updatedProjections = portfolio.projections.map(proj =>
      String(proj.id) === String(targetProjectionId)
        ? new Projection({ ...proj.toJSON(), inflationRate: rateNum })
        : proj
    );
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      projections: updatedProjections.map(p => p.toJSON()),
      activeProjectionId
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const handleAddRule = async (ruleData) => {
    try {
      const { applyToAll, ...payload } = ruleData || {};
      let updatedProjections;
      if (applyToAll) {
        updatedProjections = portfolio.projections.map(proj => {
          const newRulesAll = RuleController.createRule(payload, proj.transferRules || []);
          return new Projection({ ...proj.toJSON(), transferRules: newRulesAll });
        });
      } else {
        const newRules = RuleController.createRule(payload, activeProjection?.transferRules || []);
        updatedProjections = portfolio.projections.map(proj =>
          String(proj.id) === String(targetProjectionId)
            ? new Projection({ ...proj.toJSON(), transferRules: newRules })
            : proj
        );
      }
      const updatedPortfolio = new Portfolio({
        ...portfolio.toJSON(),
        projections: updatedProjections.map(p => p.toJSON()),
        activeProjectionId
      });
      updatePortfolio(updatedPortfolio);
      await savePortfolio(updatedPortfolio);
      setShowAddRule(false);
      setEditingRuleId(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveRuleEdit = async (ruleData) => {
    try {
      const newRules = RuleController.updateRule(
        editingRuleId,
        ruleData,
        activeProjection?.transferRules || []
      );
      const updatedProjections = portfolio.projections.map(proj =>
        String(proj.id) === String(targetProjectionId)
          ? new Projection({ ...proj.toJSON(), transferRules: newRules })
          : proj
      );
      const updatedPortfolio = new Portfolio({
        ...portfolio.toJSON(),
        projections: updatedProjections.map(p => p.toJSON()),
        activeProjectionId
      });
      updatePortfolio(updatedPortfolio);
      await savePortfolio(updatedPortfolio);
      setEditingRuleId(null);
      setShowAddRule(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    const updatedRules = (activeProjection?.transferRules || []).filter(rule => rule.id !== ruleId);
    const updatedProjections = portfolio.projections.map(proj =>
      String(proj.id) === String(targetProjectionId)
        ? new Projection({ ...proj.toJSON(), transferRules: updatedRules })
        : proj
    );
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      projections: updatedProjections.map(p => p.toJSON()),
      activeProjectionId
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const renderPlanModal = () => {
    if (!showPlanModal) return null;
    const priceMonthly = import.meta.env.VITE_PRICE_MONTHLY || 'Monthly plan';
    const priceAnnual = import.meta.env.VITE_PRICE_ANNUAL || 'Annual plan';
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowPlanModal(false)} />
        <div className="relative w-full max-w-md bg-slate-900 border border-white/20 rounded-xl p-6 text-purple-100 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Choose a plan</h3>
            <button
              onClick={() => setShowPlanModal(false)}
              className="text-sm px-3 py-1 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-purple-200">Trial ends: {subscriptionInfo?.trialEndsAt ? new Date(subscriptionInfo.trialEndsAt).toLocaleDateString() : 'soon'}</p>
          <div className="space-y-2">
            <button
              onClick={() => handleStartCheckout('annual')}
              disabled={isStartingCheckout}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition"
            >
              {isStartingCheckout ? 'Working...' : `Subscribe Annually (${priceAnnual})`}
            </button>
            <button
              onClick={() => handleStartCheckout('monthly')}
              disabled={isStartingCheckout}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition"
            >
              {isStartingCheckout ? 'Working...' : `Subscribe Monthly (${priceMonthly})`}
            </button>
          </div>
          <p className="text-xs text-purple-200">
            After the trial ends, you&apos;ll need an active subscription to keep your data. Accounts without an active subscription may be deleted.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {renderPlanModal()}
        <OnboardingTour
          isOpen={tourOpen}
          steps={tourSteps}
          stepIndex={tourStep}
          canNext={tourCanNext}
          nextDisabledReason={tourNextDisabledReason}
          onBack={backTour}
          onNext={nextTour}
          onSkip={() => closeTour({ completed: true })}
        />
        {onboardingError && (
          <div className="mb-3 text-sm text-yellow-200">
            {onboardingError}
          </div>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 text-purple-100">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportPortfolio}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm"
            >
              <Upload className="w-4 h-4" />
              Export
            </button>
            <label className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all cursor-pointer text-sm">
              <Download className="w-4 h-4" />
              Import
              <input type="file" accept=".json" onChange={importPortfolio} className="hidden" />
            </label>
            {saveStatus && (
              <span className="text-green-300 text-xs md:text-sm">{saveStatus}</span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {auth?.user?.email && (
              <div className="flex items-center gap-2">
                <span className="text-sm bg-white/10 px-3 py-1 rounded-full border border-white/20">
                  Signed in as {auth.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => startTour(0)}
                  className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                  title="Restart the introduction tour"
                >
                  Tour
                </button>
                {subscriptionInfo?.isWhitelisted ? (
                  <button className="text-xs px-3 py-1 rounded-full bg-emerald-700 text-white border border-emerald-400/60">
                    Whitelisted
                  </button>
                ) : subscriptionInfo?.subscriptionStatus === 'trialing' ? (
                  <button
                    onClick={() => setShowPlanModal(true)}
                    className="text-xs px-3 py-1 rounded-full bg-yellow-700 text-white border border-yellow-400/60"
                  >
                    Trial ends: {subscriptionInfo.trialEndsAt ? new Date(subscriptionInfo.trialEndsAt).toLocaleDateString() : 'soon'}
                  </button>
                ) : subscriptionInfo?.subscriptionStatus === 'canceled' ? (
                  <button
                    onClick={handleManageBilling}
                    className="text-xs px-3 py-1 rounded-full bg-slate-700 text-white border border-white/30"
                  >
                    {subscriptionInfo.subscriptionPeriodEnd || subscriptionInfo.trialEndsAt
                      ? `Valid until: ${new Date(subscriptionInfo.subscriptionPeriodEnd || subscriptionInfo.trialEndsAt).toLocaleDateString()}`
                      : 'Valid until: pending'}
                  </button>
                ) : subscriptionInfo?.subscriptionStatus === 'active' ? (
                  <button
                    onClick={handleManageBilling}
                    className="text-xs px-3 py-1 rounded-full bg-purple-700 text-white border border-purple-400/60"
                  >
                    {subscriptionInfo.subscriptionPeriodEnd || subscriptionInfo.trialEndsAt
                      ? `Renews: ${new Date(subscriptionInfo.subscriptionPeriodEnd || subscriptionInfo.trialEndsAt).toLocaleDateString()}`
                      : 'Renews: pending'}
                  </button>
                ) : null}
              </div>
            )}
            <button
              onClick={auth?.logout}
              className="text-sm px-3 py-1 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
            >
              Logout
            </button>
            <button
              onClick={() => {
                if (window.confirm('This will delete your account and all associated data. Continue?')) {
                  auth?.deleteAccount();
                }
              }}
              className="text-sm px-3 py-1 bg-red-900/60 hover:bg-red-800/70 border border-red-400/30 rounded-lg text-white transition"
            >
              Delete account
            </button>
          </div>
        </div>
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <TrendingUp className="w-10 h-10" />
            Portfolio Planner
          </h1>
          <p className="text-purple-200">Track and project your investments & savings</p>
        </div>

        <div className="sticky top-0 z-30 mb-6 flex">
          <div
            data-tour="nav-views"
            ref={navRef}
            className="bg-slate-900/80 backdrop-blur-lg border border-white/20 rounded-xl px-3 py-3 shadow-lg flex items-center gap-2 relative"
            onMouseLeave={() => setShowProjectionMenu(false)}
          >
            <span className="text-xs uppercase tracking-wide text-purple-200 px-2">Views</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPrimaryTab('portfolio')}
                className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                  isPortfolioSection
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                    : 'bg-white/5 text-purple-200 border-white/10 hover:bg-white/10'
                }`}
              >
                Portfolio
              </button>
              <button
                onClick={() => {
                  setPrimaryTab('projections');
                  setShowProjectionMenu(true);
                }}
                onMouseEnter={() => {
                  setShowProjectionMenu(true);
                }}
                className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                  primaryTab === 'projections'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                    : 'bg-white/5 text-purple-200 border-white/10 hover:bg-white/10'
                }`}
              >
                Projections
              </button>
              <button
                onClick={() => setPrimaryTab('analysis')}
                className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                  primaryTab === 'analysis'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                    : 'bg-white/5 text-purple-200 border-white/10 hover:bg-white/10'
                }`}
              >
                Analysis
              </button>
            </div>
            {showProjectionMenu && portfolio.projections.length > 0 && (
              <div className="absolute top-full left-24 mt-0 bg-slate-900/95 border border-white/20 rounded-lg shadow-xl z-10 min-w-[220px]">
                <div className="px-3 py-2 text-xs uppercase text-purple-200 border-b border-white/10">Select Projection</div>
                {portfolio.projections.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProjection(proj.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${
                      String(proj.id) === String(activeProjectionId) ? 'bg-purple-600/40 text-white' : 'text-purple-100'
                    }`}
                  >
                    {proj.name || `Projection ${proj.id}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isProjectionSection && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">Projection Scenarios</h4>
                  <p className="text-purple-200 text-sm">Select a projection to edit settings, expected returns, and rules.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <label className="text-sm text-purple-100">Projection Years</label>
                    <input
                      type="number"
                      min="1"
                      value={projectionYearsDraft}
                      onChange={(e) => setProjectionYearsDraft(e.target.value)}
                      onBlur={() => commitProjectionYears(projectionYearsDraft)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitProjectionYears(projectionYearsDraft);
                        }
                      }}
                      className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                    />
                  </div>
                  <button
                    onClick={handleAddProjection}
                    data-tour="add-projection"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Projection
                  </button>
                  <button
                    onClick={() => handleRenameProjection(targetProjectionId)}
                    disabled={(portfolio.projections || []).length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-all text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteProjection(targetProjectionId)}
                    disabled={!targetProjectionId || (portfolio.projections || []).length <= 1}
                    className="flex items-center gap-2 px-4 py-2 bg-red-900/60 hover:bg-red-800/70 disabled:opacity-50 text-white rounded-lg transition-all text-sm border border-red-400/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {projectionCards.map((proj) => {
                  const isActive = String(proj.id) === String(activeProjectionId);
                  return (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectProjection(proj.id)}
                      className={`flex-1 min-w-[240px] text-left bg-white/5 border rounded-lg p-4 transition-all ${
                        isActive
                          ? 'border-purple-300 ring-2 ring-purple-400/60 shadow-xl shadow-purple-500/30 bg-purple-500/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold">{proj.name}</span>
                        {isActive && <span className="text-xs px-2 py-1 rounded-full bg-purple-600 text-white">Active</span>}
                      </div>
                      <div className="text-xs text-purple-200 mb-2">
                        Created {proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : '—'}
                      </div>
                      <div className="text-sm text-green-100">
                        Projected: {CurrencyService.formatCurrency(proj.finalProjected || 0, portfolio.baseCurrency)}
                      </div>
                      {fiTarget > 0 && (
                        <div className="text-xs text-purple-200">
                          FI Year: {proj.fiYear ? proj.fiYear : `FI not reached in ${portfolio.projectionYears || 10} years`}
                        </div>
                      )}
                      {proj.currentActual !== null && (
                        <div className="text-xs text-blue-100">
                          Actual: {CurrencyService.formatCurrency(proj.currentActual, portfolio.baseCurrency)}
                        </div>
                      )}
                    </button>
                  );
                })}
                {projectionCards.length === 0 && (
                  <div className="text-purple-200 text-sm">No projections yet. Add one to get started.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {isPortfolioSection && (
          <>
            {/* Top strip: total balance + portfolio settings */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 mb-8 border border-white/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <SummaryCard
                title="Total Balance"
                value={portfolio.accounts.reduce((sum, acc) => 
                  sum + CurrencyService.convertToBase(acc.balance, acc.currency, portfolio.baseCurrency), 0
                )}
                currency={portfolio.baseCurrency}
                icon={DollarSign}
              />
              <div className="flex-1">
                <PortfolioSettings
                  projectionYears={portfolio.projectionYears}
                  taxRate={portfolio.taxRate}
                  baseCurrency={portfolio.baseCurrency}
                  fiMode={portfolio.fiMode}
                  fiMultiplier={portfolio.fiMultiplier}
                  fiAnnualExpenses={portfolio.fiAnnualExpenses}
                  fiMonthlyExpenses={portfolio.fiMonthlyExpenses}
                  fiValue={portfolio.fiValue}
                  onUpdate={handleUpdatePortfolioSettings}
                  showProjectionYears={false}
                />
              </div>
            </div>

            {/* Accounts List */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Accounts & Actual Data</h3>
                  <p className="text-purple-200 text-sm">
                    These accounts and data points are shared across every projection. Edit return rates inside each projection tab.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAccount(!showAddAccount)}
                  data-tour="add-account-btn"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Account
                </button>
              </div>

              {showAddAccount && (
                <div data-tour="account-form" className="bg-white/5 rounded-lg p-4 mb-4 border border-white/20">
                  <AccountForm
                    onSubmit={handleAddAccount}
                    onCancel={() => setShowAddAccount(false)}
                    baseCurrency={portfolio.baseCurrency}
                  />
                </div>
              )}

              <div className="space-y-3">
                {portfolio.accounts.map(account => (
                    <AccountItem
                      key={account.id}
                      account={account}
                      isEditing={editingAccountId === account.id}
                      onStartEdit={() => setEditingAccountId(account.id)}
                      onDelete={() => handleDeleteAccount(account.id)}
                      onFinishEdit={() => setEditingAccountId(null)}
                      onSaveEdit={handleSaveAccountEdit}
                      onSaveProjectionValue={handleSaveAccountEdit}
                      onAddActualValue={handleAddActualValue}
                      onDeleteActualValue={handleDeleteActualValue}
                      actualValues={portfolio.actualValues[account.id] || {}}
                      showActualValueInput={showActualInput === account.id}
                      onToggleActualValueInput={() => setShowActualInput(showActualInput === account.id ? null : account.id)}
                      enableProjectionFields={allowProjectionEditing}
                      showReturnRate={allowProjectionEditing}
                    />
                ))}
              </div>

              {portfolio.accounts.length === 0 && (
                <div className="text-center py-12 text-purple-200">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No accounts yet. Add your first account to get started!</p>
                </div>
              )}
            </div>
          </>
        )}

        {isAnalysisSection && (
          <div className="space-y-3">
            <ProjectionComparisonSection
              data={projectionComparisonData}
              projections={projectionSeries.map(({ id, name }) => ({ id, name }))}
              accounts={portfolio.accounts}
              baseCurrency={portfolio.baseCurrency}
              selectedAccounts={selectedAccounts}
              onToggleAccount={toggleAccountSelection}
              projectionYears={portfolio.projectionYears}
              onUpdateProjectionYears={handleInlineProjectionYears}
              onSelectAllAccounts={selectAllAccounts}
              onSelectNoAccounts={selectNoAccounts}
              fiTarget={fiTarget}
            />
          </div>
        )}

        {isProjectionSection && (
          <>
            {activeProjection && (
              <div className="grid lg:grid-cols-5 gap-4 mb-8">
                <div data-tour="return-rates" className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 lg:col-span-2">
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-purple-100">Inflation %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={activeProjection?.inflationRate ?? 0}
                        onChange={(e) => handleSaveInflationRate(parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">Return Rates</h3>
                      <p className="text-purple-200 text-sm">
                        Adjust account nominal return rates for this projection only. Inflation is subtracted from these rates. 
                        <br />
                        Real return rate = ((1 + nominal rate) / (1 + inflation)) - 1.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {projectionView.accounts.map((account) => {
                      const rate = projectionRateDrafts[account.id] ?? '';
                      const label = account.type === 'cash' ? 'Interest %' : 'Return Rate %';
                      const field = 'returnRate';
                      const persistRate = () => {
                        const num = parseFloat(rate);
                        const finalVal = Number.isFinite(num) ? num : 0;
                        handleSaveAccountEdit(account.id, field, finalVal);
                      };
                      return (
                        <div key={account.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-semibold">{account.name}</div>
                              <div className="text-xs text-purple-200">{label}</div>
                            </div>
                            <input
                              type="number"
                              step="0.1"
                              value={rate}
                              onChange={(e) =>
                                setProjectionRateDrafts(prev => ({
                                  ...prev,
                                  [account.id]: e.target.value
                                }))
                              }
                              onBlur={persistRate}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  persistRate();
                                }
                              }}
                              className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div data-tour="transfer-rules" className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 lg:col-span-3">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">Transfer Rules</h3>
                      <p className="text-purple-200 text-sm">
                        Scenario-specific rules for {activeProjection?.name || 'this projection'}.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddRule(!showAddRule)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add Rule
                    </button>
                  </div>

                  {(showAddRule || editingRuleId) && (
                    <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/20">
                      <TransferRuleForm
                        rule={editingRuleId ? (activeProjection?.transferRules || []).find(r => r.id === editingRuleId) : null}
                        onSubmit={editingRuleId ? handleSaveRuleEdit : handleAddRule}
                        onCancel={() => {
                          setShowAddRule(false);
                          setEditingRuleId(null);
                        }}
                        accounts={portfolio.accounts}
                        baseCurrency={portfolio.baseCurrency}
                        isEdit={!!editingRuleId}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                  {(activeProjection?.transferRules || []).map(rule => {
                    const fromAccount = rule.fromAccountId ? getAccountById(rule.fromAccountId) : null;
                    
                    return (
                      <div key={rule.id}>
                        <TransferRuleItem
                          rule={rule}
                          fromAccount={fromAccount}
                          onEdit={() => {
                            setEditingRuleId(rule.id);
                            setShowAddRule(true);
                            }}
                            onDelete={() => handleDeleteRule(rule.id)}
                            accounts={portfolio.accounts}
                            baseCurrency={portfolio.baseCurrency}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {(activeProjection?.transferRules || []).length === 0 && (
                    <div className="text-center py-8 text-purple-200">
                      <p>No transfer rules yet. Add rules to automatically move funds between accounts.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeProjection && (
              <ChartSection
                projectionName={activeProjection?.name}
                accountFilterHint="Account filters and data points are shared across all projections."
                projectionData={projectionData}
                accounts={projectionView.accounts}
                selectedAccounts={selectedAccounts}
                showIndividualAccounts={showIndividualAccounts}
                activeTab={activeTab}
                baseCurrency={portfolio.baseCurrency}
                inflationRate={projectionView.inflationRate}
              projectionYears={portfolio.projectionYears}
              onUpdateProjectionYears={handleInlineProjectionYears}
              onTabChange={setActiveTab}
              onToggleAccount={toggleAccountSelection}
              onSelectAllAccounts={selectAllAccounts}
              onSelectNoAccounts={selectNoAccounts}
              onToggleIndividualAccounts={setShowIndividualAccounts}
              taxRate={projectionView.taxRate}
              fiTarget={fiTarget}
            />
            )}
          </>
        )}

        {/* Terms of Service - collapsible modal trigger */}
        <div className="mt-10 flex justify-end gap-2">
          <button
            onClick={() => setShowPrivacy(true)}
            className="px-4 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-purple-100 hover:bg-white/15 transition"
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setShowTerms(true)}
            className="px-4 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-purple-100 hover:bg-white/15 transition"
          >
            Terms of Service
          </button>
        </div>
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowTerms(false)}
          />
          <div className="relative max-w-3xl w-full max-h-[80vh] overflow-y-auto bg-slate-900 border border-white/20 rounded-xl p-6 text-purple-100 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">Terms of Service</h3>
                <p className="text-sm text-purple-200">
                  Contact: <a href="mailto:contact@portfolioplanner.cc" className="underline">contact@portfolioplanner.cc</a>
                </p>
                <p className="text-xs text-purple-300">Effective date: {TERMS_EFFECTIVE_DATE}</p>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                className="text-sm px-3 py-1 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-sm leading-relaxed">
              {TERMS_SECTIONS.map((item, idx) => (
                <p key={idx}>
                  <strong>{item.title}:</strong> {item.body}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowPrivacy(false)}
          />
          <div className="relative max-w-3xl w-full max-h-[80vh] overflow-y-auto bg-slate-900 border border-white/20 rounded-xl p-6 text-purple-100 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">Privacy Policy</h3>
                <p className="text-sm text-purple-200">
                  Contact: <a href="mailto:contact@portfolioplanner.cc" className="underline">contact@portfolioplanner.cc</a>
                </p>
                <p className="text-xs text-purple-300">Effective date: {PRIVACY_EFFECTIVE_DATE}</p>
              </div>
              <button
                onClick={() => setShowPrivacy(false)}
                className="text-sm px-3 py-1 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-sm leading-relaxed">
              {PRIVACY_SECTIONS.map((item, idx) => (
                <p key={idx}>
                  <strong>{item.title}:</strong> {item.body}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthScreen auth={auth} />;
  }

  return <PortfolioManager auth={auth} />;
}

// Mount the app (entry behavior)
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
