FROM node:22-alpine AS build

WORKDIR /app

ARG NG_APP_API_URL=/api

COPY package*.json ./
RUN npm ci

COPY angular.json tsconfig*.json ./
COPY public ./public
COPY src ./src
RUN node ./node_modules/@angular/cli/bin/ng build --configuration production --output-mode=static --prerender=false --ssr=false --define NG_APP_API_URL=\"$NG_APP_API_URL\"

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/vn-biodiversity-webgis-UI/browser /usr/share/nginx/html

EXPOSE 80
