import { useState, useEffect } from 'react';
import { Portfolio } from '../models/Portfolio';
import StorageService from '../services/StorageService';

/**
 * usePortfolioData - Manages portfolio state and persistence
 */
export function usePortfolioData() {
  const [portfolio, setPortfolio] = useState(
    new Portfolio()
  );
  const [saveStatus, setSaveStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load portfolio on mount
  useEffect(() => {
    const initialize = async () => {
      await StorageService.seedInitialData(); // Ensure data exists
      await loadPortfolio(); // Then load it
    };
    initialize();
  }, []);

  const loadPortfolio = async () => {
    setIsLoading(true);
    const data = await StorageService.loadPortfolio();
    if (data) {
      setPortfolio(new Portfolio(data));
    }
    setIsLoading(false);
  };

  const updatePortfolio = (newPortfolioData) => {
    // Always create a new Portfolio instance to preserve methods
    setPortfolio(new Portfolio(newPortfolioData));
  };

  const savePortfolio = async (portfolioToSave = portfolio) => {
    try {
      const payload = portfolioToSave instanceof Portfolio
        ? portfolioToSave.toJSON()
        : portfolioToSave;

      const success = await StorageService.savePortfolio(payload);
      if (success) {
        setSaveStatus('Saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      }
      // After saving, reload to get fresh data (like new account IDs) from the server
      await loadPortfolio();
    } catch (error) {
      setSaveStatus('Save failed');
      console.error('Error saving portfolio:', error);
    }
  };

  const exportPortfolio = () => {
    StorageService.exportToJSON(portfolio.toJSON());
  };

  const importPortfolio = async (eventOrFile) => {
    try {
      const file = eventOrFile?.target ? eventOrFile.target.files?.[0] : eventOrFile;
      if (!file) {
        throw new Error('No file selected');
      }
      const data = await StorageService.importFromJSON(file);
      setPortfolio(new Portfolio(data)); // Set the state, then the user can save.
      return true;
    } catch (error) {
      setSaveStatus('Import failed');
      console.error('Error importing portfolio:', error);
      return false;
    }
  };

  return {
    portfolio,
    updatePortfolio,
    savePortfolio,
    exportPortfolio,
    importPortfolio,
    saveStatus,
    setSaveStatus,
    isLoading
  };
}
