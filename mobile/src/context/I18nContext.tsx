import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';

export type Language = 'fr' | 'en' | 'ar' | 'de';

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
    login: 'Connexion',
    loginSubtitle: 'Connecte-toi à ton compte pour retrouver tes séances.',
    email: 'Email',
    password: 'Mot de passe',
    loginButton: 'Se connecter',
    noAccount: 'Pas encore de compte ?',
    createAccount: 'Créer un compte',
    registerSubtitle: 'Crée ton compte pour sauvegarder tes séances et ton historique.',
    name: 'Nom',
    confirmPassword: 'Confirmer le mot de passe',
    createAccountButton: 'Créer mon compte',
    hasAccount: 'Tu as déjà un compte ?',
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
    login: 'Log in',
    loginSubtitle: 'Log in to your account to access your workouts.',
    email: 'Email',
    password: 'Password',
    loginButton: 'Log in',
    noAccount: 'Don’t have an account yet?',
    createAccount: 'Create an account',
    registerSubtitle: 'Create your account to save your workouts and history.',
    name: 'Name',
    confirmPassword: 'Confirm password',
    createAccountButton: 'Create my account',
    hasAccount: 'Already have an account?',
    darkMode: 'Dark mode', darkModeDescription: 'Use a dark interface', on: 'On', off: 'Off',
    missingFields: 'Missing information', fillAllFields: 'Please fill in all fields.', passwordTitle: 'Password', passwordMin: 'Your password must contain at least 8 characters.', passwordsMismatch: 'The two passwords do not match.', creationImpossible: 'Unable to create account', unexpectedError: 'Something went wrong.',
    workout: 'Workout', todaysWorkout: 'Today’s workout', set: 'Set', previous: 'Précédent', weight: 'Weight', reps: 'Répétitions', rest: 'Rest', addSet: 'Add a set', addExercise: 'Add an exercise', chooseExercise: 'Choose an exercise', finishWorkout: 'Finish workout', saving: 'Saving…', deleteSet: 'Delete set', deleteSetQuestion: 'Do you want to delete this set?', delete: 'Delete', error: 'Error', noActiveWorkout: 'No active workout.', unableFinishWorkout: 'Unable to finish the workout.', workoutFinished: 'Workout finished', workoutSavedNewReady: 'The workout has been saved. A new workout is ready.', startup: 'Starting workout…', exerciseNotFound: 'Exercise not found.', cannotSaveSet: 'Unable to save the set.', unableStartNew: 'Unable to start the new workout.', connectionServerHelp: 'Check that the Flask server is running and that the server address is correct.', sessionDetails: 'Workout details', noCompletedWorkouts: 'No completed workouts yet.', durationMinutes: 'min', exercisesLabel: 'Exercises', setsLabel: 'Sets', endOfWorkout: 'End of workout', seeDetails: 'View details', other: 'other', others: 'others', exerciseCount: 'exercise', exercisesCount: 'exercises', setCount: 'set', setsCount: 'sets',
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
    login: 'تسجيل الدخول',
    loginSubtitle: 'سجّل الدخول إلى حسابك للوصول إلى تمارينك.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    loginButton: 'تسجيل الدخول',
    noAccount: 'ليس لديك حساب بعد؟',
    createAccount: 'إنشاء حساب',
    registerSubtitle: 'أنشئ حسابك لحفظ تمارينك وسجلك.',
    name: 'الاسم',
    confirmPassword: 'تأكيد كلمة المرور',
    createAccountButton: 'إنشاء حسابي',
    hasAccount: 'لديك حساب بالفعل؟',
    darkMode: 'الوضع الداكن', darkModeDescription: 'استخدام واجهة داكنة', on: 'مفعّل', off: 'متوقف',
    missingFields: 'حقول مطلوبة', fillAllFields: 'يرجى ملء جميع الحقول.', passwordTitle: 'كلمة المرور', passwordMin: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.', passwordsMismatch: 'كلمتا المرور غير متطابقتين.', creationImpossible: 'تعذر إنشاء الحساب', unexpectedError: 'حدث خطأ غير متوقع.',
    workout: 'التمرين', todaysWorkout: 'تمرين اليوم', set: 'المجموعة', previous: 'السابق', weight: 'الوزن', reps: 'التكرارات', rest: 'الراحة', addSet: 'إضافة مجموعة', addExercise: 'إضافة تمرين', chooseExercise: 'اختر تمرينًا', finishWorkout: 'إنهاء التمرين', saving: 'جارٍ الحفظ…', deleteSet: 'حذف المجموعة', deleteSetQuestion: 'هل تريد حذف هذه المجموعة؟', delete: 'حذف', error: 'خطأ', noActiveWorkout: 'لا يوجد تمرين نشط.', unableFinishWorkout: 'تعذر إنهاء التمرين.', workoutFinished: 'اكتمل التمرين', workoutSavedNewReady: 'تم حفظ التمرين. تمرين جديد جاهز.', startup: 'جارٍ بدء التمرين…', exerciseNotFound: 'تعذر العثور على التمرين.', cannotSaveSet: 'تعذر حفظ المجموعة.', unableStartNew: 'تعذر بدء التمرين الجديد.', connectionServerHelp: 'تحقق من تشغيل خادم Flask ومن صحة عنوان الخادم.', sessionDetails: 'تفاصيل التمرين', noCompletedWorkouts: 'لا توجد تمارين مكتملة حتى الآن.', durationMinutes: 'د', exercisesLabel: 'تمارين', setsLabel: 'مجموعات', endOfWorkout: 'نهاية التمرين', seeDetails: 'عرض التفاصيل', other: 'آخر', others: 'أخرى', exerciseCount: 'تمرين', exercisesCount: 'تمارين', setCount: 'مجموعة', setsCount: 'مجموعات',
  },
  de: {
    home: 'Startseite', chooseWorkout: 'Wähle dein Training', gym: 'GYM', gymDescription: 'Alle Krafttrainingsübungen',
    calisthenics: 'CALISTHENICS', calisthenicsDescription: 'Körpergewichtsübungen und Skills', exercises: 'Übungen', back: 'Zurück',
    connectionImpossible: 'Verbindung nicht möglich', retry: 'Erneut versuchen', settings: 'Einstellungen', profile: 'Profil',
    language: 'Sprache', french: 'Français', english: 'English', arabic: 'العربية', german: 'Deutsch', logout: 'Abmelden',
    logoutQuestion: 'Möchtest du dich wirklich abmelden?', cancel: 'Abbrechen', user: 'Benutzer', session: 'Training', history: 'Verlauf',
    account: 'Konto', noExercises: 'Noch keine Übungen vorhanden.', exercise: 'Übung', login: 'Anmelden',
    loginSubtitle: 'Melde dich an, um deine Trainings und deinen Verlauf zu sehen.', email: 'E-Mail-Adresse', password: 'Passwort',
    loginButton: 'Anmelden', noAccount: 'Noch kein Konto?', createAccount: 'Konto erstellen',
    registerSubtitle: 'Erstelle ein Konto, um deine Trainings und deinen Verlauf zu speichern.', name: 'Name',
    confirmPassword: 'Passwort bestätigen', createAccountButton: 'Mein Konto erstellen', hasAccount: 'Du hast bereits ein Konto?',
    missingFields: 'Fehlende Angaben', fillAllFields: 'Bitte fülle alle Felder aus.', passwordTitle: 'Passwort',
    passwordMin: 'Das Passwort muss mindestens 8 Zeichen enthalten.', passwordsMismatch: 'Die beiden Passwörter stimmen nicht überein.',
    creationImpossible: 'Konto konnte nicht erstellt werden', unexpectedError: 'Ein unerwarteter Fehler ist aufgetreten.',
    workout: 'Training', todaysWorkout: 'Heutiges Training', set: 'Satz', previous: 'Letztes Mal', weight: 'Gewicht', reps: 'Wdh.',
    rest: 'Pause', addSet: 'Satz hinzufügen', addExercise: 'Übung hinzufügen', chooseExercise: 'Übung auswählen',
    finishWorkout: 'Training beenden', saving: 'Wird gespeichert…', deleteSet: 'Satz löschen',
    deleteSetQuestion: 'Möchtest du diesen Satz löschen?', delete: 'Löschen', error: 'Fehler', noActiveWorkout: 'Kein aktives Training.',
    unableFinishWorkout: 'Das Training konnte nicht beendet werden.', workoutFinished: 'Training beendet',
    workoutSavedNewReady: 'Das Training wurde gespeichert. Ein neues Training ist bereit.', startup: 'Training wird gestartet…',
    exerciseNotFound: 'Übung nicht gefunden.', cannotSaveSet: 'Der Satz konnte nicht gespeichert werden.',
    unableStartNew: 'Das neue Training konnte nicht gestartet werden.',
    connectionServerHelp: 'Prüfe, ob der Flask-Server läuft und die Serveradresse korrekt ist.',
    sessionDetails: 'Trainingsdetails', noCompletedWorkouts: 'Noch keine abgeschlossenen Trainings.', durationMinutes: 'Min.',
    exercisesLabel: 'Übungen', setsLabel: 'Sätze', endOfWorkout: 'Ende des Trainings', seeDetails: 'Details anzeigen',
    other: 'weitere', others: 'weitere', exerciseCount: 'Übung', exercisesCount: 'Übungen', setCount: 'Satz', setsCount: 'Sätze',
    darkMode: 'Dunkelmodus', darkModeDescription: 'Dunkles Erscheinungsbild verwenden', on: 'Ein', off: 'Aus',
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
      if (value === 'fr' || value === 'en' || value === 'ar' || value === 'de') {
        setLanguageState(value);
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(value === 'ar');
      }
    });
  }, []);

  const setLanguage = async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(next === 'ar');
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
