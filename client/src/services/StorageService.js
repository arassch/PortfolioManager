import { Portfolio } from '../models/Portfolio';
import AuthService from './AuthService';
/**
 * StorageService - Handles all data persistence
 * Uses PostgreSQL API via Express backend
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

class StorageService {
  async requestWithRefresh(path, options = {}, allowRetry = true) {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...options
    });

    if ((res.status === 401 || res.status === 403) && allowRetry) {
      try {
        await AuthService.refresh();
        const refreshedHeaders = {
          ...(options.headers || {})
        };
        if (refreshedHeaders['x-csrf-token'] !== undefined) {
          refreshedHeaders['x-csrf-token'] = AuthService.getCsrfToken() || '';
        }
        return this.requestWithRefresh(path, { ...options, headers: refreshedHeaders }, false);
      } catch (err) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Unauthorized');
      }
    }

    return res;
  }

  async loadPortfolio() {
    try {
      const response = await this.requestWithRefresh('/api/portfolio');
      if (response.status === 404) {
        // No portfolio yet for this user; return a fresh model
        return new Portfolio();
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load portfolio');
      }
      const data = await response.json();
      const portfolio = new Portfolio(data);
      const trialEnds = data.trialEndsAt || data.trial_ends_at;
      const meta = data.meta || {
        subscriptionStatus: data.subscriptionStatus || data.subscription_status,
        subscriptionPeriodEnd: data.subscriptionPeriodEnd || data.subscription_period_end || trialEnds || null,
        trialEndsAt: trialEnds || null,
        isWhitelisted: data.isWhitelisted
      };
      return { portfolio, meta };
    } catch (error) {
      console.error('Error loading portfolio:', error);
      return null;
    }
  }

  async savePortfolio(portfolioData) {
    const query = `${API_URL}/api/portfolio`;
    try {
      const sanitizeRule = (rule) => ({
        ...rule,
        fromAccountId: rule.fromAccountId || null,
        toAccountId: rule.toAccountId || null,
        startDate: rule.startDate ? rule.startDate : null,
        endDate: rule.endDate ? rule.endDate : null
      });

      const sanitized = {
        ...portfolioData,
        taxRate: portfolioData.taxRate != null ? Number(portfolioData.taxRate) : portfolioData.taxRate,
        projectionYears: portfolioData.projectionYears != null ? Number(portfolioData.projectionYears) : portfolioData.projectionYears,
        accounts: (portfolioData.accounts || []).map(acc => ({
          ...acc,
          balance: Number(acc.balance),
          returnRate: acc.returnRate != null ? Number(acc.returnRate) : 0
        })),
        projections: (portfolioData.projections || []).map(proj => {
          const INT_MAX = 2147483647;
          const safeId = Number.isFinite(proj.id) && Math.abs(proj.id) <= INT_MAX ? proj.id : null;
          return {
            ...proj,
            id: safeId,
            inflationRate: proj.inflationRate != null ? Number(proj.inflationRate) : 0,
            taxRate: proj.taxRate != null ? Number(proj.taxRate) : proj.taxRate,
            projectionYears: proj.projectionYears != null ? Number(proj.projectionYears) : proj.projectionYears,
            transferRules: (proj.transferRules || []).map(sanitizeRule)
          };
        }),
        transferRules: (portfolioData.transferRules || []).map(sanitizeRule)
      };

      let body;
      try {
        body = JSON.stringify(sanitized);
        console.log("Sending data to server:", body);
      } catch (e) {
        console.error("Failed to stringify portfolio data. Check for circular references.", portfolioData);
        throw e;
      }

      const response = await this.requestWithRefresh('/api/portfolio', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': AuthService.getCsrfToken() || ''
        },
        body: body
      });
      if (!response.ok) {
        throw new Error('Failed to save portfolio');
      }
      return true;
    } catch (error) {
        console.info('Query with error:', query);
      console.error('Error saving portfolio:', error);
      return false;
    }
  }

  exportToJSON(portfolioData) {
    const blob = new Blob([JSON.stringify(portfolioData, null, 2)], 
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async startCheckout(plan) {
    const res = await this.requestWithRefresh('/api/stripe/checkout', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-csrf-token': AuthService.getCsrfToken() || ''
      },
      body: JSON.stringify({ plan })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to start checkout');
    }
    return data;
  }

  async openPortal() {
    const res = await this.requestWithRefresh('/api/stripe/portal', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-csrf-token': AuthService.getCsrfToken() || ''
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to open billing portal');
    }
    return data;
  }

  async importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(new Portfolio(data));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}

export default new StorageService();
