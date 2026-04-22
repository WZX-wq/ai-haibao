ARG REGISTRY_PREFIX=mirror.ccs.tencentyun.com
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/

FROM ${REGISTRY_PREFIX}/library/node:20-alpine AS builder

WORKDIR /usr/src/app

ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
ENV npm_config_registry=${NPM_REGISTRY}
ENV NPM_CONFIG_REPLACE_REGISTRY_HOST=always
ENV npm_config_replace_registry_host=always
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

COPY ./package*.json ./
RUN npm install --registry=${NPM_REGISTRY} --prefer-offline --no-audit --no-fund

COPY ./ ./
RUN npm run build && cp -r ./src/mock ./dist

FROM ${REGISTRY_PREFIX}/puppeteer/puppeteer:latest

ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/
USER root

RUN mkdir -p /cache
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-noto-cjk \
    fonts-wqy-microhei \
    fonts-wqy-zenhei \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./
COPY src/assets/fonts/xpsj.subset.ttf /usr/local/share/fonts/xpsj.subset.ttf

RUN fc-cache -fv

ENV LANG=zh_CN.UTF-8
ENV LC_ALL=zh_CN.UTF-8
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
ENV npm_config_registry=${NPM_REGISTRY}
ENV NPM_CONFIG_REPLACE_REGISTRY_HOST=always
ENV npm_config_replace_registry_host=always
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

RUN npm install --registry=${NPM_REGISTRY} --prefer-offline --no-audit --no-fund
RUN mkdir -p server && mv -f server.js server/index.js

EXPOSE 3000
CMD ["node", "server/index.js"]
