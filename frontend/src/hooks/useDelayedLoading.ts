import { useState, useEffect } from 'react';

/**
 * Хук для задержки показа состояния загрузки
 * Показывает loading только если операция длится дольше указанного времени
 */
export const useDelayedLoading = (isLoading: boolean, delay: number = 300) => {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      timeoutId = setTimeout(() => {
        setShowLoading(true);
      }, delay);
    } else {
      setShowLoading(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, delay]);

  return showLoading;
};
