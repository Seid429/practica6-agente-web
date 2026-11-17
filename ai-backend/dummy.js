// MODO DUMMY: sin API key no hay IA, pero el agente responde las 3 preguntas
// de la tarea ejecutando consultas SQL reales preparadas de antemano.
const db = require('./db');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dinero = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nombre = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const SQL = {
  peliculas: {
    sqlite: `SELECT f.title, f.length, f.rating, COUNT(r.rental_id) AS rentas
FROM film f
JOIN film_category fc ON fc.film_id = f.film_id
JOIN category c ON c.category_id = fc.category_id
JOIN inventory i ON i.film_id = f.film_id
JOIN rental r ON r.inventory_id = i.inventory_id
WHERE c.name = 'Action' AND f.length > 120
GROUP BY f.film_id, f.title, f.length, f.rating
ORDER BY rentas DESC, f.length DESC
LIMIT 6`,
  },
  clientes: {
    sqlite: `SELECT c.customer_id, c.first_name || ' ' || c.last_name AS cliente, c.email,
  MAX(r.rental_date) AS ultima_renta,
  CAST(julianday((SELECT MAX(rental_date) FROM rental)) - julianday(MAX(r.rental_date)) AS INTEGER) AS dias_sin_rentar,
  COUNT(r.rental_id) AS rentas_totales
FROM customer c
JOIN rental r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
ORDER BY dias_sin_rentar DESC, rentas_totales ASC
LIMIT 10`,
    mysql: `SELECT c.customer_id, CONCAT(c.first_name, ' ', c.last_name) AS cliente, c.email,
  MAX(r.rental_date) AS ultima_renta,
  DATEDIFF((SELECT MAX(rental_date) FROM rental), MAX(r.rental_date)) AS dias_sin_rentar,
  COUNT(r.rental_id) AS rentas_totales
FROM customer c
JOIN rental r ON r.customer_id = c.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
ORDER BY dias_sin_rentar DESC, rentas_totales ASC
LIMIT 10`,
  },
  dias: {
    sqlite: `WITH por_fecha AS (
  SELECT CAST(strftime('%w', payment_date) AS INTEGER) AS dia, date(payment_date) AS fecha,
         COUNT(*) AS pagos, SUM(amount) AS total
  FROM payment
  GROUP BY dia, fecha
)
SELECT dia, SUM(pagos) AS transacciones, ROUND(SUM(total), 2) AS total,
       COUNT(*) AS dias_con_ventas, ROUND(SUM(total) / COUNT(*), 2) AS promedio_por_dia,
       ROUND(SUM(total) / SUM(pagos), 2) AS ticket_promedio
FROM por_fecha
GROUP BY dia
ORDER BY transacciones DESC`,
    mysql: `WITH por_fecha AS (
  SELECT DAYOFWEEK(payment_date) - 1 AS dia, DATE(payment_date) AS fecha,
         COUNT(*) AS pagos, SUM(amount) AS total
  FROM payment
  GROUP BY dia, fecha
)
SELECT dia, SUM(pagos) AS transacciones, ROUND(SUM(total), 2) AS total,
       COUNT(*) AS dias_con_ventas, ROUND(SUM(total) / COUNT(*), 2) AS promedio_por_dia,
       ROUND(SUM(total) / SUM(pagos), 2) AS ticket_promedio
FROM por_fecha
GROUP BY dia
ORDER BY transacciones DESC`,
  },
};

const sqlDe = (clave) => SQL[clave][db.tipo] || SQL[clave].sqlite;

async function peliculasAccion() {
  const sql = sqlDe('peliculas');
  const filas = await db.ejecutar(sql);
  const top = filas.slice(0, 3);
  const empatadas = filas.slice(3).filter((f) => Number(f.rentas) === Number(top[2].rentas));
  let texto =
    'Criterio: categoría Action, duración mayor a 120 minutos, ordenadas por número de rentas.\n\n' +
    top.map((f, i) => `${i + 1}. ${f.title} - ${f.length} min, clasificación ${f.rating}, ${f.rentas} rentas`).join('\n');
  if (empatadas.length) {
    texto += `\n\nNota: ${empatadas.map((f) => `${f.title} (${f.length} min)`).join(', ')} también tiene ${top[2].rentas} rentas; el empate se desempató por mayor duración.`;
  }
  return { texto, sql };
}

async function clientesEnRiesgo() {
  const sql = sqlDe('clientes');
  const filas = await db.ejecutar(sql);
  const texto =
    'Criterio: días entre su última renta y la última fecha registrada en la base (no la fecha de hoy, porque los datos son de 2005-2006).\n\n' +
    filas
      .map((f) => `- ${nombre(f.cliente)} (${f.email}): ${f.dias_sin_rentar} días sin rentar, última renta ${String(f.ultima_renta).slice(0, 10)}, ${f.rentas_totales} rentas en total`)
      .join('\n') +
    '\n\nSon los primeros candidatos para una campaña de recuperación (descuento o recordatorio por correo).';
  return { texto, sql };
}

async function diasDeLaSemana() {
  const sql = sqlDe('dias');
  const filas = await db.ejecutar(sql);
  const mas = filas[0];
  const mejorPromedio = [...filas].sort((a, b) => b.promedio_por_dia - a.promedio_por_dia)[0];
  const texto =
    `El día con más movimiento es el ${DIAS[mas.dia]}: ${mas.transacciones} transacciones y ${dinero(mas.total)} en total.\n\n` +
    filas
      .map((f) => `- ${DIAS[f.dia]}: ${f.transacciones} transacciones, ${dinero(f.total)} total, promedio ${dinero(f.promedio_por_dia)} por día (${f.dias_con_ventas} días con ventas), ticket promedio ${dinero(f.ticket_promedio)}`)
      .join('\n') +
    `\n\nOjo: el promedio por día del ${DIAS[mas.dia]} sale bajo porque incluye varios días incompletos (inicios de periodo con pocas ventas). ` +
    `Por recaudación promedio diaria, el mejor día es el ${DIAS[mejorPromedio.dia]} con ${dinero(mejorPromedio.promedio_por_dia)}.`;
  return { texto, sql };
}

const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function responderDummy(mensaje) {
  const m = sinAcentos(mensaje);
  let resultado = null;

  if (/accion/.test(m) && /(larga|hora|duracion|minut)/.test(m)) resultado = await peliculasAccion();
  else if (/(dejar|abandon|sin alquilar|sin rentar|inactiv|mucho tiempo)/.test(m)) resultado = await clientesEnRiesgo();
  else if (/(dia de la semana|dias de la semana|movimiento|recauda)/.test(m)) resultado = await diasDeLaSemana();

  if (!resultado) {
    return {
      reply:
        '[Modo dummy] Estoy conectado a la base Sakila, pero sin API key solo sé responder las 3 preguntas de la tarea:\n' +
        '- Recomiéndame 3 películas de acción largas que se alquilen mucho\n' +
        '- ¿Qué clientes están a punto de dejar el servicio?\n' +
        '- ¿Qué día de la semana hay más movimiento y cuánto se recauda?\n\n' +
        'Agrega tu OPENROUTER_API_KEY en el archivo .env y reinicia el servidor para hacer cualquier pregunta.',
      consultas: [],
    };
  }

  return {
    reply: `[Modo dummy] ${resultado.texto}`,
    consultas: [{ sql: resultado.sql, ok: true }],
  };
}

module.exports = { responderDummy };
