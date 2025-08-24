# Database Setup Guide

## 🚀 Quick Setup for PostgreSQL Database

### Option 1: Free PostgreSQL Database (Recommended)

1. **Get a free database:**
   - Go to [ElephantSQL](https://www   .elephantsql.com/)
   - Sign up for a free account
   - Create a new instance (Tiny Turtle - Free)
   - Copy the connection URL

2. **Update your .env file:**
   ```
   DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
   SESSION_SECRET="your-secret-key"
   PORT=5000
   NODE_ENV=development
   ```

3. **Test the connection:**
   ```bash
   node test-db-connection.js
   ```

4. **Create database tables:**
   ```bash
   npm run db:push
   ```

5. **Start the application:**
   ```bash
   npm run dev
   ```

### Option 2: Local PostgreSQL

1. **Install PostgreSQL locally**
2. **Create a database**
3. **Update .env file with local connection**
4. **Run the setup commands above**

### Option 3: Other Free PostgreSQL Services

- **Supabase**: https://supabase.com/
- **Neon**: https://neon.tech/
- **Railway**: https://railway.app/

## 🎯 What This Will Do

✅ Create all necessary database tables
✅ Set up user authentication
✅ Enable job management features
✅ Allow you to create your first admin account

## 🚨 Troubleshooting

If you get connection errors:
- Make sure your DATABASE_URL is correct
- Check that the database is accessible
- Verify SSL settings are correct
- Try running `node test-db-connection.js` to test the connection
