# Práctica 6: Integrar un agente en aplicativo web

```
practica6-agente-web/
├── ai-backend/      Servidor Node.js + Express (POST /api/chat)
│   ├── server.js
│   ├── package.json
│   └── .env.example <-- cópialo como .env y pon ahí la API key de OpenRouter
└── ai-frontend/     Interfaz de chat
    ├── index.html
    └── app.js
```

## 1. Levantar el backend

```bash
cd ai-backend
npm install
npm start
```

Debe mostrar `Servidor corriendo en puerto 3000`.

## 2. Agregar la API key de OpenRouter

El archivo `.env` no se sube al repositorio. Copia `ai-backend/.env.example` como `ai-backend/.env` y reemplaza el texto de ejemplo:

```
OPENROUTER_API_KEY=tu_api_key_de_openrouter_aqui
```

por tu llave (se genera en https://openrouter.ai/keys). Guarda y reinicia el servidor.

Mientras la llave no esté puesta, el servidor corre en **modo dummy**: contesta con
respuestas simuladas para poder probar el flujo completo sin gastar créditos.

El modelo se cambia en el mismo archivo con `OPENROUTER_MODEL`.

## 3. Probar el frontend

Con el backend corriendo, abre `ai-frontend/index.html` con doble clic, escribe un
mensaje y presiona Enviar o Enter. Tu mensaje aparece en azul a la derecha y la
respuesta del agente en gris a la izquierda.
