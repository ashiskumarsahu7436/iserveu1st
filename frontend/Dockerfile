FROM node:24-alpine AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts/iserveu1st/package.json artifacts/iserveu1st/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
RUN corepack enable && pnpm install --frozen-lockfile

COPY artifacts/iserveu1st artifacts/iserveu1st
COPY lib/api-client-react lib/api-client-react
COPY lib/api-spec lib/api-spec
COPY lib/api-zod lib/api-zod
COPY lib/db lib/db
RUN PORT=5173 BASE_PATH=/ pnpm --filter @workspace/iserveu1st run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/iserveu1st/dist/public /usr/share/nginx/html
EXPOSE 5173