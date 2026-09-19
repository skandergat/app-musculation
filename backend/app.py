from flask import Flask, jsonify

app = Flask(__name__)
app.json.ensure_ascii = False  # pour afficher correctement les accents

EXERCICES = [
    {"id": 1, "nom": "Squat", "muscle": "Jambes"},
    {"id": 2, "nom": "Développé couché", "muscle": "Pectoraux"},
    {"id": 3, "nom": "Soulevé de terre", "muscle": "Dos"},
]

@app.route("/")
def accueil():
    return "Hello world !"

@app.route("/exercices")
def liste_exercices():
    return jsonify(EXERCICES)

if __name__ == "__main__":
    app.run(debug=True)