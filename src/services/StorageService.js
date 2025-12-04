/**
 * StorageService - Handles all data persistence
 * Prefers window.storage (Claude) but falls back to localStorage
 */
const STORAGE_KEY = 'portfolio_data';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const USER_ID = 1; // For now, hardcoded. Later use auth system.

const storageAvailable = 
  typeof window?.storage?.get === 'function' && 
  typeof window?.storage?.set === 'function';

class StorageService {
  async get(key) {
    if (storageAvailable) {
      return window.storage.get(key);
    } else {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    }
  }

  async set(key, value) {
    if (storageAvailable) {
      return window.storage.set(key, value);
    } else {
      localStorage.setItem(key, value);
      return true;
    }
  }

  async loadPortfolio() {
    try {
      const result = await this.get(STORAGE_KEY);
      if (result && result.value) {
        return JSON.parse(result.value);
      }
      return null;
    } catch (error) {
      console.error('Error loading portfolio:', error);
      return null;
    }
  }

  async savePortfolio(portfolioData) {
    try {
      await this.set(STORAGE_KEY, JSON.stringify(portfolioData));
      return true;
    } catch (error) {
      console.error('Error saving portfolio:', error);
      return false;
    }
  }

  async loadPortfolioFromAPI() {
    try {
      const response = await fetch(`${API_URL}/api/portfolio/${USER_ID}`);
      if (!response.ok) {
        throw new Error('Failed to load portfolio');
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading portfolio:', error);
      return null;
    }
  }

  async savePortfolioToAPI(portfolioData) {
    try {
      const response = await fetch(`${API_URL}/api/portfolio/${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData)
      });
      if (!response.ok) {
        throw new Error('Failed to save portfolio');
      }
      return true;
    } catch (error) {
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

  async importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
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