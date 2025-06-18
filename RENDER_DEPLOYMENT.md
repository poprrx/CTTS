# Deploy Courtney Text-to-Speech to Render.com

## Quick Deployment Steps

### 1. Prepare Your Repository
1. Push all your code to a GitHub repository
2. Make sure these files are included:
   - `render.yaml` (deployment configuration)
   - `requirements_render.txt` (Python dependencies)
   - `Procfile` (process configuration)
   - All your application files

### 2. Deploy to Render
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Click "Apply" to deploy

### 3. Environment Setup
The deployment will automatically:
- Create a PostgreSQL database
- Set up the web service
- Configure environment variables:
  - `DATABASE_URL` (automatically set from database)
  - `SESSION_SECRET` (automatically generated)
  - `PYTHON_VERSION=3.11.10`

### 4. Manual Alternative (if Blueprint doesn't work)
If the blueprint deployment fails, you can deploy manually:

#### A. Create Database First
1. Go to Render Dashboard
2. Click "New" → "PostgreSQL"
3. Name: `courtney-tts-db`
4. Plan: Free
5. Note the connection string

#### B. Create Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `courtney-tts`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements_render.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --reuse-port main:app`

#### C. Set Environment Variables
Add these in the web service environment variables:
- `DATABASE_URL`: (copy from your PostgreSQL service)
- `SESSION_SECRET`: (generate a random string)

### 5. Post-Deployment
1. Your app will be available at: `https://courtney-tts.onrender.com`
2. The database will automatically initialize with tables
3. Test the voice generation functionality

### 6. Important Notes
- **Free tier**: Apps may sleep after 15 minutes of inactivity
- **RunPod Integration**: Update the F5-TTS backend URL in production if needed
- **CORS**: The current backend URL should work, but verify in browser console
- **Database**: PostgreSQL free tier has 1GB storage limit

### 7. Troubleshooting
- Check build logs in Render dashboard
- Verify environment variables are set correctly
- Ensure RunPod F5-TTS service is accessible from Render
- Check browser console for CORS or network errors

## Files Created for Deployment
- `render.yaml`: Blueprint configuration for automatic deployment
- `requirements_render.txt`: Python package dependencies  
- `Procfile`: Process configuration for the web service
- This deployment guide

The application is now ready for production deployment on Render.com!