'use strict';
// Общий изменяемый синглтон сервера: комнаты и сокет.
// server.js создаёт wss и кладёт сюда ссылку (State.wss = wss).
const rooms = new Map();
const State = { rooms, wss: null };
module.exports = State;
