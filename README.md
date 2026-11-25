# KrishiMitra AI — Multilingual Smart Agriculture Assistant

## [Live Demo](https://krishimitra-ai-assistant.vercel.app/)

## Overview

**KrishiMitra AI** is a multilingual (Kannada, Hindi, and English) smart agriculture assistant built to help farmers make data-driven crop, soil, weather, and mandi decisions.

### Key Features
- **Multilingual Experience:** Full UI and voice-guided walkthrough in **Kannada (`ಕನ್ನಡ`)**, **Hindi (`हिन्दी`)**, and **English**.
- **Location-Aware Crop Recommendation:** Recommends regionally suitable crops using N-P-K soil values, soil pH, temperature, humidity, and seasonal rainfall.
- **Live Weather & Seasonal Rainfall:** Real-time weather and 30-day cumulative rainfall powered by Open-Meteo with regional soil-test estimates.
- **Farm Location Selector:** State, District, Taluk/Block, and Village selection with India Post lookup and custom village support.
- **Leaf Disease Detection, Price Forecast & Schemes:** Tools for crop photo scanning, mandi price trends, field management, and government agricultural schemes.

### Tech Stack
- **Frontend:** React 19, TypeScript, Vite, React Router v7 (`react-router`)
- **Styling & UI:** Tailwind CSS v4, Shadcn UI, Lucide Icons, Framer Motion, Three.js
- **Backend & Data:** Convex, Convex Auth, Open-Meteo API, India Post API, FastAPI / scikit-learn ML pipeline (`backend/`)

All frontend source files live in the `src/` directory.

## Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Karthik-S-T/krishimitra-ai-assistant.git](https://github.com/Karthik-S-T/krishimitra-ai-assistant.git)
   cd krishimitra-ai-assistant
