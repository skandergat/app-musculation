import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { API_URL } from '@/config/api';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  useColorScheme,
} from 'react-native';


const SON_FIN_TIMER = require('../../../assets/notification-ding.wav');

const TIMER_SERIE_KEY = '@app_musculation_timer_serie';

type Serie = {
  id: number;
  poids: string;
  reps: string;
  terminee: boolean;
  sauvegardee?: boolean;
  backendId?: number;
};

type PreviousSerie = {
  poids: number;
  repetitions: number;
};

type ExerciceDisponible = {
  nom: string;
  muscle: string;
  backendId: number;
  categorie?: string;
};

type Exercice = {
  id: number;
  nom: string;
  muscle: string;
  backendId?: number;
  series: Serie[];
};

const exercicesInitiaux: Exercice[] = [
  {
    id: 1,
    nom: 'Développé couché',
    muscle: 'Pectoraux',
    series: [
      { id: 1, poids: '40', reps: '12', terminee: false },
      { id: 2, poids: '40', reps: '12', terminee: false },
      { id: 3, poids: '40', reps: '10', terminee: false },
    ],
  },
  {
    id: 2,
    nom: 'Développé incliné haltères',
    muscle: 'Pectoraux',
    series: [
      { id: 1, poids: '30', reps: '12', terminee: false },
      { id: 2, poids: '30', reps: '10', terminee: false },
      { id: 3, poids: '30', reps: '10', terminee: false },
    ],
  },
  {
    id: 3,
    nom: 'Extension poulie corde',
    muscle: 'Triceps',
    series: [
      { id: 1, poids: '20', reps: '12', terminee: false },
      { id: 2, poids: '20', reps: '12', terminee: false },
      { id: 3, poids: '20', reps: '10', terminee: false },
    ],
  },
];

function construireExercicesInitiaux(disponibles: ExerciceDisponible[]): Exercice[] {
  return exercicesInitiaux.map((exercice) => {
    const disponible = disponibles.find(
      (item) => item.nom === exercice.nom && item.categorie === 'gym'
    );

    return {
      ...exercice,
      backendId: disponible?.backendId,
      series: exercice.series.map((serie) => ({
        ...serie,
        terminee: false,
        sauvegardee: false,
        backendId: undefined,
      })),
    };
  });
}

function construireExercicesDepuisSeance(
  disponibles: ExerciceDisponible[],
  series: {
    id: number;
    exercice_id: number;
    exercice_nom: string;
    groupe_musculaire: string | null;
    poids: number | null;
    repetitions: number | null;
  }[]
): Exercice[] {
  const catalogue = construireExercicesInitiaux(disponibles);
  const exercicesParBackendId = new Map<number, Exercice>();

  for (const exercice of catalogue) {
    if (exercice.backendId) {
      exercicesParBackendId.set(exercice.backendId, exercice);
    }
  }

  for (const serie of series) {
    const exerciceExistant = exercicesParBackendId.get(serie.exercice_id);

    const nouvelleSerie: Serie = {
      id: (exerciceExistant?.series.length ?? 0) + 1,
      poids: String(serie.poids ?? 0),
      reps: String(serie.repetitions ?? 0),
      terminee: true,
      sauvegardee: true,
      backendId: serie.id,
    };

    if (exerciceExistant) {
      if (!exerciceExistant.series.some((item) => item.terminee)) {
        exerciceExistant.series = [nouvelleSerie];
      } else {
        exerciceExistant.series.push(nouvelleSerie);
      }
      continue;
    }

    exercicesParBackendId.set(serie.exercice_id, {
      id: Date.now() + serie.exercice_id,
      backendId: serie.exercice_id,
      nom: serie.exercice_nom,
      muscle: serie.groupe_musculaire ?? 'Autres',
      series: [nouvelleSerie],
    });
  }

  return Array.from(exercicesParBackendId.values());
}
export default function SeanceScreen() {
  const { token, user } = useAuth();
  const { t, exerciseName, muscleGroupName } = useI18n();
  const dark = useColorScheme() === 'dark';

  const sonFinTimer = useAudioPlayer(SON_FIN_TIMER);

  const [exercices, setExercices] = useState<Exercice[]>(
    exercicesInitiaux.map((exercice) => ({
      ...exercice,
      series: exercice.series.map((serie) => ({
        ...serie,
      })),
    }))
  );

  const [menuExercices, setMenuExercices] = useState(false);
  const [seanceId, setSeanceId] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [terminee, setTerminee] = useState(false);
  const [terminaisonEnCours, setTerminaisonEnCours] = useState(false);

  const [previous, setPrevious] = useState<
    Record<number, PreviousSerie[]>
  >({});

  const [exercicesDisponibles, setExercicesDisponibles] =
    useState<ExerciceDisponible[]>([]);

  const [tempsReposSerie, setTempsReposSerie] = useState(60);
  const [timerActif, setTimerActif] = useState(false);
  const [tempsRestant, setTempsRestant] = useState(0);
  const [timerType, setTimerType] = useState<'serie' | null>(null);
  const [timerExerciceId, setTimerExerciceId] = useState<number | null>(null);
  const [timerSerieId, setTimerSerieId] = useState<number | null>(null);
  const [minuteursTermines, setMinuteursTermines] = useState<Set<string>>(new Set());
  const timerFinAtRef = useRef<number | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    }).catch((error) => {
      console.error(t('error') + ' :', error);
    });
  }, []);

  useEffect(() => {
    const chargerPreferencesTimer = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const serieSauvegardee = await AsyncStorage.getItem(
          `${TIMER_SERIE_KEY}_${user.id}`
        );

        if (serieSauvegardee) {
          const valeur = parseInt(serieSauvegardee, 10);

          if (Number.isFinite(valeur) && valeur > 0) {
            setTempsReposSerie(valeur);
          }
        }

      } catch (error) {
        console.error(
          'Erreur chargement préférences timer :',
          error
        );
      }
    };

    chargerPreferencesTimer();
  }, [user?.id]);

  useEffect(() => {
    if (!timerActif) {
      return;
    }

    const interval = setInterval(() => {
      const finAt = timerFinAtRef.current;

      if (!finAt) {
        return;
      }

      const restant = Math.max(
        0,
        Math.ceil((finAt - Date.now()) / 1000)
      );

      setTempsRestant(restant);

      if (restant === 0) {
        clearInterval(interval);
        timerFinAtRef.current = null;
        setTimerActif(false);

        const timerTermineKey =
          timerType === 'serie'
            ? 'serie-' + timerExerciceId + '-' + timerSerieId
            : 'exercice-' + timerExerciceId;

        setMinuteursTermines((anciens) => {
          const nouveau = new Set(anciens);
          nouveau.add(timerTermineKey);
          return nouveau;
        });

        setTimerType(null);
        setTimerExerciceId(null);
        setTimerSerieId(null);

        Vibration.vibrate(500);

        try {
          sonFinTimer.seekTo(0);
          sonFinTimer.play();
        } catch (error) {
          console.error('Erreur lecture son timer :', error);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [timerActif, sonFinTimer, timerType, timerExerciceId, timerSerieId]);

  const chargerExercicesDisponibles = async (): Promise<ExerciceDisponible[]> => {
    try {
      const response = await fetch(
        API_URL + '/exercices?categorie=all'
      );

      if (!response.ok) {
        throw new Error(t('connectionImpossible'));
      }

      const data = await response.json();
      const disponibles: ExerciceDisponible[] = data.map((e: any) => ({
        nom: e.nom,
        muscle: e.groupe_musculaire ?? '',
        backendId: e.id,
        categorie: e.categorie,
      }));

      setExercicesDisponibles(disponibles);
      return disponibles;
    } catch (error) {
      console.error('Erreur chargement exercices disponibles :', error);
      throw error;
    }
  };
  const chargerPrevious = async (exercice: Exercice) => {
    try {
      if (!exercice.backendId) {
        return;
      }

      const response = await fetch(
        `${API_URL}/exercices/${exercice.backendId}/previous`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data: PreviousSerie[] = await response.json();
      const backendId = exercice.backendId;

      if (!backendId) {
        return;
      }

      setPrevious((ancien) => ({
        ...ancien,
        [backendId]: data,
      }));
    } catch (error) {
      console.error('Erreur chargement Previous :', error);
    }
  };

  const initialiserSeance = async () => {
    try {
      setChargement(true);

      const disponibles = await chargerExercicesDisponibles();

      const activeResponse = await fetch(
        API_URL + '/seances/active',
        {
          headers: {
            Authorization: 'Bearer ' + token,
          },
        }
      );

      if (!activeResponse.ok) {
        throw new Error(t('connectionImpossible'));
      }

      const activeData = await activeResponse.json();

      if (activeData.seance) {
        const activeSeries = activeData.seance.series ?? [];
        const exercicesRestaures =
          activeSeries.length > 0
            ? construireExercicesDepuisSeance(disponibles, activeSeries)
            : construireExercicesInitiaux(disponibles);

        setExercices(exercicesRestaures);
        setSeanceId(activeData.seance.id);

        await Promise.all(
          exercicesRestaures.map((exercice) => chargerPrevious(exercice))
        );
      } else {
        const response = await fetch(
          API_URL + '/seances',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
          }
        );

        if (!response.ok) {
          throw new Error(t('unableStartNew'));
        }

        const data = await response.json();
        const exercicesNouveaux = construireExercicesInitiaux(disponibles);

        setExercices(exercicesNouveaux);
        setSeanceId(data.seance_id);

        await Promise.all(
          exercicesNouveaux.map((exercice) => chargerPrevious(exercice))
        );
      }

      setTerminee(false);
      setChargement(false);
    } catch (error) {
      console.error(t('error') + ' :', error);
      setChargement(false);
      Alert.alert(
        t('connectionImpossible'),
        t('connectionServerHelp')
      );
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    initialiserSeance();
  }, [token]);
  const ajouterExercice = async (
    nom: string,
    muscle: string,
    backendId: number
  ) => {
    const nouvelExercice: Exercice = {
      id: Date.now(),
      backendId,
      nom,
      muscle,
      series: [
        {
          id: 1,
          poids: '0',
          reps: '10',
          terminee: false,
        },
        {
          id: 2,
          poids: '0',
          reps: '10',
          terminee: false,
        },
        {
          id: 3,
          poids: '0',
          reps: '10',
          terminee: false,
        },
      ],
    };

    setExercices((anciens) => [
      ...anciens,
      nouvelExercice,
    ]);

    setMenuExercices(false);

    await chargerPrevious(nouvelExercice);
  };

  const ajouterSerie = (exerciceId: number) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        const derniereSerie =
          exercice.series[exercice.series.length - 1];

        const nouvelleSerie: Serie = {
          id:
            exercice.series.reduce(
              (maximum, serie) => Math.max(maximum, serie.id),
              0
            ) + 1,
          poids: derniereSerie?.poids || '0',
          reps: derniereSerie?.reps || '10',
          terminee: false,
        };

        return {
          ...exercice,
          series: [
            ...exercice.series,
            nouvelleSerie,
          ],
        };
      })
    );
  };

  const supprimerSerie = (
    exerciceId: number,
    serieId: number
  ) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        if (exercice.series.length <= 1) {
          Alert.alert(
            t('error'),
            t('mustKeepOneSet')
          );

          return exercice;
        }

        const nouvellesSeries = exercice.series.filter(
          (serie) => serie.id !== serieId
        );

        return {
          ...exercice,
          series: nouvellesSeries,
        };
      })
    );
  };

  const modifierPoids = (
    exerciceId: number,
    serieId: number,
    poids: string
  ) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        return {
          ...exercice,
          series: exercice.series.map((serie) =>
            serie.id === serieId
              ? {
                  ...serie,
                  poids,
                  sauvegardee: false,
                }
              : serie
          ),
        };
      })
    );
  };

  const modifierReps = (
    exerciceId: number,
    serieId: number,
    reps: string
  ) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        return {
          ...exercice,
          series: exercice.series.map((serie) =>
            serie.id === serieId
              ? {
                  ...serie,
                  reps,
                  sauvegardee: false,
                }
              : serie
          ),
        };
      })
    );
  };

  const sauvegarderSerie = async (
    exercice: Exercice,
    serie: Serie
  ): Promise<number | null> => {
    if (!seanceId) {
      Alert.alert(t('error'), t('noActiveWorkout'));
      return null;
    }

    if (!exercice.backendId) {
      Alert.alert(t('exerciseNotFound'), t('exerciseNotFound'));
      return null;
    }

    const poids = Number.parseFloat(serie.poids.replace(',', '.'));
    const repetitions = Number.parseInt(serie.reps, 10);

    if (!Number.isFinite(poids) || poids < 0) {
      Alert.alert(t('weight'), t('invalidWeight'));
      return null;
    }

    if (!Number.isInteger(repetitions) || repetitions < 1) {
      Alert.alert(t('reps'), t('invalidReps'));
      return null;
    }

    try {
      const response = await fetch(
        API_URL + '/seances/' + seanceId + '/series',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            exercice_id: exercice.backendId,
            poids,
            repetitions,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t('cannotSaveSet'));
      }

      return typeof data.series_id === 'number'
        ? data.series_id
        : null;
    } catch (error: any) {
      console.error('Erreur sauvegarde série :', error);
      Alert.alert(
        t('error'),
        error?.message || t('cannotSaveSet')
      );
      return null;
    }
  };
  const modifierTempsReposSerie = (delta: number) => {
    const base =
      timerActif && timerType === 'serie'
        ? tempsRestant
        : tempsReposSerie;

    const nouveauTemps = Math.max(15, base + delta);

    setTempsRestant(nouveauTemps);
    setTempsReposSerie(nouveauTemps);

    if (timerActif && timerType === 'serie') {
      timerFinAtRef.current = Date.now() + nouveauTemps * 1000;
    }

    if (user?.id) {
      AsyncStorage.setItem(
        `${TIMER_SERIE_KEY}_${user.id}`,
        String(nouveauTemps)
      ).catch((error) =>
        console.error(
          'Erreur sauvegarde timer série :',
          error
        )
      );
    }
  };

  const afficherTemps = (exerciceId: number, serieId: number) => {
    if (
      timerActif &&
      timerType === 'serie' &&
      timerExerciceId === exerciceId &&
      timerSerieId === serieId
    ) {
      return tempsRestant;
    }

    const timerTermineKey = 'serie-' + exerciceId + '-' + serieId;

    if (minuteursTermines.has(timerTermineKey)) {
      return 0;
    }

    return tempsReposSerie;
  };

  const terminerSerie = async (
    exerciceId: number,
    serieId: number
  ) => {
    const exercice = exercices.find(
      (item) => item.id === exerciceId
    );

    if (!exercice) {
      return;
    }

    const serie = exercice.series.find(
      (item) => item.id === serieId
    );

    if (!serie) {
      return;
    }

    if (serie.terminee) {
      if (!serie.backendId || !seanceId) {
        return;
      }

      if (
        timerActif &&
        timerType === 'serie' &&
        timerExerciceId === exerciceId &&
        timerSerieId === serieId
      ) {
        timerFinAtRef.current = null;
        setTimerActif(false);
        setTempsRestant(0);
        setTimerType(null);
        setTimerExerciceId(null);
        setTimerSerieId(null);
      }

      try {
        const response = await fetch(
          API_URL + '/seances/' + seanceId + '/series/' + serie.backendId,
          {
            method: 'DELETE',
            headers: {
              Authorization: 'Bearer ' + token,
            },
          }
        );

        if (!response.ok) {
          throw new Error(t('cannotDeleteSet'));
        }

        setExercices((anciens) =>
          anciens.map((item) =>
            item.id !== exerciceId
              ? item
              : {
                  ...item,
                  series: item.series.map((s) =>
                    s.id === serieId
                      ? {
                          ...s,
                          terminee: false,
                          sauvegardee: false,
                          backendId: undefined,
                        }
                      : s
                  ),
                }
          )
        );
      } catch (error) {
        console.error('Erreur suppression série :', error);
        Alert.alert(t('error'), t('cannotDeleteSet'));
      }

      return;
    }

    const seriesBackendId = await sauvegarderSerie(
      exercice,
      serie
    );

    if (seriesBackendId === null) {
      return;
    }

    setExercices((anciens) =>
      anciens.map((item) => {
        if (item.id !== exerciceId) {
          return item;
        }

        return {
          ...item,
          series: item.series.map((s) =>
            s.id === serieId
              ? {
                  ...s,
                  terminee: true,
                  sauvegardee: true,
                  backendId: seriesBackendId,
                }
              : s
          ),
        };
      })
    );

    setMinuteursTermines((anciens) => {
      const nouveau = new Set(anciens);
      nouveau.delete('serie-' + exerciceId + '-' + serieId);
      return nouveau;
    });

    setTempsRestant(tempsReposSerie);
    timerFinAtRef.current = Date.now() + tempsReposSerie * 1000;
    setTimerType('serie');
    setTimerExerciceId(exerciceId);
    setTimerSerieId(serieId);
    setTimerActif(true);
  };

  const exercicesParGroupe = exercicesDisponibles.reduce<Record<string, { nom: string; muscle: string; backendId: number }[]>>(
    (groupes, exercice) => {
      const groupe = exercice.muscle || 'Autres';
      if (!groupes[groupe]) {
        groupes[groupe] = [];
      }
      groupes[groupe].push(exercice);
      return groupes;
    },
    {}
  );

  const terminerSeance = async () => {
    if (terminaisonEnCours) {
      return;
    }

    if (!seanceId) {
      Alert.alert(
        t('error'),
        t('noActiveWorkout')
      );

      return;
    }

    try {
      setTerminaisonEnCours(true);

      const ancienneSeanceId = seanceId;

      const response = await fetch(
        `${API_URL}/seances/${ancienneSeanceId}/terminer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          t('unableFinishWorkout')
        );
      }

      console.log(
        'Séance terminée :',
        ancienneSeanceId
      );

      setTimerActif(false);
      timerFinAtRef.current = null;
      setTempsRestant(0);
      setTimerType(null);
      setTimerExerciceId(null);
      setTimerSerieId(null);
      setMinuteursTermines(new Set());

      setSeanceId(null);
      setTerminee(true);
      setMenuExercices(false);
      setChargement(true);

      const nouvelleSeanceResponse =
        await fetch(`${API_URL}/seances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

      if (!nouvelleSeanceResponse.ok) {
        throw new Error(
          t('unableStartNew')
        );
      }

      const nouvelleSeance =
        await nouvelleSeanceResponse.json();

      const exercicesReset =
        construireExercicesInitiaux(exercicesDisponibles);

      setExercices(exercicesReset);
      setSeanceId(nouvelleSeance.seance_id);

      await Promise.all(
        exercicesReset.map((exercice) =>
          chargerPrevious(exercice)
        )
      );

      setTerminee(false);
      setChargement(false);

      console.log(
        'Nouvelle séance créée avec ID :',
        nouvelleSeance.seance_id
      );

      Alert.alert(
        t('workoutFinished'),
        t('workoutSavedNewReady')
      );
    } catch (error) {
      console.error(
        t('error') + ' :',
        error
      );

      setChargement(false);

      Alert.alert(
        t('error'),
        t('unableFinishWorkout')
      );
    } finally {
      setTerminaisonEnCours(false);
    }
  };

  if (chargement) {
    return (
      <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

        <View style={styles.chargement}>
          <Text style={[styles.chargementTexte, dark && styles.mutedDark]}>
            {t('startup')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      <ScrollView
        contentContainerStyle={styles.contenu}
      >
        <Text style={[styles.titre, dark && styles.textDark]}>
          {t('workout')}
        </Text>

        <Text style={[styles.sousTitre, dark && styles.mutedDark]}>
          {t('todaysWorkout')}
        </Text>

        {exercices.map((exercice) => (
          <View
            key={exercice.id}
            style={styles.exerciceBloc}
          >
            <View
              style={[styles.exerciceCarte, dark && styles.cardDark]}
            >
              <Text style={[styles.exercice, dark && styles.textDark]}>
                {exerciseName(exercice.nom)}
              </Text>

              <Text style={[styles.muscle, dark && styles.mutedDark]}>
                {muscleGroupName(exercice.muscle)}
              </Text>
            </View>

            <View style={styles.headerSeries}>
              <Text style={[styles.headerTexte, dark && styles.mutedDark]}>
                {t('set')}
              </Text>

              <Text
                style={[styles.headerPrevious, dark && styles.mutedDark]}
              >
                {t('previous')}
              </Text>

              <Text style={[styles.headerTexte, dark && styles.mutedDark]}>
                {t('weight')}
              </Text>

              <Text style={[styles.headerTexte, dark && styles.mutedDark]}>
                {t('reps')}
              </Text>

              <Text style={[styles.headerTexte, dark && styles.mutedDark]}>
                ✓
              </Text>
            </View>

            {exercice.series.map((serie, serieIndex) => (
              <View key={serie.id}>
                <View
                  style={[
                    styles.serie,
                    dark && styles.cardDark,
                    serie.terminee && styles.serieTerminee,
                  ]}
                >
                  <Text style={[styles.numero, dark && styles.textDark]}>
                    {serieIndex + 1}
                  </Text>

                  <Text style={[styles.previous, dark && styles.mutedDark]}>
                    {exercice.backendId && previous[exercice.backendId]?.[serieIndex]
                      ? `${previous[exercice.backendId][serieIndex].poids} kg × ${previous[exercice.backendId][serieIndex].repetitions}`
                      : '—'}
                  </Text>

                  <TextInput
                    style={[styles.input, dark && styles.inputDark]}
                    value={serie.poids}
                    keyboardType="decimal-pad"
                    editable={!terminee && !serie.terminee}
                    onChangeText={(texte) =>
                      modifierPoids(
                        exercice.id,
                        serie.id,
                        texte
                      )
                    }
                  />

                  <TextInput
                    style={[styles.input, dark && styles.inputDark]}
                    value={serie.reps}
                    keyboardType="number-pad"
                    editable={!terminee}
                    onChangeText={(texte) =>
                      modifierReps(
                        exercice.id,
                        serie.id,
                        texte
                      )
                    }
                  />

                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      serie.terminee &&
                        styles.checkboxActive,
                    ]}
                    disabled={terminee}
                    onPress={() =>
                      terminerSerie(
                        exercice.id,
                        serie.id
                      )
                    }
                  >
                    {serie.terminee && (
                      <Text style={styles.check}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!serie.terminee && (
                    <TouchableOpacity
                      style={styles.supprimerSerie}
                      disabled={terminee}
                      onPress={() =>
                        Alert.alert(
                          t('deleteSet'),
                          t('deleteSetQuestion'),
                          [
                            {
                              text: t('cancel'),
                              style: 'cancel',
                            },
                            {
                              text: t('delete'),
                              style: 'destructive',
                              onPress: () =>
                                supprimerSerie(
                                  exercice.id,
                                  serie.id
                                ),
                            },
                          ]
                        )
                      }
                    >
                      <Text style={styles.supprimerSerieTexte}>
                        ×
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.timerCompact}>
                  <TouchableOpacity
                    style={styles.timerBouton}
                    onPress={() => modifierTempsReposSerie(-15)}
                  >
                    <Text style={styles.timerBoutonTexte}>
                      −15s
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.timerValeurBloc}>
                    <Text style={styles.timerCompactTitre}>
                      {t('rest')}
                    </Text>
                    <Text style={styles.timerCompactValeur}>
                      {Math.floor(
                        afficherTemps(exercice.id, serie.id) / 60
                      )
                        .toString()
                        .padStart(2, '0')}
                      :
                      {(afficherTemps(exercice.id, serie.id) % 60)
                        .toString()
                        .padStart(2, '0')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.timerBouton}
                    onPress={() => modifierTempsReposSerie(15)}
                  >
                    <Text style={styles.timerBoutonTexte}>
                      +15s
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.boutonAjouterSerie, dark && styles.cardDark]}
              disabled={terminee}
              onPress={() =>
                ajouterSerie(
                  exercice.id
                )
              }
            >
              <Text style={[styles.boutonAjouterTexte, dark && styles.textDark]}>
                + {t('addSet')}
              </Text>
            </TouchableOpacity>


          

          </View>
        ))}



        <TouchableOpacity
          style={[styles.boutonAjouterExercice, dark && styles.cardDark, dark && styles.boutonAjouterExerciceDark]}
          disabled={terminee}
          onPress={() =>
            setMenuExercices(
              !menuExercices
            )
          }
        >
          <Text style={[styles.boutonAjouterExerciceTexte, dark && styles.textDark]}>
            ＋ {t('addExercise').toUpperCase()}
          </Text>
        </TouchableOpacity>

        {menuExercices && !terminee && (
          <View style={[styles.menu, dark && styles.cardDark]}>
            <Text style={[styles.menuTitre, dark && styles.textDark]}>
              {t('chooseExercise')}
            </Text>

            <ScrollView
              style={styles.exercicesScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
              indicatorStyle={dark ? 'white' : 'black'}
            >
              {Object.entries(exercicesParGroupe).map(
                ([groupe, exercicesDuGroupe]) => (
                  <View key={groupe} style={styles.groupeExercices}>
                    <Text style={[styles.groupeTitre, dark && styles.textDark]}>
                      {muscleGroupName(groupe)}
                    </Text>

                    {exercicesDuGroupe.map((exercice) => (
                      <TouchableOpacity
                        key={`${exercice.backendId}-${exercice.nom}`}
                        style={[styles.optionExercice, dark && styles.optionExerciceDark]}
                        onPress={() =>
                          ajouterExercice(
                            exercice.nom,
                            exercice.muscle,
                            exercice.backendId
                          )
                        }
                      >
                        <View style={styles.optionTexte}>
                          <Text style={[styles.optionNom, dark && styles.textDark]}>
                            {exerciseName(exercice.nom)}
                          </Text>

                          <Text style={[styles.optionMuscle, dark && styles.mutedDark]}>
                            {muscleGroupName(exercice.muscle)}
                          </Text>
                        </View>

                        <Text style={styles.plus}>＋</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.boutonTerminer,
            terminaisonEnCours &&
              styles.boutonTerminerDesactive,
          ]}
          disabled={terminaisonEnCours}
          onPress={terminerSeance}
        >
          <Text
            style={
              styles.boutonTerminerTexte
            }
          >
            {terminaisonEnCours
              ? t('saving').toUpperCase()
              : t('finishWorkout').toUpperCase()}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  containerDark: { backgroundColor: '#0B0B0D' },
  cardDark: { backgroundColor: '#1C1C1E' },
  inputDark: { backgroundColor: '#2C2C2E', color: '#FFFFFF' },
  boutonAjouterExerciceDark: { borderColor: '#38383A' },
  optionExerciceDark: { borderTopColor: '#38383A' },
  textDark: { color: '#FFFFFF' },
  mutedDark: { color: '#A1A1A6' },

  contenu: {
    padding: 20,
    paddingBottom: 50,
  },

  chargement: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chargementTexte: {
    fontSize: 16,
    color: '#8A8A8E',
  },

  titre: {
    fontSize: 30,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },

  sousTitre: {
    fontSize: 15,
    color: '#8A8A8E',
    marginBottom: 24,
  },

  exerciceBloc: {
    marginBottom: 28,
  },

  exerciceCarte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },

  exercice: {
    fontSize: 21,
    fontWeight: '700',
    color: '#000000',
  },

  muscle: {
    fontSize: 14,
    color: '#8A8A8E',
    marginTop: 5,
  },

  headerSeries: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },

  headerTexte: {
    width: 50,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8E',
  },

  headerPrevious: {
    width: 90,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8E',
  },

  previous: {
    width: 90,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8E',
  },

  serie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 8,
  },

  serieTerminee: {
    opacity: 0.6,
  },

  numero: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  input: {
    width: 60,
    height: 42,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    padding: 0,
  },

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },

  check: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  supprimerSerie: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  supprimerSerieTexte: {
    color: '#FF3B30',
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 27,
  },

  timerCompact: {
    width: '100%',
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 9,
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 10,
  },

  timerBouton: {
    width: 72,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timerBoutonTexte: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '700',
  },

  timerValeurBloc: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  timerCompactTitre: {
    color: '#AEAEB2',
    fontSize: 11,
    fontWeight: '600',
  },

  timerCompactValeur: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  boutonAjouterSerie: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },

  boutonAjouterTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },

  boutonAjouterExercice: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },

  boutonAjouterExerciceTexte: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A84FF',
  },

  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 12,
    padding: 10,
  },

  menuTitre: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    padding: 12,
    marginBottom: 4,
  },

  exercicesScroll: {
    maxHeight: 520,
  },

  groupeExercices: {
    marginBottom: 8,
  },

  groupeTitre: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8A8A8E',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    textTransform: 'uppercase',
  },

  optionTexte: {
    flex: 1,
    paddingRight: 12,
  },

  optionExercice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },

  optionNom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  optionMuscle: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 3,
  },

  plus: {
    fontSize: 24,
    color: '#0A84FF',
  },

  boutonTerminer: {
    backgroundColor: '#0A84FF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 30,
  },

  boutonTerminerDesactive: {
    opacity: 0.6,
  },

  boutonTerminerTexte: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});