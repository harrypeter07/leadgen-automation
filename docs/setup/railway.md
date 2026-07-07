# Railway Deployment Guide

This guide details how to deploy the Postgres database and Node.js backend to Railway.

## 1. Deploy PostgreSQL
1. Log in to [railway.app](https://railway.app/).
2. Click **New Project** → **Provision PostgreSQL**.
3. Railway will spin up a Postgres cluster and provide a connection string (`DATABASE_URL`).

## 2. Deploy Backend API
1. Select **New Service** → **Deploy from GitHub repo**.
2. Select your `leadgen-automation` project.
3. In service **Settings** → **Variables**, configure the environment variables as specified in the variables documentation.
4. Mount a persistent disk volume for browser cookies if using Playwright scrapers (optional).
