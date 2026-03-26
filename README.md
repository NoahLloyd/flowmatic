# Flowmatic

A desktop productivity system built with Electron, React, and Supabase.

Track focus sessions, manage tasks, build streaks, write daily reflections, and review your week — all from a native macOS app.

## Tech Stack

- **Electron** + **Electron Forge** (desktop shell)
- **React 18** + **TypeScript** (UI)
- **Tailwind CSS** (styling)
- **Supabase** (auth, database, realtime)
- **Tiptap / Yoopta** (rich-text editing)
- **Recharts** (data visualisation)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/NoahLloyd/flow-frontend.git
   cd flow-frontend
   npm install
   ```

2. Create a `.env` file from the example:

   ```bash
   cp .env.example .env
   ```

3. Fill in your Supabase credentials in `.env`.

4. Run the Supabase schema migration:

   Run `supabase/schema.sql` in your Supabase SQL Editor to create the required tables.

5. Start the app:

   ```bash
   npm start
   ```

## License

[MIT](LICENSE)
