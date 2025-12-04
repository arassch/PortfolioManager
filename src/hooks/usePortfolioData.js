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
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    const data = await StorageService.loadPortfolio();
    if (data) {
      setPortfolio(new Portfolio(data));
    }
    setIsLoading(false);
  };

  const savePortfolio = async (updatedPortfolio) => {
    try {
      setPortfolio(updatedPortfolio);
      const success = await StorageService.savePortfolio(
        updatedPortfolio.toJSON()
      );
      if (success) {
        setSaveStatus('Saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (error) {
      setSaveStatus('Save failed');
      console.error('Error saving portfolio:', error);
    }
  };

  const exportPortfolio = () => {
    StorageService.exportToJSON(portfolio.toJSON());
  };

  const importPortfolio = async (file) => {
    try {
      const data = await StorageService.importFromJSON(file);
      const newPortfolio = new Portfolio(data);
      await savePortfolio(newPortfolio);
      return true;
    } catch (error) {
      setSaveStatus('Import failed');
      console.error('Error importing portfolio:', error);
      return false;
    }
  };

  return {
    portfolio,
    setPortfolio,
    savePortfolio,
    exportPortfolio,
    importPortfolio,
    saveStatus,
    setSaveStatus,
    isLoading
  };
}