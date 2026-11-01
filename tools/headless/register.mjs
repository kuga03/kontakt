// register.mjs — регистрирует hooks.mjs до загрузки игровых модулей.
// Запуск: node --import ./tools/headless/register.mjs ./tools/headless/run.mjs
import { register } from 'node:module';
register(new URL('./hooks.mjs', import.meta.url));
