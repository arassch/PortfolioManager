import { useState, useEffect } from 'react';
import { Portfolio } from '../models/Portfolio';
import StorageService from '../services/StorageService';

/**
 * usePortfolioData - Manages portfolio state and persistence
 */
export function usePortfolioData(isAuthenticated) {
  const [portfolio, setPortfolio] = useState(
    new Portfolio()
  );
  const [saveStatus, setSaveStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load portfolio on mount
  useEffect(() => {
    const initialize = async () => {
      await loadPortfolio(); // Then load it
    };
    if (isAuthenticated) {
      initialize();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadPortfolio = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const prevActiveId = portfolio?.activeProjectionId;
    const prevProjectionCount = portfolio?.projections?.length || 0;
    const data = await StorageService.loadPortfolio();
    if (data) {
      setPortfolio(prev => {
        const raw = data instanceof Portfolio ? data.toJSON() : data;
        const nextActive =
          (prevActiveId && raw.projections?.some(p => String(p.id) === String(prevActiveId)))
            ? prevActiveId
            : raw.activeProjectionId ||
              (raw.projections && raw.projections.length > prevProjectionCount
                ? raw.projections[raw.projections.length - 1]?.id
                : raw.projections?.[0]?.id);
        return new Portfolio({
          ...raw,
          activeProjectionId: nextActive
        });
      });
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
      const imported = new Portfolio(data);
      setPortfolio(imported);
      await savePortfolio(imported);
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
