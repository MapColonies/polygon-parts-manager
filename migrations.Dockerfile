FROM node:24-slim

WORKDIR /usr/app

ENV CONFIG_OFFLINE_MODE=true

COPY ./package*.json ./
RUN npm install
COPY . .


ENTRYPOINT ["node", "--require", "ts-node/register", "./node_modules/typeorm/cli.js"]
CMD ["migration:run", "-d","dataSource.ts"]
