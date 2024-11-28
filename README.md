# PolygonParts Manager

## API
Checkout the OpenAPI spec [here](/openapi3.yaml)

## Installation

Install deps with npm

```bash
npm install
```
### Install Git Hooks
```bash
npx husky install
```

## Run Locally

Clone the project

```bash
git clone https://link-to-project
```

Go to the project directory

```bash
cd my-project
```

Install dependencies

```bash
npm install
```

Start the server

```bash
npm run start
```

## Running Tests

To run tests, run the following command

```bash
npm run test
```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```

> [!CAUTION]
> set database connection properties in test.json and local.json for a __non-existing__ database or else you might cause damage to your database when running tests

# Migrations

Building the migrations docker file
```bash
docker build -t pp-migration:v<tag> -f migrations.Dockerfile .
```

Running the migration docker locally 
```bash
docker run -it --rm -e NODE_ENV=<env> --network host -v ./config/<env>.json:/usr/app/config/<env>.json pp-migration:<tag>
```
Note: in this command we are mounting local config file to the container instead of adding -e to all environment variables .

In the following example a production.json file is provided. The `<env>` is set to production. like so:
```
docker run -it --rm -e NODE_ENV=production --network host -v /path/to/production.json:/usr/app/config/production.json pp-migration:v1.0.1
```
production.json:
```json
{
  "db": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "postgres",
    "password": "password",
    "enableSslAuth": false,
    "sslPaths": {
      "ca": "",
      "key": "",
      "cert": ""
    },
    "database": "test_migrations",
    "schema": "polygon_parts",
    "synchronize": false,
    "logging": "all",
    "entities": ["**/DAL/*.js"],
    "migrations": ["db/migrations/*.js"],
    "applicationName": "polygon_parts"
  }
}
```
