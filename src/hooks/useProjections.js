import { useMemo } from 'react';
import ProjectionController from '../controllers/ProjectionController';

/**
 * useProjections - Memoized projection calculations
 */
export function useProjections(portfolio, selectedAccounts, showIndividualAccounts) {
  return useMemo(() => {
    return ProjectionController.calculateProjections(
      portfolio,
      selectedAccounts,
      showIndividualAccounts
    );
  }, [portfolio, selectedAccounts, showIndividualAccounts]);
}