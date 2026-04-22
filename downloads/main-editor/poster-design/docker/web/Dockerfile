ARG REGISTRY_PREFIX=mirror.ccs.tencentyun.com
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/

FROM ${REGISTRY_PREFIX}/library/node:20-alpine AS builder

WORKDIR /usr/src/app

ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
ENV npm_config_registry=${NPM_REGISTRY}
ENV NPM_CONFIG_REPLACE_REGISTRY_HOST=always
ENV npm_config_replace_registry_host=always

COPY ./ ./
RUN npm i --registry=${NPM_REGISTRY} --prefer-offline --no-audit --no-fund
RUN npm run build

FROM alibaba-cloud-linux-3-registry.cn-hangzhou.cr.aliyuncs.com/alinux3/nginx_optimized

WORKDIR /usr/share/nginx/html

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY ./docker/web/static.conf /etc/nginx/default.d/

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
