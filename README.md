# St. Louis College Jos — Official Website

A Node.js + MongoDB school website inspired by the Manhattan School of Music design, built for **St. Louis College Jos**.

## Features

- MSM-inspired layout with school logo in the header (replaces portal login)
- 12-slide hero carousel (your photos + placeholders — replace placeholders anytime)
- Full navigation with dropdown menus for About, Academics, Admission, Student Life, Downloads, Check Result, and Contact
- MongoDB-backed content pages, events, news, and hero slides
- Student result portal with login

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas connection string

## Setup

```bash
# Install dependencies
npm install

# Copy environment file and edit if needed
copy .env.example .env

# Seed the database with pages, events, news, hero slides, and a demo student
npm run seed

# Start the server
npm start
```

Visit **http://localhost:3000**

## Demo Login (Check Result)

| Field      | Value        |
|------------|--------------|
| Student ID | `SLC2024001` |
| Password   | `student123` |

## Hero Images

Place your photos in `public/images/` and update `scripts/seed.js` or the `HeroSlide` collection in MongoDB:

| File           | Description              |
|----------------|--------------------------|
| `logo.jpg`     | School logo (header)     |
| `hero-01.jpg`  | Main campus photo        |
| `hero-02.jfif` | Students photo           |
| `hero-03.jfif` | Campus life photo        |
| `hero-04.svg` – `hero-12.svg` | Placeholders (replace with `.jpg` photos) |

## Project Structure

```
├── server.js           # Express app entry point
├── config/             # Database & navigation config
├── models/             # Mongoose models
├── routes/             # Route handlers
├── views/              # EJS templates
├── public/             # Static assets (CSS, JS, images)
└── scripts/seed.js     # Database seeder
```

## Development

```bash
npm run dev   # Start with --watch for auto-restart
```
