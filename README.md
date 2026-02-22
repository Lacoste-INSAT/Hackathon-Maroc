# Snap & Sync

An offline-first, AI-driven EMR (Electronic Medical Record) system designed for low-connectivity environments, such as rural clinics.

This repository consists of two main pieces:
1. **Next.js Web App** (Root level) - A desktop-first web UI built with Next.js 14, React, Tailwind CSS, and shadcn/ui. This acts primarily to visualize the architecture and the queue.
2. **React Native Mobile App** (`/mobile` directory) - The offline-first production mobile application built with Expo SDK 54, SQLite, and Zustand.

## Architecture

The system is built on a "Store and Forward" architecture:
- **Mobile Client**: Doctors capture handwritten medical notes natively using the camera. The image is saved immediately to the device filesystem and a record is created in a local SQLite database.
- **Background Sync**: When the device detects an active internet connection, it pushes all pending records to the cloud.
- **Supabase Backend**: Handles Authentication, PostgreSQL database storage, and Image Storage.
- **AI Extraction (Gemini)**: A Supabase Edge Function triggers whenever a new image is uploaded. It sends the secure image URL to Google's Gemini 2.5 Flash Vision API to extract structured medical data (medications, dosages, patient instructions). The Edge function calculates a confidence score, saving it to PostgreSQL.
- **Review Queue**: The doctor can review low-confidence extractions later inside the mobile app to ensure no errors were made.

## Documentation

- **Mobile Client README**: Check the [mobile/README.md](./mobile/README.md) for detailed instructions on running the Expo app natively.
- **Supabase Migrations**: Check the [supabase/migrations](./supabase/migrations) folder for the PostgreSQL schemas.
- **Plan & Project Progress**: Check [PLAN.md](./PLAN.md) and [implementation_plan.md.resolved](./implementation_plan.md.resolved) for full technical context and decisions.

---
*Built for the JADEITE Program.*
