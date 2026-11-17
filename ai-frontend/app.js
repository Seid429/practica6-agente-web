// Si la página se abre desde el servidor (http://localhost:3000) se usa la misma dirección;
// si se abre con doble clic (file://) se apunta al backend en el puerto 3000.
const API_BASE = location.protocol === 'file:' ? 'http://localhost:3000' : '';
const API_URL = `${API_BASE}/api/chat`;

let conversationHistory = [];

async function verificarEstado() {
    const estado = document.getElementById('estado');
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        const data = await res.json();
        if (!data.bd.conectada) {
            estado.textContent = 'BD sin conexión';
            estado.className = 'estado error';
        } else if (data.modo === 'dummy') {
            estado.textContent = `Sakila (${data.bd.tipo}) · modo dummy`;
            estado.className = 'estado dummy';
        } else {
            estado.textContent = `Sakila (${data.bd.tipo}) · ${data.modelo}`;
            estado.className = 'estado ok';
        }
    } catch {
        estado.textContent = 'Servidor apagado';
        estado.className = 'estado error';
    }
}

async function sendMessage() {
    const inputField = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const sendBtn = document.getElementById('sendBtn');
    const text = inputField.value.trim();

    if (!text || sendBtn.disabled) return;

    // 1. Mostrar mensaje del usuario en la UI
    appendMessage(text, 'user');
    inputField.value = '';
    sendBtn.disabled = true;
    const pensando = appendMessage('Consultando la base de datos...', 'assistant pensando');
    chatBox.scrollTop = chatBox.scrollHeight;

    // Agregar al historial local
    conversationHistory.push({ role: 'user', content: text });

    try {
        // 2. Enviar petición al Backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: conversationHistory.slice(0, -1) // Enviamos el historial previo
            })
        });

        const data = await response.json();
        pensando.remove();

        if (data.reply) {
            // 3. Mostrar respuesta del agente en la UI (con el SQL que usó)
            const div = appendMessage(data.reply, 'assistant');
            agregarConsultas(div, data.consultas);
            // Agregar respuesta al historial local
            conversationHistory.push({ role: 'assistant', content: data.reply });
        } else {
            appendMessage(`Error: ${data.error || 'No se pudo obtener respuesta del servidor.'}`, 'assistant');
            conversationHistory.pop();
        }
    } catch (error) {
        console.error('Error de red:', error);
        pensando.remove();
        appendMessage('Error de conexión con el servidor. ¿Está corriendo el backend?', 'assistant');
        conversationHistory.pop();
    }

    sendBtn.disabled = false;
    chatBox.scrollTop = chatBox.scrollHeight;
}

function agregarConsultas(div, consultas) {
    if (!consultas || consultas.length === 0) return;
    const details = document.createElement('details');
    details.className = 'sql';
    const summary = document.createElement('summary');
    summary.textContent = `Ver SQL ejecutado (${consultas.length} ${consultas.length === 1 ? 'consulta' : 'consultas'})`;
    details.appendChild(summary);
    consultas.forEach((c) => {
        const pre = document.createElement('pre');
        pre.textContent = c.ok ? c.sql : `${c.sql}\n-- Error: ${c.error}`;
        if (!c.ok) pre.className = 'fallo';
        details.appendChild(pre);
    });
    div.appendChild(details);
}

function appendMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    chatBox.appendChild(messageDiv);
    return messageDiv;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

verificarEstado();
