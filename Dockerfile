# Используем официальный Node.js образ
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем всё остальное
COPY . .

# Указываем порт, на котором приложение слушает
ENV PORT=3000
EXPOSE 3000

# Команда запуска приложения
CMD ["npm", "start"]
