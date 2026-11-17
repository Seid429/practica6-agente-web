// Agente IA: usa OpenRouter con "tool calling" para consultar la BD Sakila
const { OpenAI } = require('openai');
const db = require('./db');

const MAX_PASOS = 8; // vueltas máximas modelo -> herramienta -> modelo

const HERRAMIENTAS = [
  {
    type: 'function',
    function: {
      name: 'consultar_bd',
      description:
        'Ejecuta UNA consulta SQL de solo lectura (SELECT) sobre la base de datos Sakila y devuelve las filas en JSON. ' +
        'Úsala todas las veces que necesites para obtener datos reales antes de responder.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'Consulta SELECT a ejecutar.' },
          proposito: { type: 'string', description: 'Qué se busca con esta consulta, en pocas palabras.' },
        },
        required: ['sql'],
      },
    },
  },
];

function promptSistema() {
  return `Eres "Agente BD", un analista de datos de una cadena de renta de películas. Respondes en español.
Tienes acceso a la base de datos real mediante la herramienta consultar_bd. Reglas:
1. Nunca inventes datos: consulta la base antes de responder y basa cada cifra en los resultados.
2. Si una consulta falla, lee el error, corrige el SQL y vuelve a intentar.
3. Para preguntas sobre "hace cuánto tiempo" o "recientemente", la fecha de referencia ("hoy" del negocio) es la última fecha registrada: (SELECT MAX(rental_date) FROM rental). No uses la fecha actual del sistema.
4. Interpreta términos del negocio y explica el criterio que usaste (por ejemplo: "largas" = más de 120 minutos; "alquila muy seguido" = más rentas registradas).
5. Si hay empates o datos raros (días incompletos, huecos de fechas), menciónalo brevemente.
6. Respuesta final clara y breve: una línea de conclusión, luego una lista con guiones y las cifras clave. No uses tablas Markdown ni bloques de código.

${db.descripcionParaAgente()}`;
}

function crearAgente({ apiKey, modelo }) {
  const cliente = new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://tu-sitio-web.com', // Opcional: para rankings en OpenRouter
      'X-Title': 'Mi Aplicativo Web', // Opcional: nombre de tu app
    },
  });

  async function responder(mensaje, historial) {
    const consultas = [];
    const messages = [
      { role: 'system', content: promptSistema() },
      ...historial,
      { role: 'user', content: mensaje },
    ];

    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const completion = await cliente.chat.completions.create({
        model: modelo,
        messages,
        tools: HERRAMIENTAS,
        tool_choice: 'auto',
        temperature: 0.2,
      });

      const respuesta = completion.choices[0].message;
      messages.push(respuesta);

      if (!respuesta.tool_calls || respuesta.tool_calls.length === 0) {
        return { reply: respuesta.content || '(sin respuesta)', consultas };
      }

      for (const llamada of respuesta.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(llamada.function.arguments || '{}');
        } catch {
          args = {};
        }
        const resultado =
          llamada.function.name === 'consultar_bd'
            ? await db.consultarParaAgente(args.sql)
            : { ok: false, error: `Herramienta desconocida: ${llamada.function.name}` };

        consultas.push({ sql: args.sql, ok: resultado.ok, filas: resultado.total_filas, error: resultado.error });
        console.log(`[consultar_bd] ${resultado.ok ? 'OK' : 'ERROR'} ${String(args.sql).replace(/\s+/g, ' ')}`);

        messages.push({ role: 'tool', tool_call_id: llamada.id, content: JSON.stringify(resultado) });
      }
    }

    return {
      reply: 'No pude terminar el análisis en los pasos permitidos. Intenta hacer la pregunta más específica.',
      consultas,
    };
  }

  return { responder };
}

module.exports = { crearAgente };
