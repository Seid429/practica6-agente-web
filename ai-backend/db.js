// Conexión a la base de datos Sakila (SQLite por defecto, MySQL opcional)
const path = require('path');

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase();
const MAX_FILAS = 50; // filas máximas que se devuelven al agente por consulta

let sqlite = null;
let mysqlPool = null;

async function conectar() {
  if (DB_TYPE === 'mysql') {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'sakila',
      dateStrings: true,
      decimalNumbers: true,
      connectionLimit: 5,
    });
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const archivo = path.resolve(__dirname, process.env.SQLITE_PATH || './db/sakila.db');
    sqlite = new DatabaseSync(archivo, { readOnly: true });
  }
  const [{ n }] = await ejecutar('SELECT COUNT(*) AS n FROM film');
  return { tipo: DB_TYPE, peliculas: Number(n) };
}

// Solo se permiten consultas de lectura (una sola sentencia SELECT / WITH)
const PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|create|truncate|attach|detach|pragma|grant|revoke|rename|call|load_file|outfile|dumpfile|lock|unlock|handler|vacuum|reindex)\b/i;

function validarSoloLectura(sql) {
  const limpio = String(sql || '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .replace(/;\s*$/, '');
  if (!limpio) throw new Error('La consulta está vacía.');
  if (limpio.includes(';')) throw new Error('Solo se permite una sentencia por consulta.');
  if (!/^(select|with)\b/i.test(limpio)) throw new Error('Solo se permiten consultas SELECT.');
  if (PROHIBIDAS.test(limpio)) throw new Error('La consulta contiene operaciones no permitidas (solo lectura).');
  return limpio;
}

async function ejecutar(sql) {
  const consulta = validarSoloLectura(sql);
  if (DB_TYPE === 'mysql') {
    const conn = await mysqlPool.getConnection();
    try {
      await conn.query('START TRANSACTION READ ONLY');
      const [filas] = await conn.query({ sql: consulta, timeout: 15000 });
      await conn.query('COMMIT');
      return filas;
    } finally {
      conn.release();
    }
  }
  return sqlite.prepare(consulta).all().map((f) => ({ ...f }));
}

// Versión usada por la herramienta del agente: recorta filas y nunca lanza
async function consultarParaAgente(sql) {
  try {
    const filas = await ejecutar(sql);
    return {
      ok: true,
      total_filas: filas.length,
      filas: filas.slice(0, MAX_FILAS),
      nota: filas.length > MAX_FILAS ? `Se muestran solo las primeras ${MAX_FILAS} filas.` : undefined,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const DIALECTO = {
  sqlite: `SQLite. Fechas guardadas como texto 'YYYY-MM-DD HH:MM:SS'.
- Día de la semana: CAST(strftime('%w', fecha) AS INTEGER) -> 0=domingo ... 6=sábado.
- Diferencia en días: julianday(a) - julianday(b). Solo la fecha: date(fecha).
- Concatenar: a || ' ' || b.`,
  mysql: `MySQL 8.
- Día de la semana: DAYOFWEEK(fecha) -> 1=domingo ... 7=sábado (o DAYNAME(fecha)).
- Diferencia en días: DATEDIFF(a, b). Solo la fecha: DATE(fecha).
- Concatenar: CONCAT(a, ' ', b). Con GROUP BY incluye todas las columnas no agregadas.`,
};

const ESQUEMA = `Base de datos Sakila (tienda de renta de películas en DVD).
Tablas principales (PK en primera columna):
- film(film_id, title, description, release_year, language_id, rental_duration [días permitidos], rental_rate [precio de renta], length [duración en MINUTOS], replacement_cost, rating [G, PG, PG-13, R, NC-17], special_features)
- category(category_id, name)  -- nombres en inglés: 'Action', 'Animation', 'Children', 'Classics', 'Comedy', 'Documentary', 'Drama', 'Family', 'Foreign', 'Games', 'Horror', 'Music', 'New', 'Sci-Fi', 'Sports', 'Travel'
- film_category(film_id, category_id)
- actor(actor_id, first_name, last_name);  film_actor(actor_id, film_id)
- language(language_id, name)
- inventory(inventory_id, film_id, store_id)  -- cada copia física de una película en una tienda
- rental(rental_id, rental_date, inventory_id, customer_id, return_date, staff_id)  -- cada renta
- payment(payment_id, customer_id, staff_id, rental_id, amount, payment_date)  -- dinero cobrado
- customer(customer_id, store_id, first_name, last_name, email, address_id, active [1/0], create_date)
- store(store_id, manager_staff_id, address_id);  staff(staff_id, first_name, last_name, store_id, ...)
- address(address_id, address, district, city_id, phone);  city(city_id, city, country_id);  country(country_id, country)
Relaciones: rental -> inventory -> film; film <-> category vía film_category; payment -> rental y customer.
Datos: las rentas van de 2005-05-24 a 2006-02-14 (casi todas entre mayo y agosto de 2005; en 2006 solo hay un día).`;

module.exports = {
  conectar,
  ejecutar,
  consultarParaAgente,
  get tipo() {
    return DB_TYPE;
  },
  descripcionParaAgente() {
    return `${ESQUEMA}\n\nDialecto SQL: ${DIALECTO[DB_TYPE] || DIALECTO.sqlite}`;
  },
};
