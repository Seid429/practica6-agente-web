const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./db');
const { crearAgente } = require('./agent');
const { responderDummy } = require('./dummy');

const app = express();
app.use(express.json());
app.use(cors());

// También sirve el frontend en http://localhost:3000
app.use(express.static(path.join(__dirname, '..', 'ai-frontend')));

// ---------------------------------------------------------------------------
// API KEY DE OPENROUTER
// La llave NO se escribe aquí: se lee del archivo .env (OPENROUTER_API_KEY).
// Mientras el .env tenga el texto de ejemplo, el servidor trabaja en MODO DUMMY.
// ---------------------------------------------------------------------------
const API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const PLACEHOLDER = 'tu_api_key_de_openrouter_aqui';
const MODO_DUMMY = !API_KEY || API_KEY === PLACEHOLDER;
const MODELO = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const agente = MODO_DUMMY ? null : crearAgente({ apiKey: API_KEY, modelo: MODELO });
let estadoBD = { conectada: false };

app.get('/api/health', (req, res) => {
  res.json({ modo: MODO_DUMMY ? 'dummy' : 'openrouter', modelo: MODO_DUMMY ? null : MODELO, bd: estadoBD });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El campo "message" es obligatorio' });
    }
    if (!estadoBD.conectada) {
      return res.status(503).json({ error: `La base de datos no está conectada: ${estadoBD.error}` });
    }

    // Solo se reenvían mensajes de texto user/assistant del historial
    const historial = (Array.isArray(history) ? history : [])
      .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-20);

    const resultado = MODO_DUMMY ? await responderDummy(message) : await agente.responder(message, historial);
    res.json({ reply: resultado.reply, consultas: resultado.consultas });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    res.status(500).json({ error: 'Error interno al procesar la solicitud con la IA' });
  }
});

const PORT = process.env.PORT || 3000;

db.conectar()
  .then((info) => {
    estadoBD = { conectada: true, ...info };
    console.log(`Base de datos Sakila conectada (${info.tipo}): ${info.peliculas} películas.`);
  })
  .catch((error) => {
    estadoBD = { conectada: false, error: error.message };
    console.error('No se pudo conectar a la base de datos Sakila:', error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT} -> abre http://localhost:${PORT}`);
      console.log(
        MODO_DUMMY
          ? 'MODO DUMMY: no hay API key en .env, solo se responden las 3 preguntas de la tarea.'
          : `Conectado a OpenRouter con el modelo ${MODELO}.`
      );
    });
  });
