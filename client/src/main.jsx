import React, { useState, useEffect, useMemo } from 'react';
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

// Constants
import { CURRENCY_SYMBOLS } from './constants/currencies';

function AuthScreen({ auth }) {
  const [mode, setMode] = useState('login'); // login | register | resetRequest | resetConfirm
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [localError, setLocalError] = useState('');

  // If a token is present in the URL (e.g., /reset?token=...), jump straight to confirm mode.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode('resetConfirm');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setResetMessage('');
    try {
      if (mode === 'login') {
        await auth.login(email, password);
      } else if (mode === 'register') {
        await auth.register(email, password);
      } else if (mode === 'resetRequest') {
        await auth.requestPasswordReset(email);
        setResetMessage('If that email exists, a reset link has been sent.');
        setMode('login');
      }
    } catch (err) {
      setLocalError(err.message || 'Authentication failed');
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
    isLoading
  } = usePortfolioData(!!auth?.user);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [primaryTab, setPrimaryTab] = useState('portfolio'); // 'portfolio' | 'projections' | 'analysis'
  const [activeTab, setActiveTab] = useState('growth');
  const [projectionRateDrafts, setProjectionRateDrafts] = useState({});
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [showIndividualAccounts, setShowIndividualAccounts] = useState(true);
  const [showActualInput, setShowActualInput] = useState(null);
  const activeProjection = portfolio.getActiveProjection();
  const activeProjectionId = activeProjection?.id;
  const projectionView = useMemo(
    () => portfolio.buildProjectionView(activeProjectionId),
    [portfolio, activeProjectionId]
  );

  // Initialize selected accounts on portfolio load
  useEffect(() => {
    const selected = {};
    portfolio.accounts.forEach(acc => {
      selected[acc.id] = true;
    });
    setSelectedAccounts(selected);
    const drafts = {};
    portfolio.accounts.forEach(acc => {
      drafts[acc.id] = acc.returnRate;
    });
    setProjectionRateDrafts(drafts);
  }, [portfolio.accounts]);

  useEffect(() => {
    // If projections change, keep an active projection selected when in projections tab
    if (primaryTab !== 'projections') return;
    const exists = (portfolio.projections || []).some(
      p => String(p.id) === String(activeProjectionId)
    );
    if (!exists && portfolio.projections[0]) {
      updatePortfolio(new Portfolio({ ...portfolio.toJSON(), activeProjectionId: portfolio.projections[0].id }));
    }
  }, [primaryTab, portfolio.projections, activeProjectionId, portfolio, updatePortfolio]);

  useEffect(() => {
    const drafts = {};
    projectionView.accounts.forEach(acc => {
      drafts[acc.id] = acc.returnRate;
    });
    setProjectionRateDrafts(drafts);
  }, [projectionView.accounts]);

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

  const projectionCards = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return projectionSeries.map((series) => {
      const finalPoint = series.data[series.data.length - 1] || {};
      const actualNow = series.data.find(d => d.year === currentYear)?.actual || null;
      return {
        id: series.id,
        name: series.name,
        createdAt: series.createdAt,
        finalProjected: finalPoint.projected,
        currentActual: actualNow
      };
    });
  }, [projectionSeries]);

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
    await savePortfolio(updatedPortfolio);
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
    const existing = portfolio.projections.find(p => String(p.id) === String(projectionId));
    const nextName = window.prompt('Rename projection', existing?.name || 'Projection');
    if (!nextName) return;
    const updatedProjections = portfolio.projections.map(proj =>
      String(proj.id) === String(projectionId)
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
  const handleUpdatePortfolioSettings = async (updates) => {
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      ...updates
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };
  const handleInlineProjectionYears = async (value) => {
    const parsed = Number(value);
    const safeVal = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    await handleUpdatePortfolioSettings({ projectionYears: safeVal });
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
      const newRules = RuleController.createRule(ruleData, activeProjection?.transferRules || []);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
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

          <div className="flex items-center gap-3">
            {auth?.user?.email && (
              <span className="text-sm bg-white/10 px-3 py-1 rounded-full border border-white/20">
                Signed in as {auth.user.email}
              </span>
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
          <div className="bg-slate-900/80 backdrop-blur-lg border border-white/20 rounded-xl px-3 py-3 shadow-lg flex items-center gap-2">
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
                onClick={() => setPrimaryTab('projections')}
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
                <div className="flex gap-2">
                  <button
                    onClick={handleAddProjection}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Projection
                  </button>
                  <button
                    onClick={() => handleRenameProjection(targetProjectionId)}
                    disabled={!targetProjectionId}
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
                      className={`flex-1 min-w-[240px] text-left bg-white/5 border border-white/10 rounded-lg p-4 transition-all ${
                        isActive ? 'border-purple-400/70 shadow-lg shadow-purple-500/20' : 'hover:border-white/30'
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
                  onUpdate={handleUpdatePortfolioSettings}
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
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Account
                </button>
              </div>

              {showAddAccount && (
                <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/20">
                  <AccountForm
                    onSubmit={handleAddAccount}
                    onCancel={() => setShowAddAccount(false)}
                    baseCurrency={portfolio.baseCurrency}
                  />
                </div>
              )}

              <div className="space-y-3">
                {portfolio.accounts.map(account => (
                  <div key={account.id} className="bg-white/5 rounded-lg p-4 border border-white/20 hover:bg-white/10 transition-all">
                    <AccountItem
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
                  </div>
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-purple-100">Projection Years</label>
              <input
                type="number"
                min="1"
                value={portfolio.projectionYears}
                onChange={(e) => handleInlineProjectionYears(e.target.value)}
                className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
              />
            </div>
            <ProjectionComparisonSection
              data={projectionComparisonData}
              projections={projectionSeries.map(({ id, name }) => ({ id, name }))}
              accounts={portfolio.accounts}
              baseCurrency={portfolio.baseCurrency}
              selectedAccounts={selectedAccounts}
              onToggleAccount={toggleAccountSelection}
              projectionYears={portfolio.projectionYears}
              onUpdateProjectionYears={handleInlineProjectionYears}
            />
          </div>
        )}

        {isProjectionSection && (
          <>
            {activeProjection && (
              <div className="grid lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 lg:col-span-2">
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
                        Adjust account return rates for this projection only. Inflation is subtracted from these rates.
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

                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 lg:col-span-3">
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
                onToggleIndividualAccounts={setShowIndividualAccounts}
                taxRate={projectionView.taxRate}
              />
            )}
          </>
        )}
      </div>
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
