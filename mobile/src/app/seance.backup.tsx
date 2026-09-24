import { useEffect, useState } from 'react';
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
} from 'react-native';

const API_URL = 'http://192.168.100.200:5000';

type Serie = {
  id: number;
  poids: string;
  reps: string;
  terminee: boolean;
  sauvegardee?: boolean;
};

type PreviousSerie = {
  poids: number;
  repetitions: number;
};

type Exercice = {
  id: number;
  nom: string;
  muscle: string;
  backendId?: number;
  series: Serie[];
};

export default function SeanceScreen() {
  const [exercices, setExercices] = useState<Exercice[]>([
    {
      id: 1,
      backendId: 1,
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
      backendId: 2,
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
      backendId: 15,
      nom: 'Extensions triceps poulie',
      muscle: 'Triceps',
      series: [
        { id: 1, poids: '20', reps: '12', terminee: false },
        { id: 2, poids: '20', reps: '12', terminee: false },
        { id: 3, poids: '20', reps: '10', terminee: false },
      ],
    },
  ]);

  const [menuExercices, setMenuExercices] = useState(false);
  const [seanceId, setSeanceId] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [terminee, setTerminee] = useState(false);
  const [previous, setPrevious] = useState<Record<string, PreviousSerie[]>>({});
  const [exercicesDisponibles, setExercicesDisponibles] = useState<
    { nom: string; muscle: string; backendId: number }[]
  >([]);

  useEffect(() => {
    demarrerSeance();
    chargerExercicesDisponibles();

    exercices.forEach((exercice) => {
      chargerPrevious(exercice);
    });
  }, []);

  const chargerExercicesDisponibles = async () => {
    try {
      const response = await fetch(`${API_URL}/exercices`);

      if (!response.ok) {
        throw new Error(
          'Impossible de récupérer les exercices'
        );
      }

      const data = await response.json();

      setExercicesDisponibles(
        data.map((e: any) => ({
          nom: e.nom,
          muscle: e.groupe_musculaire ?? '',
          backendId: e.id,
        }))
      );
    } catch (error) {
      console.error(
        'Erreur chargement exercices disponibles :',
        error
      );
    }
  };

  const chargerPrevious = async (exercice: Exercice) => {
    try {
      if (!exercice.backendId) {
        return;
      }

      const response = await fetch(
        `${API_URL}/exercices/${exercice.backendId}/previous`
      );

      if (!response.ok) {
        return;
      }

      const data: PreviousSerie[] =
        await response.json();

      setPrevious((ancien) => ({
        ...ancien,
        [exercice.nom]: data,
      }));
    } catch (error) {
      console.error(
        'Erreur chargement Previous :',
        error
      );
    }
  };
  const demarrerSeance = async () => {
    try {
      const response = await fetch(`${API_URL}/seances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Impossible de démarrer la séance');
      }

      const data = await response.json();

      setSeanceId(data.seance_id);
      setChargement(false);

      console.log(
        'Séance créée avec ID :',
        data.seance_id
      );
    } catch (error) {
      console.error(
        'Erreur démarrage séance :',
        error
      );

      setChargement(false);

      Alert.alert(
        'Erreur',
        'Impossible de contacter le serveur Flask.'
      );
    }
  };

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

    setExercices([
      ...exercices,
      nouvelExercice,
    ]);

    setMenuExercices(false);

    await chargerPrevious(nouvelExercice);
  };

  const ajouterSerie = (exerciceId: number) => {
    setExercices(
      exercices.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        const derniereSerie =
          exercice.series[
            exercice.series.length - 1
          ];

        const nouvelleSerie: Serie = {
          id: exercice.series.length + 1,
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

  const modifierPoids = (
    exerciceId: number,
    serieId: number,
    poids: string
  ) => {
    setExercices(
      exercices.map((exercice) => {
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
    setExercices(
      exercices.map((exercice) => {
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
  ) => {
    if (!seanceId) {
      Alert.alert(
        'Erreur',
        'La séance n’a pas encore été créée.'
      );
      return false;
    }

    try {
      const exercicesResponse = await fetch(
        `${API_URL}/exercices`
      );

      if (!exercicesResponse.ok) {
        throw new Error(
          'Impossible de récupérer les exercices'
        );
      }

      const exercicesBackend =
        await exercicesResponse.json();

      const exerciceBackend =
        exercicesBackend.find(
          (item: any) =>
            item.nom === exercice.nom
        );

      if (!exerciceBackend) {
        Alert.alert(
          'Exercice introuvable',
          `${exercice.nom} n'existe pas encore dans la base Flask.`
        );

        return false;
      }

      const response = await fetch(
        `${API_URL}/seances/${seanceId}/series`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exercice_id: exerciceBackend.id,
            poids: parseFloat(serie.poids) || 0,
            repetitions:
              parseInt(serie.reps, 10) || 0,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          'Impossible de sauvegarder la série'
        );
      }

      console.log(
        'Série sauvegardée :',
        exercice.nom,
        serie.poids,
        serie.reps
      );

      return true;
    } catch (error) {
      console.error(
        'Erreur sauvegarde série :',
        error
      );

      Alert.alert(
        'Erreur',
        'La série n’a pas pu être sauvegardée.'
      );

      return false;
    }
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
      setExercices(
        exercices.map((item) => {
          if (item.id !== exerciceId) {
            return item;
          }

          return {
            ...item,
            series: item.series.map((s) =>
              s.id === serieId
                ? {
                    ...s,
                    terminee: false,
                  }
                : s
            ),
          };
        })
      );

      return;
    }

    const sauvegardeReussie =
      await sauvegarderSerie(
        exercice,
        serie
      );

    if (!sauvegardeReussie) {
      return;
    }

    setExercices(
      exercices.map((item) => {
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
                }
              : s
          ),
        };
      })
    );
  };

  const terminerSeance = async () => {
    if (!seanceId) {
      Alert.alert(
        'Erreur',
        'Aucune séance active.'
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/seances/${seanceId}/terminer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          'Impossible de terminer la séance'
        );
      }

      setTerminee(true);

      Alert.alert(
        'Séance terminée',
        'Ta séance a été enregistrée dans la base de données.'
      );

      console.log(
        'Séance terminée :',
        seanceId
      );
    } catch (error) {
      console.error(
        'Erreur terminaison séance :',
        error
      );

      Alert.alert(
        'Erreur',
        'Impossible de terminer la séance.'
      );
    }
  };

  if (chargement) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.chargement}>
          <Text style={styles.chargementTexte}>
            Démarrage de la séance...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>
          Séance
        </Text>

        <Text style={styles.sousTitre}>
          Ma séance du jour
        </Text>

        {exercices.map((exercice) => (
          <View
            key={exercice.id}
            style={styles.exerciceBloc}
          >
            <View style={styles.exerciceCarte}>
              <Text style={styles.exercice}>
                {exercice.nom}
              </Text>

              <Text style={styles.muscle}>
                {exercice.muscle}
              </Text>
            </View>

            <View style={styles.headerSeries}>
  <Text style={styles.headerTexte}>S�rie</Text>
  <Text style={styles.headerPrevious}>Previous</Text>
  <Text style={styles.headerTexte}>Poids</Text>
  <Text style={styles.headerTexte}>Reps</Text>
  <Text style={styles.headerTexte}>?</Text>
</View>

            {exercice.series.map((serie) => (
              <View
                key={serie.id}
                style={[
                  styles.serie,
                  serie.terminee &&
                    styles.serieTerminee,
                ]}
              >
                <Text style={styles.numero}>
                  {serie.id}
                </Text>

                <Text style={styles.previous}>
                  {previous[exercice.nom]?.[serie.id - 1]
                    ? `${previous[exercice.nom][serie.id - 1].poids} kg � ${previous[exercice.nom][serie.id - 1].repetitions}`
                    : '�'}
                </Text>

                <TextInput
                  style={styles.input}
                  value={serie.poids}
                  keyboardType="numeric"
                  editable={!terminee}
                  onChangeText={(texte) =>
                    modifierPoids(
                      exercice.id,
                      serie.id,
                      texte
                    )
                  }
                />

                <TextInput
                  style={styles.input}
                  value={serie.reps}
                  keyboardType="numeric"
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
              </View>
            ))}

            <TouchableOpacity
              style={styles.boutonAjouterSerie}
              disabled={terminee}
              onPress={() =>
                ajouterSerie(exercice.id)
              }
            >
              <Text style={styles.boutonAjouterTexte}>
                + Ajouter une série
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.boutonAjouterExercice}
          disabled={terminee}
          onPress={() =>
            setMenuExercices(!menuExercices)
          }
        >
          <Text style={styles.boutonAjouterExerciceTexte}>
            ＋ AJOUTER UN EXERCICE
          </Text>
        </TouchableOpacity>

        {menuExercices && !terminee && (
          <View style={styles.menu}>
            <Text style={styles.menuTitre}>
              Choisir un exercice
            </Text>

            {exercicesDisponibles.map(
              (exercice) => (
                <TouchableOpacity
                  key={exercice.nom}
                  style={styles.optionExercice}
                  onPress={() =>
                    ajouterExercice(
                      exercice.nom,
                      exercice.muscle,
                      exercice.backendId
                    )
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.optionNom
                      }
                    >
                      {exercice.nom}
                    </Text>

                    <Text
                      style={
                        styles.optionMuscle
                      }
                    >
                      {exercice.muscle}
                    </Text>
                  </View>

                  <Text style={styles.plus}>
                    ＋
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.boutonTerminer,
            terminee &&
              styles.boutonTerminee,
          ]}
          disabled={terminee}
          onPress={terminerSeance}
        >
          <Text style={styles.boutonTerminerTexte}>
            {terminee
              ? 'SÉANCE TERMINÉE ✓'
              : 'TERMINER LA SÉANCE'}
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
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },

  headerTexte: {
    width: 70,
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
    width: 50,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  input: {
    width: 70,
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

  boutonTerminee: {
    backgroundColor: '#34C759',
  },

  boutonTerminerTexte: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
