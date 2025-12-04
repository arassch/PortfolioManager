import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, TrendingUp, DollarSign, Trash2, Edit2, Save, X, Download, Upload, Filter } from 'lucide-react';

// storage fallback: prefer window.storage (Claude) but use localStorage in the browser
const storageAvailable = typeof window?.storage?.get === 'function' && typeof window?.storage?.set === 'function';

const storageWrapper = {
  async get(key) {
    if (storageAvailable) {
      return window.storage.get(key);
    } else {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    }
  },
  async set(key, value) {
    if (storageAvailable) {
      return window.storage.set(key, value);
    } else {
      localStorage.setItem(key, value);
      return true;
    }
  }
};

const CURRENCIES = ['USD', 'GBP', 'EUR', 'JPY', 'CAD', 'AUD', 'CHF'];
const EXCHANGE_RATES = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  JPY: 149.50,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88
};

export default function PortfolioManager() {
  const [accounts, setAccounts] = useState([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [projectionYears, setProjectionYears] = useState(10);
  const [defaultInvestmentYield, setDefaultInvestmentYield] = useState(7);
  const [taxRate, setTaxRate] = useState(25);
  const [actualValues, setActualValues] = useState({});
  const [showActualInput, setShowActualInput] = useState(null);
  const [transferRules, setTransferRules] = useState([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [activeTab, setActiveTab] = useState('growth');
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [showIndividualAccounts, setShowIndividualAccounts] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'investment',
    balance: 0,
    currency: baseCurrency,
    interestRate: 0,
    taxable: false,
    yield: 7
  });

  const [newRule, setNewRule] = useState({
    fromAccountId: '',
    fromExternal: false,
    externalAmount: 0,
    externalCurrency: baseCurrency,
    frequency: 'annual',
    amountType: 'fixed',
    transfers: [{ toAccountId: '' }]
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const selected = {};
    accounts.forEach(acc => {
      selected[acc.id] = true;
    });
    setSelectedAccounts(selected);
  }, [accounts]);

  useEffect(() => {
    setNewAccount(prev => ({ ...prev, currency: baseCurrency }));
    setNewRule(prev => ({ ...prev, externalCurrency: baseCurrency }));
  }, [baseCurrency]);

  const convertToBase = (amount, fromCurrency) => {
    const toUSD = amount / EXCHANGE_RATES[fromCurrency];
    return toUSD * EXCHANGE_RATES[baseCurrency];
  };

  const saveData = async () => {
    try {
      const data = {
        accounts,
        transferRules,
        actualValues,
        projectionYears,
        defaultInvestmentYield,
        taxRate,
        baseCurrency
      };
      
      await storageWrapper.set('portfolio_data', JSON.stringify(data));
      setSaveStatus('Saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('Save failed');
    }
  };

  const loadData = async () => {
    try {
      const result = await storageWrapper.get('portfolio_data');
      if (result && result.value) {
        const data = JSON.parse(result.value);
        setAccounts(data.accounts || []);
        setTransferRules(data.transferRules || []);
        setActualValues(data.actualValues || {});
        setProjectionYears(data.projectionYears || 10);
        setDefaultInvestmentYield(data.defaultInvestmentYield || 7);
        setTaxRate(data.taxRate || 25);
        setBaseCurrency(data.baseCurrency || 'USD');
      }
    } catch (error) {
      // No saved data
    }
  };

  const exportData = () => {
    const data = {
      accounts,
      transferRules,
      actualValues,
      projectionYears,
      defaultInvestmentYield,
      taxRate,
      baseCurrency
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_backup.json';
    a.click();
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setAccounts(data.accounts || []);
          setTransferRules(data.transferRules || []);
          setActualValues(data.actualValues || {});
          setProjectionYears(data.projectionYears || 10);
          setDefaultInvestmentYield(data.defaultInvestmentYield || 7);
          setTaxRate(data.taxRate || 25);
          setBaseCurrency(data.baseCurrency || 'USD');
          saveData();
        } catch (error) {
          alert('Error importing file');
        }
      };
      reader.readAsText(file);
    }
  };

  const addAccount = () => {
    if (newAccount.name && newAccount.balance > 0) {
      setAccounts([...accounts, { ...newAccount, id: Date.now() }]);
      setNewAccount({
        name: '',
        type: 'investment',
        balance: 0,
        currency: baseCurrency,
        interestRate: 0,
        taxable: false,
        yield: 7
      });
      setShowAddAccount(false);
      saveData();
    }
  };

  const deleteAccount = (id) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
    const newActuals = { ...actualValues };
    delete newActuals[id];
    setActualValues(newActuals);
    setTransferRules(transferRules.filter(rule => 
      rule.fromAccountId !== id && !rule.transfers.some(t => t.toAccountId === id)
    ));
    saveData();
  };

  const startEdit = (account) => {
    setEditingId(account.id);
  };

  const saveEdit = (id, field, value) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, [field]: value } : acc
    ));
    saveData();
  };

  const finishEdit = () => {
    setEditingId(null);
  };

  const addTransferRule = () => {
    if ((newRule.fromAccountId || newRule.fromExternal) && newRule.transfers.length > 0 && 
        newRule.transfers.every(t => t.toAccountId)) {
      if (newRule.fromExternal && newRule.amountType === 'fixed' && newRule.externalAmount <= 0) {
        return;
      }
      if (!newRule.fromExternal && newRule.amountType === 'fixed' && (!newRule.externalAmount || newRule.externalAmount <= 0)) {
        return;
      }
      
      const cleanedRule = {
        ...newRule,
        transfers: newRule.transfers.map(t => ({
          toAccountId: t.toAccountId
        })),
        id: Date.now()
      };
      
      setTransferRules([...transferRules, cleanedRule]);
      setNewRule({
        fromAccountId: '',
        fromExternal: false,
        externalAmount: 0,
        externalCurrency: baseCurrency,
        frequency: 'annual',
        amountType: 'fixed',
        transfers: [{ toAccountId: '' }]
      });
      setShowAddRule(false);
      saveData();
    }
  };

  const startEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setNewRule({ ...rule });
  };

  const saveRuleEdit = () => {
    if ((newRule.fromAccountId || newRule.fromExternal) && newRule.transfers.length > 0 && 
        newRule.transfers.every(t => t.toAccountId)) {
      
      const cleanedRule = {
        ...newRule,
        transfers: newRule.transfers.map(t => ({
          toAccountId: t.toAccountId
        })),
        id: editingRuleId
      };
      
      setTransferRules(transferRules.map(rule => 
        rule.id === editingRuleId ? cleanedRule : rule
      ));
      setEditingRuleId(null);
      setNewRule({
        fromAccountId: '',
        fromExternal: false,
        externalAmount: 0,
        externalCurrency: baseCurrency,
        frequency: 'annual',
        amountType: 'fixed',
        transfers: [{ toAccountId: '' }]
      });
      saveData();
    }
  };

  const cancelRuleEdit = () => {
    setEditingRuleId(null);
    setNewRule({
      fromAccountId: '',
      fromExternal: false,
      externalAmount: 0,
      externalCurrency: baseCurrency,
      frequency: 'annual',
      amountType: 'fixed',
      transfers: [{ toAccountId: '' }]
    });
  };

  const deleteRule = (id) => {
    setTransferRules(transferRules.filter(rule => rule.id !== id));
    saveData();
  };

  const addTransferToRule = () => {
    setNewRule({
      ...newRule,
      transfers: [...newRule.transfers, { toAccountId: '' }]
    });
  };

  const updateRuleTransfer = (index, field, value) => {
    const updatedTransfers = [...newRule.transfers];
    updatedTransfers[index][field] = value;
    setNewRule({ ...newRule, transfers: updatedTransfers });
  };

  const removeTransferFromRule = (index) => {
    setNewRule({
      ...newRule,
      transfers: newRule.transfers.filter((_, i) => i !== index)
    });
  };

  const getAccountById = (id) => {
    if (!id) return null;
    return accounts.find(acc => acc.id == id || String(acc.id) === String(id));
  };

  const calculateProjections = () => {
    const data = [];
    const currentYear = new Date().getFullYear();
    
    const accountBalances = {};
    accounts.forEach(account => {
      accountBalances[account.id] = convertToBase(account.balance, account.currency);
    });

    for (let yearIndex = 0; yearIndex <= projectionYears; yearIndex++) {
      const year = currentYear + yearIndex;
      const yearData = { 
        year,
        label: year.toString(),
        projected: 0,
        totalYield: 0,
        actual: null
      };
      
      let totalProjected = 0;
      let totalYieldForYear = 0;
      let totalActual = 0;

      // Store start of year balances
      const yearStartBalances = {};
      accounts.forEach(account => {
        yearStartBalances[account.id] = accountBalances[account.id];
      });

      // Simulate 12 months of growth
      for (let month = 1; month <= 12; month++) {
        accounts.forEach(account => {
          const rate = account.type === 'cash' ? account.interestRate : (account.yield || defaultInvestmentYield);
          const monthlyRate = rate / 100 / 12;
          accountBalances[account.id] = accountBalances[account.id] * (1 + monthlyRate);
        });

        // Apply monthly transfers
        if (yearIndex > 0) {
          transferRules.forEach(rule => {
            if (rule.frequency !== 'monthly') return;

            let availableAmount = 0;
            if (rule.fromExternal) {
              availableAmount = convertToBase(rule.externalAmount, rule.externalCurrency) / 12;
            } else {
              const fromAccount = getAccountById(rule.fromAccountId);
              if (!fromAccount) return;
              if (rule.amountType === 'earnings') {
                const monthlyGrowth = accountBalances[rule.fromAccountId] - yearStartBalances[rule.fromAccountId];
                availableAmount = monthlyGrowth / 12;
              } else {
                availableAmount = convertToBase(rule.externalAmount || 0, fromAccount.currency) / 12;
              }
            }

            const amountPerTransfer = availableAmount / rule.transfers.length;
            rule.transfers.forEach((transfer) => {
              if (accountBalances[transfer.toAccountId] !== undefined) {
                if (!rule.fromExternal && rule.fromAccountId) {
                  accountBalances[rule.fromAccountId] -= amountPerTransfer;
                }
                accountBalances[transfer.toAccountId] += amountPerTransfer;
              }
            });
          });
        }
      }

      // Apply annual transfers at year end
      if (yearIndex > 0) {
        transferRules.forEach(rule => {
          if (rule.frequency !== 'annual') return;

          let availableAmount = 0;
          if (rule.fromExternal) {
            availableAmount = convertToBase(rule.externalAmount, rule.externalCurrency);
          } else {
            const fromAccount = getAccountById(rule.fromAccountId);
            if (!fromAccount) return;
            if (rule.amountType === 'earnings') {
              availableAmount = accountBalances[rule.fromAccountId] - yearStartBalances[rule.fromAccountId];
            } else {
              availableAmount = convertToBase(rule.externalAmount || 0, fromAccount.currency);
            }
          }

          const amountPerTransfer = availableAmount / rule.transfers.length;
          rule.transfers.forEach((transfer) => {
            if (accountBalances[transfer.toAccountId] !== undefined) {
              if (!rule.fromExternal && rule.fromAccountId) {
                accountBalances[rule.fromAccountId] -= amountPerTransfer;
              }
              accountBalances[transfer.toAccountId] += amountPerTransfer;
            }
          });
        });
      }

      // Apply taxes and calculate totals
      accounts.forEach(account => {
        let value = accountBalances[account.id];
        
        if (account.taxable && yearIndex > 0) {
          const originalBalance = convertToBase(account.balance, account.currency);
          if (value > originalBalance) {
            const gain = value - originalBalance;
            const tax = gain * (taxRate / 100);
            value -= tax;
            accountBalances[account.id] = value;
          }
        }

        const isSelected = selectedAccounts[account.id];
        
        if (isSelected) {
          totalProjected += value;
          
          if (yearIndex > 0) {
            const annualYield = value - yearStartBalances[account.id];
            totalYieldForYear += annualYield;
            
            if (showIndividualAccounts) {
              yearData[`account_${account.id}_yield`] = Math.round(annualYield);
            }
          } else if (showIndividualAccounts) {
            yearData[`account_${account.id}_yield`] = 0;
          }
        }

        if (showIndividualAccounts && isSelected) {
          yearData[`account_${account.id}`] = Math.round(value);
        }

        if (actualValues[account.id] && actualValues[account.id][yearIndex] && isSelected) {
          totalActual += convertToBase(actualValues[account.id][yearIndex], account.currency);
        }
      });

      yearData.projected = Math.round(totalProjected);
      yearData.totalYield = Math.round(totalYieldForYear);
      yearData.actual = totalActual > 0 ? Math.round(totalActual) : null;
      
      data.push(yearData);
    }

    return data;
  };

  const addActualValue = (accountId, year, value) => {
    setActualValues(prev => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || {}),
        [year]: parseFloat(value)
      }
    }));
    saveData();
  };

  const toggleAccountSelection = (accountId) => {
    setSelectedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const projectionData = calculateProjections();
  const totalBalance = accounts.reduce((sum, acc) => 
    sum + convertToBase(acc.balance, acc.currency), 0
  );

  const getCurrencySymbol = (currency) => {
    const symbols = { USD: '$', GBP: '£', EUR: '€', JPY: '¥', CAD: 'C$', AUD: 'A$', CHF: 'Fr' };
    return symbols[currency] || currency;
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
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Total Balance</p>
                <p className="text-3xl font-bold text-white">
                  {getCurrencySymbol(baseCurrency)}{totalBalance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-green-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Accounts</p>
                <p className="text-3xl font-bold text-white">{accounts.length}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm mb-1">Projected ({projectionYears}yr)</p>
                <p className="text-3xl font-bold text-white">
                  {getCurrencySymbol(baseCurrency)}{projectionData[projectionData.length - 1]?.projected.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div>
              <p className="text-purple-200 text-sm mb-2">Display Currency</p>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
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
                onClick={saveData}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all text-sm"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all cursor-pointer text-sm">
                <Upload className="w-4 h-4" />
                Import
                <input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
            </div>
            {saveStatus && (
              <span className="text-green-300 text-sm">{saveStatus}</span>
            )}
          </div>
        </div>

        {/* Projection Settings */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">Projection Settings</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-purple-200 text-sm mb-2">Projection Years</label>
              <input
                type="number"
                value={projectionYears}
                onChange={(e) => { setProjectionYears(Math.max(1, parseInt(e.target.value) || 1)); saveData(); }}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm mb-2">Default Investment Yield (%)</label>
              <input
                type="number"
                step="0.1"
                value={defaultInvestmentYield}
                onChange={(e) => { setDefaultInvestmentYield(parseFloat(e.target.value) || 0); saveData(); }}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm mb-2">Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={(e) => { setTaxRate(parseFloat(e.target.value) || 0); saveData(); }}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('growth')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'growth' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white/5 text-purple-200 hover:bg-white/10'
                }`}
              >
                Growth Projection
              </button>
              <button
                onClick={() => setActiveTab('yields')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'yields' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white/5 text-purple-200 hover:bg-white/10'
                }`}
              >
                Earnings
              </button>
            </div>
          </div>

          {/* Account Filters */}
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <span className="text-purple-200 text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter Accounts:
            </span>
            {accounts.map(account => (
              <label key={account.id} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 border border-white/20 cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={selectedAccounts[account.id] || false}
                  onChange={() => toggleAccountSelection(account.id)}
                  className="w-3 h-3"
                />
                <span className="text-white text-sm">{account.name}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/30 border border-purple-400/50 cursor-pointer hover:bg-purple-500/40 transition-all ml-4">
              <input
                type="checkbox"
                checked={showIndividualAccounts}
                onChange={(e) => setShowIndividualAccounts(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-white text-sm font-semibold">Show Individual Accounts</span>
            </label>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            {activeTab === 'growth' ? (
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="label" stroke="#ffffff80" />
                <YAxis stroke="#ffffff80" tickFormatter={(val) => `${getCurrencySymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #ffffff30', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff' }}
                  formatter={(value) => [`${getCurrencySymbol(baseCurrency)}${value.toLocaleString()}`, '']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="projected" 
                  stroke="#a78bfa" 
                  strokeWidth={3}
                  dot={false}
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#34d399" 
                  strokeWidth={3}
                  dot={{ fill: '#34d399', r: 4 }}
                  animationDuration={1500}
                  connectNulls
                />
                {showIndividualAccounts && accounts.filter(acc => selectedAccounts[acc.id]).map((account, idx) => (
                  <Line
                    key={account.id}
                    type="monotone"
                    dataKey={`account_${account.id}`}
                    name={account.name}
                    stroke={`hsl(${(idx * 360) / accounts.length}, 70%, 60%)`}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={1500}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="label" stroke="#ffffff80" />
                <YAxis stroke="#ffffff80" tickFormatter={(val) => `${getCurrencySymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #ffffff30', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff' }}
                  formatter={(value, name) => [`${getCurrencySymbol(baseCurrency)}${value?.toLocaleString() || '0'}`, name]}
                />
                <Legend />
                {showIndividualAccounts ? (
                  accounts.filter(acc => selectedAccounts[acc.id]).map((account, idx) => (
                    <Bar
                      key={account.id}
                      dataKey={`account_${account.id}_yield`}
                      name={account.name}
                      fill={`hsl(${(idx * 360) / accounts.length}, 70%, 60%)`}
                      animationDuration={1500}
                    />
                  ))
                ) : (
                  <Bar
                    dataKey="totalYield"
                    name="Total Earnings"
                    fill="#a78bfa"
                    animationDuration={1500}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
          
        </div>

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
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Account Name"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                />
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="investment">Investment</option>
                  <option value="cash">Cash</option>
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Current Balance"
                    value={newAccount.balance || ''}
                    onChange={(e) => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                  />
                  <select
                    value={newAccount.currency}
                    onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                    className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  >
                    {CURRENCIES.map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                  </select>
                </div>
                {newAccount.type === 'cash' ? (
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Interest Rate (%)"
                    value={newAccount.interestRate || ''}
                    onChange={(e) => setNewAccount({ ...newAccount, interestRate: parseFloat(e.target.value) || 0 })}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                  />
                ) : (
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Expected Yield (%)"
                    value={newAccount.yield || ''}
                    onChange={(e) => setNewAccount({ ...newAccount, yield: parseFloat(e.target.value) || 0 })}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAccount.taxable}
                    onChange={(e) => setNewAccount({ ...newAccount, taxable: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  Taxable Account
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addAccount}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
                >
                  Add Account
                </button>
                <button
                  onClick={() => setShowAddAccount(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {accounts.map(account => (
              <div key={account.id} className="bg-white/5 rounded-lg p-4 border border-white/20 hover:bg-white/10 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {editingId === account.id ? (
                        <input
                          type="text"
                          value={account.name}
                          onChange={(e) => saveEdit(account.id, 'name', e.target.value)}
                          className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-lg font-semibold"
                        />
                      ) : (
                        <h4 className="text-lg font-semibold text-white">{account.name}</h4>
                      )}
                      <span className={`px-2 py-1 rounded text-xs ${
                        account.type === 'investment' ? 'bg-blue-500/30 text-blue-200' : 'bg-green-500/30 text-green-200'
                      }`}>
                        {account.type}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-purple-500/30 text-purple-200">
                        {account.currency}
                      </span>
                      {account.taxable && (
                        <span className="px-2 py-1 rounded text-xs bg-orange-500/30 text-orange-200">
                          Taxable
                        </span>
                      )}
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-purple-200">Balance: </span>
                        {editingId === account.id ? (
                          <input
                            type="number"
                            value={account.balance}
                            onChange={(e) => saveEdit(account.id, 'balance', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white"
                          />
                        ) : (
                          <span className="text-white font-semibold">
                            {getCurrencySymbol(account.currency)}{account.balance.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-purple-200">{account.type === 'cash' ? 'Interest' : 'Yield'}: </span>
                        {editingId === account.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={account.type === 'cash' ? account.interestRate : account.yield}
                            onChange={(e) => saveEdit(account.id, account.type === 'cash' ? 'interestRate' : 'yield', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded bg-white/10 border border-white/20 text-white"
                          />
                        ) : (
                          <span className="text-white font-semibold">
                            {account.type === 'cash' ? account.interestRate : account.yield}%
                          </span>
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => setShowActualInput(showActualInput === account.id ? null : account.id)}
                          className="text-sm text-purple-300 hover:text-purple-200 underline"
                        >
                          Log Actual Value
                        </button>
                      </div>
                    </div>
                    {showActualInput === account.id && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="number"
                          placeholder="Year"
                          className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                          id={`year-${account.id}`}
                        />
                        <input
                          type="number"
                          placeholder="Actual Value"
                          className="flex-1 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                          id={`value-${account.id}`}
                        />
                        <button
                          onClick={() => {
                            const year = parseInt(document.getElementById(`year-${account.id}`).value) - new Date().getFullYear();
                            const value = parseFloat(document.getElementById(`value-${account.id}`).value);
                            if (!isNaN(year) && !isNaN(value) && year >= 0) {
                              addActualValue(account.id, year, value);
                              document.getElementById(`year-${account.id}`).value = '';
                              document.getElementById(`value-${account.id}`).value = '';
                            }
                          }}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {editingId === account.id ? (
                      <button onClick={finishEdit} className="p-2 text-green-400 hover:text-green-300">
                        <Save className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => startEdit(account)} className="p-2 text-blue-400 hover:text-blue-300">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteAccount(account.id)} className="p-2 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {accounts.length === 0 && (
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
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="flex items-center gap-2 text-white cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={newRule.fromExternal}
                      onChange={(e) => setNewRule({ 
                        ...newRule, 
                        fromExternal: e.target.checked,
                        fromAccountId: e.target.checked ? '' : newRule.fromAccountId 
                      })}
                      className="w-4 h-4 rounded"
                    />
                    External Source
                  </label>

                  {newRule.fromExternal ? (
                    <div>
                      <label className="block text-purple-200 text-sm mb-2">Amount Type</label>
                      <select
                        value={newRule.amountType}
                        onChange={(e) => setNewRule({ ...newRule, amountType: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400 mb-2"
                      >
                        <option value="fixed">Fixed Amount</option>
                      </select>
                      <label className="block text-purple-200 text-sm mb-2">Amount per {newRule.frequency === 'annual' ? 'Year' : 'Month'}</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="number"
                          placeholder={`Amount per ${newRule.frequency === 'annual' ? 'year' : 'month'}`}
                          value={newRule.externalAmount || ''}
                          onChange={(e) => setNewRule({ ...newRule, externalAmount: parseFloat(e.target.value) || 0 })}
                          className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                        />
                        <select
                          value={newRule.externalCurrency}
                          onChange={(e) => setNewRule({ ...newRule, externalCurrency: e.target.value })}
                          className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                        >
                          {CURRENCIES.map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-purple-200 text-sm mb-2">Transfer From</label>
                      <select
                        value={newRule.fromAccountId}
                        onChange={(e) => setNewRule({ ...newRule, fromAccountId: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400 mb-2"
                      >
                        <option value="">Select Account</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                      <label className="block text-purple-200 text-sm mb-2">Amount Type</label>
                      <select
                        value={newRule.amountType}
                        onChange={(e) => setNewRule({ ...newRule, amountType: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                      >
                        <option value="fixed">Fixed Amount</option>
                        <option value="earnings">Earnings</option>
                      </select>
                      {newRule.amountType === 'fixed' && (
                        <>
                          <label className="block text-purple-200 text-sm mb-2 mt-2">Amount per {newRule.frequency === 'annual' ? 'Year' : 'Month'}</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder={`Amount per ${newRule.frequency === 'annual' ? 'year' : 'month'}`}
                              value={newRule.externalAmount || ''}
                              onChange={(e) => setNewRule({ ...newRule, externalAmount: parseFloat(e.target.value) || 0 })}
                              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                            />
                            <select
                              value={newRule.externalCurrency}
                              onChange={(e) => setNewRule({ ...newRule, externalCurrency: e.target.value })}
                              className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                            >
                              {CURRENCIES.map(curr => (
                                <option key={curr} value={curr}>{curr}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-purple-200 text-sm mb-2">Frequency</label>
                  <select
                    value={newRule.frequency}
                    onChange={(e) => setNewRule({ ...newRule, frequency: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="annual">Annual</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <label className="block text-purple-200 text-sm">Transfer To (split equally)</label>
                {newRule.transfers.map((transfer, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={transfer.toAccountId}
                      onChange={(e) => updateRuleTransfer(index, 'toAccountId', e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="">Select Account</option>
                      {accounts.filter(acc => acc.id !== newRule.fromAccountId).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                    {newRule.transfers.length > 1 && (
                      <button
                        onClick={() => removeTransferFromRule(index)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={addTransferToRule}
                  className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-all"
                >
                  + Add Destination
                </button>
              </div>

              <div className="flex gap-2">
                {editingRuleId ? (
                  <>
                    <button
                      onClick={saveRuleEdit}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={cancelRuleEdit}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={addTransferRule}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
                    >
                      Save Rule
                    </button>
                    <button
                      onClick={() => setShowAddRule(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {transferRules.map(rule => {
              const fromAccount = rule.fromAccountId ? getAccountById(rule.fromAccountId) : null;
              
              return (
                <div key={rule.id} className="bg-white/5 rounded-lg p-4 border border-white/20">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-white font-semibold mb-2">
                        {rule.fromExternal ? (
                          <>
                            From: <span className="text-green-300">External</span>{' '}
                            <span className="text-purple-200 text-sm">
                              ({getCurrencySymbol(rule.externalCurrency)}{(rule.externalAmount || 0).toLocaleString()}/{rule.frequency})
                            </span>
                          </>
                        ) : (
                          <>
                            From: {fromAccount ? <span className="text-blue-300">{fromAccount.name}</span> : <span className="text-red-300">Deleted Account</span>}{' '}
                            <span className="text-purple-200 text-sm">
                              ({rule.amountType === 'earnings' ? 'earnings' : `${getCurrencySymbol(fromAccount?.currency || 'USD')}${(rule.externalAmount || 0).toLocaleString()}`}/{rule.frequency})
                            </span>
                          </>
                        )}
                      </h4>
                      <div className="space-y-1">
                        {rule.transfers && rule.transfers.map((transfer, index) => {
                          const toAccount = getAccountById(transfer.toAccountId);
                          const totalAmount = rule.externalAmount || 0;
                          const splitAmount = rule.amountType === 'earnings' ? 'equal split of earnings' : 
                            `${getCurrencySymbol(rule.fromExternal ? rule.externalCurrency : (fromAccount?.currency || 'USD'))}${(totalAmount / (rule.transfers?.length || 1)).toLocaleString(undefined, {maximumFractionDigits: 2})}`;
                          return (
                            <div key={index} className="text-sm text-purple-200">
                              → {toAccount ? <span className="text-white">{toAccount.name}</span> : <span className="text-red-300">Deleted Account</span>} <span className="text-blue-300">({splitAmount})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => startEditRule(rule)}
                        className="p-2 text-blue-400 hover:text-blue-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteRule(rule.id)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {transferRules.length === 0 && (
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