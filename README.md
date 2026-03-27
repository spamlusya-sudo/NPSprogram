# NPSprogram with shared storage on Netlify

Этот вариант сохраняет общие данные для всех пользователей через Netlify Functions + Netlify Blobs.

## Что делать

1. Замените файлы в GitHub-репозитории содержимым этой папки.
2. Убедитесь, что в репозитории есть:
   - `index.html`
   - `package.json`
   - `netlify.toml`
   - `netlify/functions/site-state.js`
3. В Netlify:
   - откройте Site configuration → Build & deploy
   - Build command: оставить пустым
   - Publish directory: оставить пустым
4. Нажмите Trigger deploy → Deploy site.
5. После первого деплоя откройте сайт и проверьте, что справа внизу появляется статус:
   - «Общие данные загружены»
   - «Изменения сохранены для всех»

## Как это работает

- код сайта хранится в GitHub
- сам сайт работает на Netlify
- общие данные читаются и записываются через `/.netlify/functions/site-state`
- функция сохраняет данные в Netlify Blobs

## Ограничение

Если два человека редактируют одни и те же данные одновременно, сохранится последняя запись.
