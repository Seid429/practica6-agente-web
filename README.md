# Agente BD: agente IA conectado a la base de datos Sakila

Continuación de la Práctica 6 (agente IA en aplicativo web). El agente ahora consulta la base de datos
**Sakila** (tienda de renta de películas) para responder preguntas de negocio con datos reales.

## Cómo funciona

```
Navegador (ai-frontend)  ──POST /api/chat──▶  Backend Express (ai-backend)
                                                   │
                                                   ├─▶ OpenRouter (gpt-4o-mini) con la herramienta consultar_bd
                                                   │        ▲  el modelo decide qué SQL ejecutar
                                                   │        │  y recibe las filas en JSON
                                                   └─▶ Base de datos Sakila (SQLite o MySQL, solo lectura)
```

1. El usuario escribe una pregunta en el chat.
2. El backend la envía al modelo junto con la descripción de las tablas de Sakila y una herramienta `consultar_bd`.
3. El modelo genera las consultas SQL que necesita; el backend las ejecuta (solo `SELECT`) y le devuelve los resultados.
4. Con esos datos el modelo redacta la respuesta. El chat muestra la respuesta y el SQL que se ejecutó.

```
practica6-agente-web/
├── iniciar.bat          Doble clic: instala, arranca y abre el chat
├── ai-backend/
│   ├── server.js        Servidor Express (POST /api/chat, GET /api/health)
│   ├── agent.js         Agente: OpenRouter + tool calling (consultar_bd)
│   ├── db.js            Conexión a Sakila (SQLite o MySQL) y validación de solo lectura
│   ├── dummy.js         Respuestas sin API key para las 3 preguntas de la tarea
│   ├── db/sakila.db     Base Sakila convertida a SQLite (16 tablas, 16,044 rentas)
│   └── .env.example     Cópialo como .env y pon ahí la API key de OpenRouter
└── ai-frontend/
    ├── index.html       Interfaz del chat
    └── app.js
```

## 1. Arrancar

Requisito: Node.js 22.13 o superior.

En Windows, doble clic en `iniciar.bat`. O manualmente:

```bash
cd ai-backend
npm install
npm start
```

Abre **http://localhost:3000**. El indicador de arriba a la derecha muestra la base conectada y el modo.

## 2. API key de OpenRouter

El archivo `.env` no se sube al repositorio. Copia `ai-backend/.env.example` como `ai-backend/.env` y reemplaza:

```
OPENROUTER_API_KEY=tu_api_key_de_openrouter_aqui
```

por tu llave (https://openrouter.ai/keys). Guarda y reinicia el servidor.

Sin llave, el servidor corre en **modo dummy**: responde las 3 preguntas de la tarea con consultas SQL reales
ya preparadas, para probar todo sin gastar créditos. Con la llave, el agente puede responder cualquier pregunta.

## 3. Base de datos

Por defecto se usa `ai-backend/db/sakila.db` (SQLite), que ya trae todos los datos oficiales de Sakila: no hay que instalar nada.

Para usar MySQL con la base `sakila` cargada desde `sakila-schema.sql` y `sakila-data.sql`, cambia en `.env`:

```
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=tu_password
MYSQL_DATABASE=sakila
```

En ambos casos el agente solo puede leer: se rechaza cualquier sentencia que no sea un `SELECT`.

## 4. Preguntas de la tarea

- "Recomiéndame 3 películas de acción que sean largas (más de 2 horas) pero que la gente alquile muy seguido en la tienda."
- "¿Qué clientes crees que están a punto de dejar el servicio porque llevan mucho tiempo sin alquilar ninguna película?"
- "Hazme un análisis rápido de qué día de la semana hay más movimiento en las tiendas y cuánto dinero promedio se recauda en esos días."

Se escriben directamente en el chat. Nota sobre los datos: las rentas de Sakila son de 2005-2006, así que "mucho tiempo sin
alquilar" se mide contra la última fecha registrada en la base, no contra la fecha de hoy.
