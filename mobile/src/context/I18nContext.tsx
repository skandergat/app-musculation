import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'fr' | 'en' | 'ar';

type Dictionary = {
  [key: string]: string;
};

const translations: Record<Language, Dictionary> = {
  fr: {
    home: 'Accueil',
    chooseWorkout: 'Choisis ton entraînement',
    gym: 'GYM',
    gymDescription: 'Tous les exercices de musculation',
    calisthenics: 'CALISTHÉNIE',
    calisthenicsDescription: 'Exercices au poids du corps et skills',
    exercises: 'exercices',
    back: 'Retour',
    connectionImpossible: 'Connexion impossible',
    retry: 'Réessayer',
    settings: 'Paramètres',
    profile: 'Profil',
    language: 'Langue',
    french: 'Français',
    english: 'English',
    arabic: 'العربية',
    logout: 'Se déconnecter',
    logoutQuestion: 'Voulez-vous vraiment vous déconnecter ?',
    cancel: 'Annuler',
    user: 'Utilisateur',
    session: 'Séance',
    history: 'Historique',
    account: 'Compte',
    noExercises: 'Aucun exercice pour l’instant.',
    exercise: 'exercice',
  },
  en: {
    home: 'Home',
    chooseWorkout: 'Choose your workout',
    gym: 'GYM',
    gymDescription: 'All weight training exercises',
    calisthenics: 'CALISTHENICS',
    calisthenicsDescription: 'Bodyweight exercises and skills',
    exercises: 'exercises',
    back: 'Back',
    connectionImpossible: 'Connection error',
    retry: 'Retry',
    settings: 'Settings',
    profile: 'Profile',
    language: 'Language',
    french: 'Français',
    english: 'English',
    arabic: 'العربية',
    logout: 'Log out',
    logoutQuestion: 'Are you sure you want to log out?',
    cancel: 'Cancel',
    user: 'User',
    session: 'Workout',
    history: 'History',
    account: 'Account',
    noExercises: 'No exercises yet.',
    exercise: 'exercise',
  },
  ar: {
    home: 'الرئيسية',
    chooseWorkout: 'اختر تمرينك',
    gym: 'GYM',
    gymDescription: 'جميع تمارين كمال الأجسام',
    calisthenics: 'كاليستنكس',
    calisthenicsDescription: 'تمارين وزن الجسم والمهارات',
    exercises: 'تمارين',
    back: 'رجوع',
    connectionImpossible: 'تعذر الاتصال',
    retry: 'إعادة المحاولة',
    settings: 'الإعدادات',
    profile: 'الملف الشخصي',
    language: 'اللغة',
    french: 'Français',
    english: 'English',
    arabic: 'العربية',
    logout: 'تسجيل الخروج',
    logoutQuestion: 'هل تريد تسجيل الخروج؟',
    cancel: 'إلغاء',
    user: 'مستخدم',
    session: 'التمرين',
    history: 'السجل',
    account: 'الحساب',
    noExercises: 'لا توجد تمارين بعد.',
    exercise: 'تمرين',
  },
};

const LANGUAGE_KEY = '@app_musculation_language';

type I18nContextType = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((value) => {
      if (value === 'fr' || value === 'en' || value === 'ar') {
        setLanguageState(value);
      }
    });
  }, []);

  const setLanguage = async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
  };

  const t = (key: string) => translations[language][key] ?? translations.fr[key] ?? key;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n doit être utilisé dans I18nProvider');
  }
  return context;
}
