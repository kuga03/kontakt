# Kontakt

## Как обновить игру

### 1. Скачать/обновить репозиторий

```bash
git clone https://github.com/kuga03/kontakt.git
cd kontakt
```

Или если уже склонирован:
```bash
git pull origin main
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Запуск для разработки

```bash
npm run dev
```

### 4. Сборка

```bash
npm run build
```

### 5. Отправить изменения на GitHub

```bash
git add -A
git commit -m "Описание изменений"
git push origin main
```

## Структура проекта

- `index.html` — точка входа
- `js/` — игровой код (сцены, AI, бой, UI)
- `docs/` — документация
- `android-build/` — скрипты сборки под Android
