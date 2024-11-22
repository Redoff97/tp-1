require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

// Configuration de la connexion à la base de données PostgreSQL
const pool = new Pool({
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT,
});

// Création de la table "articles" si elle n'existe pas déjà (exécuter une fois)
pool
  .query(
    `
  CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL
  )
`
  )
  .then(() => console.log("La table 'articles' a été créée ou existe déjà."))
  .catch((err) =>
    console.error(
      `Erreur lors de la création de la table 'articles' : ${err.message}`
    )
  );

// Middleware pour analyser le corps des requêtes JSON
app.use(express.json());

// Fonction pour vérifier si un titre d'article est déjà utilisé
const verifyTitleUnicity = async (title) => {
  const result = await pool.query(
    "SELECT COUNT(id) AS count FROM articles WHERE title=$1",
    [title]
  );
  return result.rows[0].count > 0;
};

// Route de base pour vérifier le bon fonctionnement de l'API
app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API des articles !");
});

// Route pour récupérer tous les articles
app.get("/articles", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM articles ORDER BY id ASC");
    if (result.rows.length === 0) {
      throw new Error("La table 'articles' est vide.");
    }
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour ajouter un nouvel article
app.post("/articles", async (req, res) => {
  try {
    const { title, content, author } = req.body;
    if (await verifyTitleUnicity(title)) {
      throw new Error("Un article avec ce titre existe déjà.");
    }
    const result = await pool.query(
      "INSERT INTO articles(title, content, author) VALUES($1, $2, $3) RETURNING *",
      [title, content, author]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour modifier un article en fonction de son ID
app.put("/articles/edit", async (req, res) => {
  try {
    const { id, title, content, author } = req.body;

    if (!id) {
      throw new Error("L'ID de l'article est requis pour la mise à jour.");
    }

    const result = await pool.query(
      "UPDATE articles SET title=$2, content=$3, author=$4 WHERE id=$1 RETURNING *",
      [id, title, content, author]
    );
    if (result.rows.length === 0) {
      throw new Error("Aucun article trouvé avec cet ID.");
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour mettre à jour uniquement le titre d'un article
app.patch("/articles/edit/title", async (req, res) => {
  try {
    const { id, title } = req.body;

    if (!id || !title) {
      throw new Error("L'ID et le nouveau titre sont requis.");
    }

    const result = await pool.query(
      "UPDATE articles SET title=$2 WHERE id=$1 RETURNING *",
      [id, title]
    );
    if (result.rows.length === 0) {
      throw new Error("Aucun article trouvé avec cet ID.");
    }
    res.status(200).json({
      message: "Le titre de l'article a été mis à jour avec succès.",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour supprimer un article en fonction de son ID
app.delete("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM articles WHERE id=$1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Aucun article trouvé avec cet ID." });
    }
    res.status(200).json({
      message: "L'article a été supprimé avec succès.",
      deletedArticle: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      message: `Erreur lors de la suppression de l'article : ${err.message}`,
    });
  }
});

// Lancement du serveur
app.listen(port, () =>
  console.log(`Le serveur est en cours d'exécution sur le port ${port}.`)
);
