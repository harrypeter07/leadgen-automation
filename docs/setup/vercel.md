# Vercel Deployment Guide

This guide details how to host the Next.js frontend client on Vercel.

## 1. Import Next.js Project
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your project repository.
4. Set the **Root Directory** as `dashboard/`.

## 2. Environment Variables Configuration
Set the following variables inside the Vercel dashboard setting panels:
- `NEXT_PUBLIC_API_URL`: Points to your deployed Railway backend URL (e.g. `https://backend-production.up.railway.app`).
- Set any auth passwords.
