import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  Save, 
  Download, 
  Upload, 
  Filter,
  Edit2,
  Trash2,
  X
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
import { TransferRule } from './models/TransferRule';
import { Portfolio } from './models/Portfolio';

// Controllers
import AccountController from './controllers/AccountController';
import RuleController from './controllers/RuleController';

// Services
import CurrencyService from './services/CurrencyService';

// Hooks
import { usePortfolioData } from './hooks/usePortfolioData';
import { useProjections } from './hooks/useProjections';

// Components
import { SummaryCard } from './components/SummaryCard';
import { AccountForm } from './components/AccountForm';
import { AccountItem } from './components/AccountItem';
import { TransferRuleForm } from './components/TransferRuleForm';
import { TransferRuleItem } from './components/TransferRuleItem';
import { ChartSection } from './components/ChartSection';
import { ProjectionSettings } from './components/ProjectionSettings';

// Constants
import { CURRENCIES, CURRENCY_SYMBOLS } from './constants/currencies';

function PortfolioManager() {
  const {
    portfolio,
    updatePortfolio,
    savePortfolio,
    exportPortfolio,
    importPortfolio,
    saveStatus,
    isLoading
  } = usePortfolioData();

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [activeTab, setActiveTab] = useState('growth');
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [showIndividualAccounts, setShowIndividualAccounts] = useState(true);
  const [showActualInput, setShowActualInput] = useState(null);

  // Initialize selected accounts on portfolio load
  useEffect(() => {
    const selected = {};
    portfolio.accounts.forEach(acc => {
      selected[acc.id] = true;
    });
    setSelectedAccounts(selected);
  }, [portfolio.accounts]);

  // Calculate projections
  const projectionData = useProjections(
    portfolio,
    selectedAccounts,
    showIndividualAccounts
  );

  // Helper functions
  const getCurrencySymbol = (currency) => {
    return CURRENCY_SYMBOLS[currency] || currency;
  };

  const getAccountById = (id) => {
    if (!id) return null;
    return portfolio.accounts.find(acc => acc.id == id || String(acc.id) === String(id));
  };

  const toggleAccountSelection = (accountId) => {
    setSelectedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  // Account handlers
  const handleAddAccount = async (accountData) => {
    try {
      const newAccounts = AccountController.createAccount(
        accountData,
        portfolio.accounts
      );
      const updatedPortfolio = new Portfolio({
        ...portfolio.toJSON(),
        accounts: newAccounts
      });
      updatePortfolio(updatedPortfolio);
      await savePortfolio(updatedPortfolio);
      setShowAddAccount(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveAccountEdit = async (accountId, field, value) => {
    const updatedAccounts = AccountController.updateAccount(
      accountId,
      field,
      value,
      portfolio.accounts
    );
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      accounts: updatedAccounts
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  const handleDeleteAccount = async (accountId) => {
    const { accounts, transferRules } = AccountController.deleteAccount(
      accountId,
      portfolio.accounts,
      portfolio.transferRules
    );
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      accounts,
      transferRules
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

  // Transfer rule handlers
  const handleAddRule = async (ruleData) => {
    try {
      const newRules = RuleController.createRule(ruleData, portfolio.transferRules);
      const updatedPortfolio = new Portfolio({
        ...portfolio.toJSON(),
        transferRules: newRules
      });
      updatePortfolio(updatedPortfolio);
      await savePortfolio(updatedPortfolio);
      setShowAddRule(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveRuleEdit = async (ruleData) => {
    try {
      const newRules = RuleController.updateRule(
        editingRuleId,
        ruleData,
        portfolio.transferRules
      );
      const updatedPortfolio = new Portfolio({
        ...portfolio.toJSON(),
        transferRules: newRules
      });
      updatePortfolio(updatedPortfolio);
      await savePortfolio(updatedPortfolio);
      setEditingRuleId(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    const updatedRules = portfolio.transferRules.filter(rule => rule.id !== ruleId);
    const updatedPortfolio = new Portfolio({
      ...portfolio.toJSON(),
      transferRules: updatedRules
    });
    updatePortfolio(updatedPortfolio);
    await savePortfolio(updatedPortfolio);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <TrendingUp className="w-10 h-10" />
            Portfolio Manager
          </h1>
          <p className="text-purple-200">Track and project your investments & savings</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            title="Total Balance"
            value={portfolio.accounts.reduce((sum, acc) => 
              sum + CurrencyService.convertToBase(acc.balance, acc.currency, portfolio.baseCurrency), 0
            )}
            currency={portfolio.baseCurrency}
            icon={DollarSign}
          />
          <SummaryCard
            title="Accounts"
            value={portfolio.accounts.length}
            icon={TrendingUp}
          />
          <SummaryCard
            title={`Projected (${portfolio.projectionYears}yr)`}
            value={projectionData[projectionData.length - 1]?.projected}
            currency={portfolio.baseCurrency}
            icon={TrendingUp}
          />
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div>
              <p className="text-purple-200 text-sm mb-2">Display Currency</p>
              <select
                value={portfolio.baseCurrency}
                onChange={(e) => {
                  const updated = new Portfolio({
                    ...portfolio.toJSON(),
                    baseCurrency: e.target.value
                  });
                  updatePortfolio(updated);
                  savePortfolio(updated);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              >
                {CURRENCIES.map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-8 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={savePortfolio}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all text-sm"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={exportPortfolio}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all cursor-pointer text-sm">
                <Upload className="w-4 h-4" />
                Import
                <input type="file" accept=".json" onChange={importPortfolio} className="hidden" />
              </label>
            </div>
            {saveStatus && (
              <span className="text-green-300 text-sm">{saveStatus}</span>
            )}
          </div>
        </div>

        {/* Projection Settings */}
        <ProjectionSettings
          projectionYears={portfolio.projectionYears}
          defaultInvestmentYield={portfolio.defaultInvestmentYield}
          taxRate={portfolio.taxRate}
          onUpdate={(updates) => {
            const updated = new Portfolio({
              ...portfolio.toJSON(),
              ...updates
            });
            updatePortfolio(updated);
            savePortfolio(updated);
          }}
        />

        {/* Charts */}
        <ChartSection
          projectionData={projectionData}
          accounts={portfolio.accounts}
          selectedAccounts={selectedAccounts}
          showIndividualAccounts={showIndividualAccounts}
          activeTab={activeTab}
          baseCurrency={portfolio.baseCurrency}
          onTabChange={setActiveTab}
          onToggleAccount={toggleAccountSelection}
          onToggleIndividualAccounts={setShowIndividualAccounts}
          defaultInvestmentYield={portfolio.defaultInvestmentYield}
          taxRate={portfolio.taxRate}
        />

        {/* Accounts List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Accounts</h3>
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
                  onAddActualValue={handleAddActualValue}
                  showActualValueInput={showActualInput === account.id}
                  onToggleActualValueInput={() => setShowActualInput(showActualInput === account.id ? null : account.id)}
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

        {/* Transfer Rules */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Transfer Rules</h3>
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
                rule={editingRuleId ? portfolio.transferRules.find(r => r.id === editingRuleId) : null}
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
            {portfolio.transferRules.map(rule => {
              const fromAccount = rule.fromAccountId ? getAccountById(rule.fromAccountId) : null;
              
              return (
                <div key={rule.id} className="bg-white/5 rounded-lg p-4 border border-white/20">
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

          {portfolio.transferRules.length === 0 && (
            <div className="text-center py-8 text-purple-200">
              <p>No transfer rules yet. Add rules to automatically move funds between accounts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mount the app (entry behavior)
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <PortfolioManager />
    </React.StrictMode>
  );
}
