# Etapa 1: empaqueta el handler y sus dependencias (pg) en un único dist/index.js
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Etapa 2: imagen oficial de Lambda para Node 22. Incluye el Runtime Interface Emulator (RIE),
# así que en local expone la API de invocación en el puerto 8080 sin cuenta de AWS:
#   POST /2015-03-31/functions/function/invocations
FROM public.ecr.aws/lambda/nodejs:22
COPY --from=build /app/dist/index.js ${LAMBDA_TASK_ROOT}/
CMD ["index.handler"]
