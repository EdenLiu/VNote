import { useEffect, useState } from 'react';
import { localDateKey } from '@shared/urgency';

export function useLocalDay() {
  const [day, setDay] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    let timer: number;
    const sync = () => {
      const now = new Date();
      setDay(localDateKey(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, midnight.getTime() - now.getTime());
    };
    sync();
    window.addEventListener('focus', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', sync);
    };
  }, []);
  return day;
}
