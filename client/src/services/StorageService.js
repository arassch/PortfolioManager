import { Portfolio } from '../models/Portfolio';
/**
 * StorageService - Handles all data persistence
 * Uses PostgreSQL API via Express backend
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const USER_ID = 1; // For now, hardcoded. Later use auth system.

class StorageService {
  async loadPortfolio() {
    try {
      const response = await fetch(`${API_URL}/api/portfolio/${USER_ID}`);
      if (!response.ok) {
        throw new Error('Failed to load portfolio');
      }
      const data = await response.json();
      return new Portfolio(data);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      return null;
    }
  }

  async savePortfolio(portfolioData) {
    const query = `${API_URL}/api/portfolio/${USER_ID}`;
    try {
      // Pre-flight check: Ensure the data can be stringified without errors.
      // This catches circular references before they are sent to the server.
      let body;
      try {
        body = JSON.stringify(portfolioData);
        console.log("Sending data to server:", body);
      } catch (e) {
        console.error("Failed to stringify portfolio data. Check for circular references.", portfolioData);
        throw e;
      }

      const response = await fetch(`${API_URL}/api/portfolio/${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async seedInitialData() {
    try {
      const response = await fetch(`${API_URL}/api/seed`);
      if (!response.ok) {
        throw new Error('Failed to seed database');
      }
      console.log('Database seeded successfully.');
      return true;
    } catch (error) {
      console.error('Error seeding initial data:', error);
      // Explicitly return false on failure to prevent infinite loops
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