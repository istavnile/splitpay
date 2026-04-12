import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext(null);

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('sp_idioma') || 'es');

  const changeLang = useCallback((newLang) => {
    setLang(newLang);
    localStorage.setItem('sp_idioma', newLang);
  }, []);

  const t = useCallback((key) => {
    const val = getNestedValue(translations[lang], key);
    return val ?? getNestedValue(translations['es'], key) ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
