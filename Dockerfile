FROM node:latest
LABEL org.opencontainers.image.source=https://github.com/circlesland/file-server

WORKDIR /usr/o-platform/file-server
COPY . /usr/o-platform/file-server
RUN /usr/o-platform/file-server/build.sh

WORKDIR /usr/o-platform/file-server/dist
CMD ["node", "main.js"]