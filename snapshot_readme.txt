Флоу тепер:
npm run snapshot       → зберігає snapshot.json
npm run import-template-bom <file>  → в кінці автоматично зберігає created.json


npm run restore                      # список всіх імпортів
npm run restore -- "Диван Малібу"   # видалити тільки Малібу
npm run restore -- all               # видалити все