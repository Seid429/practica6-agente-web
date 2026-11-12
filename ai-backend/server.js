const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());
app.use(cors());

// ---------------------------------------------------------------------------
// API KEY DE OPENROUTER
// La llave NO se escribe aquí: se lee del archivo .env (OPENROUTER_API_KEY).
// Mientras el .env tenga el texto de ejemplo, el servidor trabaja en MODO DUMMY
// y contesta con respuestas simuladas, sin llamar a OpenRouter.
// ---------------------------------------------------------------------------
const API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const PLACEHOLDER = 'tu_api_key_de_openrouter_aqui';
const MODO_DUMMY = !API_KEY || API_KEY === PLACEHOLDER;

// Modelo a usar (se puede cambiar desde el .env por cualquiera de OpenRouter)
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// Inicializar el cliente de OpenAI apuntando a la baseURL de OpenRouter
const openrouter = MODO_DUMMY
  ? null
  : new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://tu-sitio-web.com', // Opcional: para rankings en OpenRouter
        'X-Title': 'Mi Aplicativo Web', // Opcional: nombre de tu app
      },
    });

// Respuesta simulada para probar todo el flujo sin API key
function respuestaDummy(message, history) {
  const turno = Math.floor(history.length / 2) + 1;
  return (
    `[Respuesta dummy #${turno}] Recibí tu mensaje: "${message}". ` +
    `Llevo ${history.length} mensajes previos en el historial. ` +
    'Agrega tu OPENROUTER_API_KEY en el archivo .env y reinicia el servidor para obtener respuestas reales de la IA.'
  );
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El campo "message" es obligatorio' });
    }

    const previo = Array.isArray(history) ? history : [];

    if (MODO_DUMMY) {
      return res.json({ reply: respuestaDummy(message, previo) });
    }

    // Construir el arreglo de mensajes combinando historial y mensaje actual
    const messages = [...previo, { role: 'user', content: message }];

    // Llamada a la API a través de OpenRouter
    const completion = await openrouter.chat.completions.create({
      model: MODEL,
      messages: messages,
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('Error al comunicarse con OpenRouter:', error);
    res.status(500).json({ error: 'Error interno al procesar la solicitud con la IA' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(
    MODO_DUMMY
      ? 'MODO DUMMY: no hay API key en .env, se responderá con mensajes simulados.'
      : `Conectado a OpenRouter con el modelo ${MODEL}.`
  );
});
